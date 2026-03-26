/**
 * ETL Agent A4 — Ground Truth Auto-Builder
 * Cross-joins NCCN rules × payer policies to auto-detect and classify conflicts.
 * Produces or updates ground_truth rows for every NCCN Cat 1/2A drug × 4 payers.
 */

import { storage } from "../storage";
import { agentLogger } from "../agents/logger";

function classifyConflict(
  nccnCategory: string,
  policy: any,
): { conflictType: string | null; conflictDescription: string; legalTags: string[] } {

  const tags: string[] = [];
  let conflictType: string | null = null;
  let desc = "";

  const isMandated = nccnCategory === "1" || nccnCategory === "2A";

  // Type A: NCCN Cat 1/2A → payer says experimental
  if (isMandated && policy.experimentalInvestigationalFlag) {
    conflictType = "A";
    desc = `NCCN Category ${nccnCategory} drug classified as experimental/investigational by ${policy.payerId}. FDA-approved therapy denied via experimental designation contrary to national clinical consensus.`;
    tags.push(`contradicts NCCN Cat ${nccnCategory}`, "FDA approved", "experimental classification bad-faith", "systematic denial pattern");
  }
  // Type B: NCCN Cat 1/2A → payer says NMN
  else if (isMandated && policy.notMedicallyNecessaryLanguage) {
    conflictType = "B";
    desc = `${policy.payerId} labels this therapy "not medically necessary" despite FDA approval and NCCN Category ${nccnCategory} designation. The NMN rationale directly contradicts regulatory and guideline standards.`;
    tags.push(`NMN contradicts NCCN Cat ${nccnCategory}`, "FDA approval overridden", "bad-faith NMN", "ERISA 502");
  }
  // Type C: payer imposes step therapy contradicting NCCN recommended sequence
  else if (policy.stepTherapyRequirements && isMandated) {
    conflictType = "C";
    desc = `${policy.payerId} requires step therapy (${policy.stepTherapyRequirements}) before this NCCN Category ${nccnCategory} recommended agent. Payer-imposed sequence contradicts guideline-recommended treatment order and may force clinically inferior prior therapy.`;
    tags.push("step therapy contradicts NCCN sequence", `forces inferior prior therapy`, `NCCN Cat ${nccnCategory} bypassed`);
  }
  // Type D: biomarker restrictions narrower than FDA label
  else if (policy.biomarkerConstraints && isMandated) {
    conflictType = "D";
    desc = `${policy.payerId} restricts coverage to narrower biomarker criteria than the FDA label (${policy.biomarkerConstraints}), effectively denying coverage for populations the FDA and NCCN consider eligible.`;
    tags.push("biomarker restriction narrows FDA indication", "coverage gap not supported by FDA label", `NCCN Cat ${nccnCategory} eligible population denied`);
  }

  if (!isMandated && (policy.experimentalInvestigationalFlag || policy.notMedicallyNecessaryLanguage)) {
    // Still a conflict but lower severity
    conflictType = conflictType || "B";
    tags.push("NCCN 2B/3 policy restriction");
  }

  return { conflictType, conflictDescription: desc, legalTags: tags };
}

export async function runGroundTruthBuilderAgent(
  runId: string,
  cancerTypes?: string[]
): Promise<{ created: number; updated: number }> {
  agentLogger.log(runId, "etl_gt", "Starting ground truth auto-builder...");

  let created = 0;
  let updated = 0;

  const allNccn = storage.getAllNccn();
  const targetNccn = cancerTypes
    ? allNccn.filter(n => cancerTypes.includes(n.cancerType))
    : allNccn;

  // Only process NCCN Cat 1 and 2A (highest clinical evidence — most actionable for appeals)
  const mandated = targetNccn.filter(n => n.nccnCategory === "1" || n.nccnCategory === "2A");
  agentLogger.log(runId, "etl_gt", `Processing ${mandated.length} NCCN Cat 1/2A entries × 4 payers...`);

  for (const nccn of mandated) {
    for (const payerId of ["UHC", "Cigna", "Aetna", "Humana"]) {
      const policies = storage.getPayerPolicy(payerId, nccn.drugId);
      if (policies.length === 0) continue;

      const policy = policies[0];
      const { conflictType, conflictDescription, legalTags } = classifyConflict(nccn.nccnCategory, policy);

      if (!conflictType) continue; // No conflict = no ground truth row needed

      const gtId = `GT-${payerId}-${nccn.drugId.toUpperCase().slice(0, 12)}-${nccn.lineOfTherapy}-${nccn.cancerType.toUpperCase()}`.slice(0, 80);

      const existing = storage.getGroundTruth(gtId);
      const severity = nccn.nccnCategory === "1" ? "high" : "medium";

      const row = {
        groundTruthRowId: gtId,
        drugId: nccn.drugId,
        cancerType: nccn.cancerType,
        indication: nccn.indication,
        biomarkerProfile: nccn.biomarkerProfile,
        lineOfTherapy: nccn.lineOfTherapy,
        nccnId: nccn.nccnId,
        nccnCategory: nccn.nccnCategory,
        payerId,
        policyId: policy.policyId,
        denialRationaleType: conflictType === "A" ? "experimental" : conflictType === "B" ? "not_medically_necessary" : conflictType === "C" ? "step_therapy" : "other",
        denialTextSnippet: policy.experimentalRationale || policy.notMedicallyNecessaryLanguage || policy.stepTherapyRequirements || policy.coverageCriteriaText?.slice(0, 200) || null,
        conflictType,
        conflictDescription,
        cmsBehaviorFlags: JSON.stringify({ prior_auth_flag: policy.priorAuthRequired }),
        legalExposureTags: JSON.stringify(legalTags),
        severity,
        lastValidatedTimestamp: new Date().toISOString().split("T")[0],
      };

      if (existing) {
        storage.upsertGroundTruth(row);
        updated++;
      } else {
        storage.upsertGroundTruth(row);
        created++;
      }
    }
  }

  agentLogger.log(runId, "etl_gt", `Ground truth builder complete. Created: ${created}, Updated: ${updated}`);
  return { created, updated };
}
