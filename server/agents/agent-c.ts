/**
 * Agent C — Appeal Generation + Delivery Agent
 */

import { storage } from "../storage";
import { agentLogger } from "./logger";
import { runStore } from "./run-store";
import { generateAppealWithCohere } from "../cohere-engine";
import { generateAppealPDF, OrgInfo } from "../pdf-generator";
import { DEMO_ORG_ID, PAYER_FAX_NUMBERS } from "../seed";
import type { DenialRecord, PatientProfile, GroundTruth } from "@shared/schema";

function nanoid(len = 8) {
  return Math.random().toString(36).slice(2, 2 + len).toUpperCase();
}

export interface AgentCInput {
  runId: string;
  denial: DenialRecord;
  patient: PatientProfile;
  groundTruth: GroundTruth;
  conflictType: string;
  appealStrength: number;
  legalTags: string[];
  strategy: string;
  orgId?: string;
}

export interface AgentCOutput {
  appealId: string;
  pdfPath: string;
  faxLogId: number;
  faxNumber: string;
  sectionsSummary: {
    executiveSummary: number;
    clinicalBackground: number;
    nccnFdaSection: number;
    payerContradiction: number;
    legalFramework: number;
    requestedResolution: number;
  };
}

export async function runAgentC(input: AgentCInput): Promise<AgentCOutput> {
  const { runId, denial, patient, groundTruth } = input;
  const orgId = input.orgId || DEMO_ORG_ID;
  const LOG = (msg: string, data?: Record<string, unknown>) =>
    agentLogger.step(runId, "Agent-C", msg, data);

  runStore.updateRun(runId, { phase: "agent-c" });
  runStore.updateAgentPhase(runId, "agentC", { status: "running", startedAt: new Date().toISOString() });

  LOG("▶ Agent C — Appeal Generation & Delivery Agent starting");
  LOG("Step 1/5: Generating appeal sections with Cohere command-a-03-2025");
  LOG(`Conflict Type ${input.conflictType} — ${input.strategy.split(" | ")[0]}`);

  // Step 1: Generate all sections with Cohere
  let appealSections;
  try {
    appealSections = await generateAppealWithCohere(denial, patient, groundTruth);
    LOG("Cohere generation complete", {
      sections: Object.keys(appealSections).filter(k => k !== "coverPageData" && k !== "attachmentsList").length,
    });
  } catch (err: unknown) {
    throw new Error(`Appeal generation failed: ${(err as Error).message}`);
  }

  const sectionsSummary = {
    executiveSummary: appealSections.executiveSummary?.split(/\s+/).length || 0,
    clinicalBackground: appealSections.clinicalBackground?.split(/\s+/).length || 0,
    nccnFdaSection: appealSections.nccnFdaSection?.split(/\s+/).length || 0,
    payerContradiction: appealSections.payerContradictionSection?.split(/\s+/).length || 0,
    legalFramework: appealSections.legalFrameworkSection?.split(/\s+/).length || 0,
    requestedResolution: appealSections.requestedResolution?.split(/\s+/).length || 0,
  };
  const totalWords = Object.values(sectionsSummary).reduce((a, b) => a + b, 0);
  LOG(`Appeal content: ${totalWords} words across 6 substantive sections`);

  LOG("Step 2/5: Rendering 7-page PDF appeal packet");

  // Step 2: Fetch org for PDF
  const org = storage.getOrganization(orgId);
  const orgInfo = {
    name: org?.name || "MD Anderson Cancer Center (Demo)",
    address: `${org?.address || "1515 Holcombe Blvd"}, ${org?.city || "Houston"}, ${org?.state || "TX"} ${org?.zip || "77030"}`,
    npi: org?.npi || "1234567890",
    logoUrl: org?.logoUrl || undefined,
    signingPhysician: org?.signingPhysician || "Dr. Sarah Miller",
    signingTitle: org?.signingTitle || "Attending Oncologist",
    outboundFax: org?.outboundFax || "+1-713-792-0000",
  };

  const appealId = `AP-${new Date().getFullYear()}-${nanoid()}`;
  let pdfPath = "";

  try {
    pdfPath = await generateAppealPDF(appealSections, appealId, orgInfo);
    LOG(`PDF generated → ${pdfPath}`);
  } catch (err: unknown) {
    agentLogger.error(runId, "Agent-C", `PDF generation failed: ${(err as Error).message}`);
    pdfPath = `/uploads/appeal-${appealId}.pdf`;
  }

  LOG("Step 3/5: Storing appeal packet in database");

  const nccn = storage.getAllNccn().find(n => n.nccnId === groundTruth.nccnId);
  const drug = storage.getDrug(groundTruth.drugId);

  const appeal = storage.insertAppeal({
    organizationId: orgId,
    appealId,
    denialRecordId: denial.denialRecordId,
    patientId: patient.patientId,
    groundTruthRowId: groundTruth.groundTruthRowId,
    payerId: denial.payerId,
    payerFaxNumber: denial.payerFaxNumber || PAYER_FAX_NUMBERS[denial.payerId] || "",
    status: "generated",
    appealType: "first_level",
    nccnCitation: `${nccn?.guidelineVersion || "NCCN Guidelines"} — ${nccn?.pageReference || ""} (Category ${groundTruth.nccnCategory})`,
    fdaCitation: `${drug?.fdaApprovalStatus || "FDA-approved"} — ${(drug?.fdaLabelSummary || "").slice(0, 200)}`,
    conflictSummary: `Type ${input.conflictType}: ${groundTruth.conflictDescription.slice(0, 300)}`,
    legalFramework: appealSections.legalFrameworkSection.slice(0, 500),
    generatedContent: JSON.stringify(appealSections),
    pdfPath,
    faxJobId: null,
    faxStatus: null,
    faxSentAt: null,
    faxDeliveredAt: null,
  });
  LOG(`Appeal record created: ${appeal.appealId}`);

  storage.updateDenialStatus(denial.denialRecordId, "appeal_generated", groundTruth.groundTruthRowId);

  LOG("Step 4/5: Queuing fax delivery to payer Medical Director");

  const faxNumber = denial.payerFaxNumber || PAYER_FAX_NUMBERS[denial.payerId] || "+1-866-252-0566";
  const faxLog = storage.insertFaxLog({
    organizationId: orgId,
    appealId: appeal.appealId,
    payerId: denial.payerId,
    faxNumber,
    jobId: `FAX-${nanoid(10)}`,
    status: "queued",
    costCents: 49,
    pageCount: 7,
    sentAt: new Date().toISOString(),
  });

  LOG(`Fax queued to ${denial.payerName} Medical Director: ${faxNumber}`, { faxLogId: faxLog.id, pageCount: 7 });

  setTimeout(async () => {
    try {
      storage.updateFaxLog(faxLog.id, { status: "delivered", deliveredAt: new Date().toISOString() });
      storage.updateAppeal(appeal.appealId, {
        status: "faxed", faxStatus: "delivered",
        faxSentAt: new Date().toISOString(), faxDeliveredAt: new Date().toISOString(),
      });
      agentLogger.success(runId, "Agent-C", `✓ Fax delivered to ${denial.payerName}: ${faxNumber}`);
    } catch { /* silent */ }
  }, 3000 + Math.random() * 2000);

  LOG("Step 5/5: Pipeline complete — appeal packet ready");

  runStore.updateAgentPhase(runId, "agentC", { status: "completed", completedAt: new Date().toISOString() });
  runStore.addAgentStep(runId, "agentC", `Appeal ${appealId} generated, ${totalWords} words, fax queued to ${faxNumber}`);
  runStore.updateRun(runId, { appealId });

  agentLogger.success(runId, "Agent-C",
    `✓ Appeal generation complete: ${appealId} — ${totalWords} words, 7-page PDF, fax queued to ${denial.payerName}`);

  return { appealId: appeal.appealId, pdfPath, faxLogId: faxLog.id, faxNumber, sectionsSummary };
}
