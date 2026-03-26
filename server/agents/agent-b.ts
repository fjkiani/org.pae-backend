/**
 * Agent B — Ground Truth Matching + Assessment Agent
 * Responsibilities:
 *   1. Take denial + patient from Agent A
 *   2. Match to ground truth dataset (exact → fuzzy → Cohere-assisted)
 *   3. Classify conflict type (A/B/C/D)
 *   4. Score legal exposure and appeal strength
 *   5. Return enriched match result with legal tags + recommended strategy
 */

import { CohereClient } from "cohere-ai";
import { storage } from "../storage";
import { agentLogger } from "./logger";
import { runStore } from "./run-store";
import { matchDenialToGroundTruth } from "../cohere-engine";
import type { DenialRecord, PatientProfile, GroundTruth } from "@shared/schema";

const cohere = new CohereClient({ token: "lfWaRwjaOdTuZEOlP2uLFyFMTWcDfM0EtLLQZl7Q" });

const CONFLICT_TYPE_LABELS: Record<string, string> = {
  A: "Experimental/Investigational vs NCCN Category 1/2A — strongest appeal basis",
  B: "Not Medically Necessary vs FDA-Approved — regulatory preemption basis",
  C: "Step Therapy vs NCCN Sequence — clinical harm + guideline deviation basis",
  D: "CMS Shadow Policy — systemic barrier with regulatory citation basis",
};

const APPEAL_STRENGTH_LABELS: Record<number, string> = {
  5: "VERY HIGH — near-certain reversal with proper documentation",
  4: "HIGH — strong legal and clinical basis",
  3: "MODERATE — merits appeal with additional documentation",
  2: "FAIR — possible reversal with escalation",
  1: "LOW — escalate to external review",
};

export interface AgentBInput {
  runId: string;
  denial: DenialRecord;
  patient: PatientProfile;
}

export interface AgentBOutput {
  groundTruth: GroundTruth;
  conflictType: string;
  conflictDescription: string;
  appealStrength: number;
  appealStrengthLabel: string;
  legalTags: string[];
  strategy: string;
  cohereAssisted: boolean;
}

async function cohereAssistedMatch(
  denial: DenialRecord,
  patient: PatientProfile
): Promise<GroundTruth | null> {
  const allGt = storage.getAllGroundTruth();
  const allDrugs = storage.getAllDrugs();
  const allNccn = storage.getAllNccn();

  const gtSummary = allGt.slice(0, 20).map(r =>
    `ID:${r.id} payer:${r.payerId} drug:${r.drugId} cancer:${r.cancerType} conflict:${r.conflictType} nccn:${r.nccnCategory}`
  ).join("\n");

  const prompt = `You are a medical policy analyst. A payer has denied authorization for a drug. Match this denial to the most appropriate ground truth rule.

DENIAL:
- Payer: ${denial.payerId} (${denial.payerName})
- Drug: ${denial.drugNameRaw}
- Reason: ${denial.denialReasonCode} — "${denial.denialReasonText}"
- Cancer Type: ${patient.cancerType}, Stage: ${patient.stage}

GROUND TRUTH RULES (id, payer, drug, cancer, conflict, nccn category):
${gtSummary}

Return ONLY valid JSON: {"best_match_id": "the numeric ID or null", "reasoning": "brief explanation"}`;

  try {
    const response = await cohere.chat({
      model: "command-a-03-2025",
      message: prompt,
      temperature: 0.1,
      maxTokens: 300,
    });
    const raw = (response.text || "").replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(raw);

    if (parsed.best_match_id) {
      const matched = allGt.find(r => String(r.id) === String(parsed.best_match_id));
      return matched || null;
    }
  } catch {
    // Silent fallback
  }
  return null;
}

function scoreAppealStrength(gt: GroundTruth, denial: DenialRecord): number {
  let score = 3; // baseline moderate

  // NCCN category boosts
  if (gt.nccnCategory === "1") score += 1.5;
  else if (gt.nccnCategory === "2A") score += 1;

  // Conflict type boosts
  if (gt.conflictType === "A") score += 0.5;  // Experimental vs Cat1 — very strong
  if (gt.conflictType === "B") score += 0.5;  // NMN vs FDA-approved — strong
  if (gt.conflictType === "C") score += 0;    // Step therapy — moderate
  if (gt.conflictType === "D") score += 0;    // CMS — moderate

  // Denial reason penalties
  if (denial.denialReasonCode === "step_therapy") score -= 0.5; // Harder to overcome
  if (denial.denialReasonCode === "other") score -= 1;

  return Math.min(5, Math.max(1, Math.round(score)));
}

function buildStrategy(gt: GroundTruth, patient: PatientProfile, appealStrength: number): string {
  const strategies: string[] = [];

  if (gt.conflictType === "A") {
    strategies.push("Lead with NCCN Category 1/2A citation — payer's 'experimental' classification is facially invalid under regulatory consensus.");
    strategies.push("Include FDA approval letter reference + Phase III trial data as primary evidence.");
    strategies.push("Cite state bad-faith statute for denying FDA-approved, guideline-concordant therapy.");
  } else if (gt.conflictType === "B") {
    strategies.push("Assert FDA-approved indication as ceiling for 'medical necessity' determination — payer cannot set a higher bar.");
    strategies.push("Quote CMS guidance: 'FDA approval for an indication creates a presumption of medical necessity.'");
    strategies.push("Request expedited review citing urgent oncologic need.");
  } else if (gt.conflictType === "C") {
    strategies.push("Document all prior step therapy failures with objective evidence (labs, imaging, progression dates).");
    strategies.push("Cite NCCN sequence — step therapy requirement contradicts evidence-based preferred sequence.");
    strategies.push("State law step-therapy override: many states mandate exception for cancer patients failing prior therapy.");
  } else if (gt.conflictType === "D") {
    strategies.push("Use CMS Transparency in Coverage MRF data to document systematic PA barriers.");
    strategies.push("File complaint with CMS if Medicare Advantage plan — CMS has explicit guidance against arbitrary PA.");
    strategies.push("Request independent external review immediately.");
  }

  if (appealStrength >= 4) {
    strategies.push("Appeal strength is HIGH — submit expedited appeal with full documentation package.");
  } else {
    strategies.push("Consider escalating directly to external independent review after initial appeal submission.");
  }

  return strategies.join(" | ");
}

export async function runAgentB(input: AgentBInput): Promise<AgentBOutput> {
  const { runId, denial, patient } = input;
  const LOG = (msg: string, data?: Record<string, unknown>) =>
    agentLogger.step(runId, "Agent-B", msg, data);

  runStore.updateRun(runId, { phase: "agent-b" });
  runStore.updateAgentPhase(runId, "agentB", {
    status: "running",
    startedAt: new Date().toISOString(),
  });

  LOG("▶ Agent B — Ground Truth Matching & Assessment Agent starting");
  LOG("Step 1/5: Attempting exact match on payer × drug × cancer type");

  let groundTruth: GroundTruth | null = null;
  let cohereAssisted = false;

  // Step 1: Exact match
  groundTruth = await matchDenialToGroundTruth(denial, patient);

  if (groundTruth) {
    LOG(`Exact/fuzzy match found: GT row #${groundTruth.id}`, {
      conflictType: groundTruth.conflictType,
      nccnCategory: groundTruth.nccnCategory,
      drug: groundTruth.drugId,
    });
  } else {
    LOG("Step 2/5: No exact match — engaging Cohere for semantic matching");
    groundTruth = await cohereAssistedMatch(denial, patient);
    if (groundTruth) {
      cohereAssisted = true;
      LOG(`Cohere-assisted match found: GT row #${groundTruth.id}`, {
        conflictType: groundTruth.conflictType,
        nccnCategory: groundTruth.nccnCategory,
      });
    }
  }

  // Final fallback — use first GT row if no match at all
  if (!groundTruth) {
    LOG("Step 2/5: No match found — using first available ground truth as fallback");
    const all = storage.getAllGroundTruth();
    if (all.length === 0) {
      throw new Error("Ground truth database is empty. Run ETL pipeline first.");
    }
    groundTruth = all[0];
    LOG(`Fallback GT row: #${groundTruth.id}, conflict type ${groundTruth.conflictType}`);
  }

  LOG("Step 3/5: Classifying conflict type");
  const conflictType = groundTruth.conflictType;
  const conflictDescription = groundTruth.conflictDescription;
  LOG(`Conflict classified: Type ${conflictType} — ${CONFLICT_TYPE_LABELS[conflictType] || "Policy mismatch"}`);

  LOG("Step 4/5: Scoring appeal strength");
  const appealStrength = scoreAppealStrength(groundTruth, denial);
  const appealStrengthLabel = APPEAL_STRENGTH_LABELS[appealStrength] || "MODERATE";
  LOG(`Appeal strength: ${appealStrength}/5 — ${appealStrengthLabel}`);

  LOG("Step 5/5: Building legal exposure tags and appeal strategy");
  const legalTagsRaw = groundTruth.legalExposureTags;
  let legalTags: string[] = [];
  try {
    legalTags = JSON.parse(legalTagsRaw || "[]");
  } catch {
    legalTags = [legalTagsRaw || "ERISA § 502"];
  }

  const strategy = buildStrategy(groundTruth, patient, appealStrength);

  // Update denial with ground truth ID
  storage.updateDenialStatus(denial.denialRecordId, "gt_matched", String(groundTruth.id));

  runStore.updateAgentPhase(runId, "agentB", {
    status: "completed",
    completedAt: new Date().toISOString(),
  });
  runStore.addAgentStep(runId, "agentB", `GT matched: Type ${conflictType}, strength ${appealStrength}/5`);

  agentLogger.success(runId, "Agent-B", `✓ Assessment complete: Conflict Type ${conflictType}, Appeal Strength ${appealStrength}/5${cohereAssisted ? " (Cohere-assisted)" : ""}`);

  return {
    groundTruth,
    conflictType,
    conflictDescription,
    appealStrength,
    appealStrengthLabel,
    legalTags,
    strategy,
    cohereAssisted,
  };
}
