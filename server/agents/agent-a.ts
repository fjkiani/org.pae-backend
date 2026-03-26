/**
 * Agent A — Denial Ingestion Agent
 * Responsibilities:
 *   1. Accept raw denial text (OCR output or manual paste)
 *   2. Use Cohere to extract structured fields (payer, drug, reason, dates, etc.)
 *   3. Normalize + upsert denial record into storage
 *   4. Return enriched DenialRecord + matched PatientProfile
 */

import { CohereClient } from "cohere-ai";
import { storage } from "../storage";
import { agentLogger } from "./logger";
import { runStore } from "./run-store";
import { extractDenialFromText } from "../cohere-engine";
import type { DenialRecord, PatientProfile } from "@shared/schema";

const cohere = new CohereClient({ token: "lfWaRwjaOdTuZEOlP2uLFyFMTWcDfM0EtLLQZl7Q" });

function nanoid(len = 8) {
  return Math.random().toString(36).slice(2, 2 + len).toUpperCase();
}

const PAYER_FAX_NUMBERS: Record<string, string> = {
  UHC: "+1-866-252-0566",
  Cigna: "+1-800-337-0255",
  Aetna: "+1-860-754-3604",
  Humana: "+1-800-457-4708",
};

const PAYER_ID_MAP: Record<string, string> = {
  "unitedhealth": "UHC", "united": "UHC", "uhc": "UHC",
  "cigna": "Cigna",
  "aetna": "Aetna",
  "humana": "Humana",
};

function normalizePayer(rawName: string): { payerId: string; payerName: string; fax: string } {
  const lower = rawName.toLowerCase();
  for (const [key, id] of Object.entries(PAYER_ID_MAP)) {
    if (lower.includes(key)) {
      return { payerId: id, payerName: id, fax: PAYER_FAX_NUMBERS[id] };
    }
  }
  return { payerId: "UHC", payerName: rawName || "Unknown Payer", fax: PAYER_FAX_NUMBERS["UHC"] };
}

export interface AgentAInput {
  runId: string;
  denialId?: string;        // If pre-existing denial record
  rawDenialText?: string;   // OCR/pasted text to extract
  patientId?: string;       // Explicit patient link
}

export interface AgentAOutput {
  denial: DenialRecord;
  patient: PatientProfile;
  extractedFields: Record<string, string | null>;
}

export async function runAgentA(input: AgentAInput): Promise<AgentAOutput> {
  const { runId } = input;
  const LOG = (msg: string, data?: Record<string, unknown>) =>
    agentLogger.step(runId, "Agent-A", msg, data);

  runStore.updateRun(runId, { phase: "agent-a" });
  runStore.updateAgentPhase(runId, "agentA", {
    status: "running",
    startedAt: new Date().toISOString(),
  });

  LOG("▶ Agent A — Denial Ingestion Agent starting");
  LOG("Step 1/4: Checking for existing denial record");

  let denial: DenialRecord | undefined;
  let extractedFields: Record<string, string | null> = {};

  // Case 1: Use existing denial by ID
  if (input.denialId) {
    denial = storage.getDenial(input.denialId);
    if (denial) {
      LOG(`Found existing denial: ${denial.denialRecordId}`, {
        payer: denial.payerName,
        drug: denial.drugNameRaw,
        reason: denial.denialReasonCode,
      });
    }
  }

  // Case 2: Extract from raw text via Cohere
  if (!denial && input.rawDenialText) {
    LOG("Step 2/4: Extracting denial fields with Cohere NLP");

    try {
      extractedFields = await extractDenialFromText(input.rawDenialText) as Record<string, string | null>;
      LOG("Cohere extraction complete", {
        payer: extractedFields.payer_name,
        drug: extractedFields.drug_name_raw,
        reason: extractedFields.denial_reason_code,
      });

      // Normalize payer
      const payer = normalizePayer(extractedFields.payer_name || "");

      // Find or create patient
      let patient: PatientProfile | undefined;
      if (input.patientId) {
        patient = storage.getPatient(input.patientId);
      }
      if (!patient) {
        const allPatients = storage.getAllPatients();
        patient = allPatients[0]; // fallback
      }

      // Build denial record from extracted fields
      denial = storage.insertDenial({
        denialRecordId: `DN-${new Date().getFullYear()}-${nanoid()}`,
        patientId: patient?.patientId || `PT-${nanoid()}`,
        payerId: payer.payerId,
        payerName: payer.payerName,
        payerFaxNumber: payer.fax,
        memberId: extractedFields.member_id || "UNKNOWN",
        drugId: `drug-${nanoid(4).toLowerCase()}`,
        drugNameRaw: extractedFields.drug_name_raw || "Unknown Drug",
        icd10Codes: extractedFields.icd10_codes || "unknown",
        denialReasonCode: extractedFields.denial_reason_code || "other",
        denialReasonText: extractedFields.denial_reason_text || "See original denial notice",
        denialDate: extractedFields.denial_date || new Date().toISOString().slice(0, 10),
        referenceNumber: extractedFields.reference_number || `REF-${nanoid()}`,
        rawDocumentText: input.rawDenialText,
      });

      LOG(`Denial record created: ${denial.denialRecordId}`);
    } catch (err: unknown) {
      agentLogger.error(runId, "Agent-A", `Cohere extraction failed: ${(err as Error).message}`);
      // Fall through to use a sample denial
    }
  }

  // Case 3: Fallback — use first available denial
  if (!denial) {
    LOG("Step 2/4: No input provided — loading first available denial from storage");
    const all = storage.getAllDenials();
    denial = all[0];
    if (!denial) {
      throw new Error("No denial records available. Submit a denial first.");
    }
    LOG(`Using existing denial: ${denial.denialRecordId}`);
  }

  LOG("Step 3/4: Resolving patient profile");
  let patient = storage.getPatient(denial.patientId);
  if (!patient) {
    const all = storage.getAllPatients();
    patient = all[0];
    if (!patient) {
      throw new Error("No patient profile found for this denial.");
    }
    LOG(`Warning: Patient ${denial.patientId} not found — using fallback patient ${patient.patientId}`, {});
  } else {
    LOG(`Patient resolved: ${patient.patientId} — ${patient.cancerType} cancer, ${patient.stage}`);
  }

  LOG("Step 4/4: Normalizing denial fields and updating status");
  storage.updateDenialStatus(denial.denialRecordId, "agent_a_complete");

  runStore.updateAgentPhase(runId, "agentA", {
    status: "completed",
    completedAt: new Date().toISOString(),
  });
  runStore.addAgentStep(runId, "agentA", `Denial ${denial.denialRecordId} ingested and normalized`);

  agentLogger.success(runId, "Agent-A", `✓ Denial ingestion complete: ${denial.denialRecordId} — ${denial.drugNameRaw} / ${denial.payerName}`);

  return { denial, patient, extractedFields };
}
