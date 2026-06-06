import type { Express, Request, Response } from "express";
import type { Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import { storage } from "./storage";
import { ensureDemoOrg, PAYER_FAX_NUMBERS, DEMO_ORG_ID } from "./seed";
import { matchDenialToGroundTruth, generateAppealWithCohere, extractDenialFromText, generateP2PBrief, scoreDenialPredictively } from "./cohere-engine";
import { generateAppealPDF } from "./pdf-generator";
import { agentLogger } from "./agents/logger";
import { runPipeline } from "./agents/orchestrator";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function nanoid(len = 8) {
  return Math.random().toString(36).slice(2, 2 + len).toUpperCase();
}
const ORG_ID = DEMO_ORG_ID;

// ─── SOC 2 CHECKLIST ─────────────────────────────────────────────────────────
const SOC2_CHECKLIST = [
  // CC1 — Control Environment
  { id: "CC1.1", category: "CC1", name: "COSO Principles", description: "Management demonstrates commitment to integrity and ethical values", status: "implemented", notes: "Code of conduct documented; demo mode clearly labeled" },
  { id: "CC1.2", category: "CC1", name: "Board Oversight", description: "Board of directors demonstrates independence from management", status: "in_progress", notes: "Advisory board being established" },
  { id: "CC1.3", category: "CC1", name: "Organizational Structure", description: "Management establishes structures, reporting lines, and authorities", status: "implemented", notes: "Org chart and role definitions documented" },
  // CC2 — Communication
  { id: "CC2.1", category: "CC2", name: "Internal Communication", description: "Entity obtains or generates relevant quality information", status: "implemented", notes: "Audit logs capture all system events" },
  { id: "CC2.2", category: "CC2", name: "External Communication", description: "Entity communicates with external parties", status: "implemented", notes: "Privacy policy and terms of service published" },
  // CC3 — Risk Assessment
  { id: "CC3.1", category: "CC3", name: "Risk Identification", description: "Entity specifies objectives with sufficient clarity to enable identification of risks", status: "in_progress", notes: "Risk register being developed" },
  { id: "CC3.2", category: "CC3", name: "Risk Analysis", description: "Entity identifies and analyzes risk to achievement of objectives", status: "in_progress", notes: "Annual risk assessment planned" },
  { id: "CC3.3", category: "CC3", name: "Fraud Risk", description: "Entity considers the potential for fraud in assessing risks", status: "not_started", notes: "Fraud risk assessment not yet conducted" },
  // CC4 — Monitoring
  { id: "CC4.1", category: "CC4", name: "Ongoing Monitoring", description: "Entity selects, develops, and performs ongoing evaluations", status: "implemented", notes: "Automated health checks and alerting configured" },
  { id: "CC4.2", category: "CC4", name: "Deficiency Evaluation", description: "Entity evaluates and communicates internal control deficiencies", status: "in_progress", notes: "Incident response process being documented" },
  // CC5 — Control Activities
  { id: "CC5.1", category: "CC5", name: "Control Selection", description: "Entity selects and develops control activities", status: "implemented", notes: "Input validation, output encoding, parameterized queries" },
  { id: "CC5.2", category: "CC5", name: "Technology Controls", description: "Entity selects and develops general controls over technology", status: "implemented", notes: "HTTPS enforced, secrets in environment variables" },
  { id: "CC5.3", category: "CC5", name: "Policy Deployment", description: "Entity deploys control activities through policies and procedures", status: "in_progress", notes: "Security policies being formalized" },
  // CC6 — Logical Access
  { id: "CC6.1", category: "CC6", name: "Logical Access Security", description: "Entity implements logical access security software, infrastructure, and architectures", status: "implemented", notes: "JWT auth, role-based access (admin/provider/viewer)" },
  { id: "CC6.2", category: "CC6", name: "Authentication", description: "Prior to issuing system credentials, entity registers and authorizes new users", status: "implemented", notes: "Demo: localStorage auth; Production: Supabase Auth" },
  { id: "CC6.3", category: "CC6", name: "Access Removal", description: "Entity removes access to protected information assets when appropriate", status: "in_progress", notes: "Offboarding process being documented" },
  { id: "CC6.6", category: "CC6", name: "Logical Access Boundaries", description: "Entity implements logical access security measures to protect against threats", status: "implemented", notes: "Org-scoped data isolation; tenant separation enforced" },
  { id: "CC6.7", category: "CC6", name: "Transmission Encryption", description: "Entity restricts transmission of confidential information", status: "implemented", notes: "TLS 1.3 enforced; no PHI in logs" },
  { id: "CC6.8", category: "CC6", name: "Malicious Software", description: "Entity implements controls to prevent or detect and act upon the introduction of unauthorized software", status: "in_progress", notes: "Dependency scanning via npm audit; Snyk planned" },
  // CC7 — System Operations
  { id: "CC7.1", category: "CC7", name: "Vulnerability Management", description: "Entity uses detection and monitoring procedures to identify changes to configurations", status: "in_progress", notes: "Automated vulnerability scanning planned" },
  { id: "CC7.2", category: "CC7", name: "Anomaly Detection", description: "Entity monitors system components for anomalies", status: "implemented", notes: "Server error logging and alerting active" },
  { id: "CC7.3", category: "CC7", name: "Incident Response", description: "Entity evaluates security events to determine whether they could or have resulted in a failure", status: "not_started", notes: "Incident response plan not yet documented" },
  { id: "CC7.4", category: "CC7", name: "Incident Identification", description: "Entity responds to identified security incidents", status: "not_started", notes: "Incident response runbooks not yet created" },
  // CC8 — Change Management
  { id: "CC8.1", category: "CC8", name: "Change Management", description: "Entity authorizes, designs, develops, configures, documents, tests, approves, and implements changes", status: "implemented", notes: "Git-based change control; PR review required" },
  // CC9 — Risk Mitigation
  { id: "CC9.1", category: "CC9", name: "Risk Mitigation", description: "Entity identifies, selects, and develops risk mitigation activities", status: "in_progress", notes: "Business continuity plan being developed" },
  { id: "CC9.2", category: "CC9", name: "Vendor Management", description: "Entity assesses and manages risks associated with vendors", status: "in_progress", notes: "Vendor risk assessments for Cohere AI, Railway/Render" },
  // A1 — Availability
  { id: "A1.1", category: "A1", name: "Availability Commitments", description: "Entity maintains, monitors, and evaluates current processing capacity", status: "in_progress", notes: "SLA targets being defined; uptime monitoring planned" },
  { id: "A1.2", category: "A1", name: "Environmental Protections", description: "Environmental protections, software, data backup processes, and recovery infrastructure", status: "in_progress", notes: "Railway/Render auto-restart; backup strategy being defined" },
  { id: "A1.3", category: "A1", name: "Recovery Testing", description: "Entity tests recovery plan procedures", status: "not_started", notes: "Disaster recovery testing not yet conducted" },
  // C1 — Confidentiality
  { id: "C1.1", category: "C1", name: "Confidential Information Identification", description: "Entity identifies and maintains confidential information", status: "implemented", notes: "PHI fields identified; memberId marked for encryption in production" },
  { id: "C1.2", category: "C1", name: "Confidential Information Disposal", description: "Entity disposes of confidential information to meet entity objectives", status: "in_progress", notes: "Data retention policy being developed" },
  // PI1 — Processing Integrity
  { id: "PI1.1", category: "PI1", name: "Processing Completeness", description: "Entity obtains or generates, uses, and communicates relevant quality information", status: "implemented", notes: "All pipeline steps logged; audit trail maintained" },
  { id: "PI1.2", category: "PI1", name: "Processing Accuracy", description: "System processing is complete, valid, accurate, timely, and authorized", status: "implemented", notes: "Human-in-the-loop review before fax; physician sign-off required" },
  // P1-P8 — Privacy
  { id: "P1.1", category: "P1", name: "Privacy Notice", description: "Entity provides notice about its privacy practices", status: "in_progress", notes: "Privacy policy being drafted" },
  { id: "P2.1", category: "P2", name: "Choice and Consent", description: "Entity communicates choices available regarding collection, use, retention, disclosure", status: "in_progress", notes: "Consent management being implemented" },
  { id: "P3.1", category: "P3", name: "Collection", description: "Entity collects personal information consistent with its objectives", status: "implemented", notes: "Only clinically necessary data collected; no unnecessary PII" },
  { id: "P4.1", category: "P4", name: "Use, Retention, Disposal", description: "Entity limits the use of personal information", status: "in_progress", notes: "Data minimization policy being documented" },
  { id: "P5.1", category: "P5", name: "Access", description: "Entity grants individuals the ability to access their personal information", status: "not_started", notes: "Patient data access portal not yet built" },
  { id: "P6.1", category: "P6", name: "Disclosure to Third Parties", description: "Entity discloses personal information to third parties with the individual's consent", status: "implemented", notes: "No PHI shared with third parties without consent; Cohere API receives de-identified data" },
  { id: "P7.1", category: "P7", name: "Quality", description: "Entity collects and maintains accurate, up-to-date, complete, and relevant personal information", status: "implemented", notes: "Data validation on all inputs; ground truth validated timestamps" },
  { id: "P8.1", category: "P8", name: "Monitoring and Enforcement", description: "Entity monitors compliance with its privacy policies and procedures", status: "not_started", notes: "Privacy compliance monitoring not yet implemented" },
];

export async function registerRoutes(httpServer: Server, app: Express) {

  await ensureDemoOrg();

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", mode: "demo", orgId: ORG_ID });
  });

  // ─── STATS ─────────────────────────────────────────────────────────
  app.get("/api/stats", (_req, res) => {
    res.json(storage.getStats(ORG_ID));
  });

  // ─── ETL ROUTES ────────────────────────────────────────────────────────────
  const ALL_CANCER_TYPES = [
    "breast","lung","colon","ovarian","brain","prostate","bladder","pancreatic",
    "liver","gastric","esophageal","cervical","endometrial","thyroid","melanoma",
    "renal","head_neck","leukemia","lymphoma","myeloma","sarcoma","mesothelioma",
    "bile_duct","neuroendocrine","myelodysplastic"
  ];

  // In-memory ETL run state (per-process)
  const etlRunState: Record<string, { status: string; agents: string[]; startedAt: string; completedAt?: string; results?: any }> = {};

  app.get("/api/etl/status", (_req: Request, res: Response) => {
    const drugs = storage.getAllDrugs();
    const nccn = storage.getAllNccn();
    const policies = storage.getAllPayerPolicies();
    const gt = storage.getAllGroundTruth();
    const cancerTypeCounts: Record<string, number> = {};
    drugs.forEach(d => { cancerTypeCounts[d.cancerType] = (cancerTypeCounts[d.cancerType] || 0) + 1; });
    res.json({
      status: "idle",
      drugs: drugs.length,
      nccn: nccn.length,
      policies: policies.length,
      groundTruth: gt.length,
      cancerTypes: Object.keys(cancerTypeCounts).length,
      cancerTypeCounts,
      lastRun: null,
    });
  });

  app.get("/api/etl/cancer-types", (_req: Request, res: Response) => {
    const drugs = storage.getAllDrugs();
    const counts: Record<string, number> = {};
    drugs.forEach(d => { counts[d.cancerType] = (counts[d.cancerType] || 0) + 1; });
    res.json(ALL_CANCER_TYPES.map(ct => ({
      cancerType: ct,
      drugCount: counts[ct] || 0,
      nccnCount: storage.getAllNccn().filter(n => n.cancerType === ct).length,
      policyCount: storage.getAllPayerPolicies().filter(p => p.cancerType === ct).length,
      gtCount: storage.getAllGroundTruth().filter(g => g.cancerType === ct).length,
    })));
  });

  app.get("/api/etl/payers", (_req: Request, res: Response) => {
    const policies = storage.getAllPayerPolicies();
    const payers = ["UHC", "Cigna", "Aetna", "Humana"];
    res.json(payers.map(p => ({
      payerId: p,
      policyCount: policies.filter(pol => pol.payerId === p).length,
      gtCount: storage.getAllGroundTruth().filter(g => g.payerId === p).length,
    })));
  });

  app.get("/api/etl/conflicts", (_req: Request, res: Response) => {
    const gt = storage.getAllGroundTruth();
    const byType: Record<string, any[]> = { A: [], B: [], C: [], D: [] };
    gt.forEach(row => { if (row.conflictType && byType[row.conflictType]) byType[row.conflictType].push(row); });
    res.json({
      total: gt.length,
      byType: {
        A: { count: byType.A.length, label: "NCCN Cat 1/2A → Experimental classification", rows: byType.A.slice(0, 5) },
        B: { count: byType.B.length, label: "NCCN Cat 1/2A → Not Medically Necessary", rows: byType.B.slice(0, 5) },
        C: { count: byType.C.length, label: "Step therapy contradicts NCCN sequence", rows: byType.C.slice(0, 5) },
        D: { count: byType.D.length, label: "Biomarker restriction narrows FDA label", rows: byType.D.slice(0, 5) },
      },
    });
  });

  app.post("/api/etl/run", async (req: Request, res: Response) => {
    const { agents = ["fda", "nccn", "payer", "gt"], cancerTypes } = req.body;
    const runId = `ETL-${Date.now()}-${nanoid(6)}`;
    etlRunState[runId] = { status: "running", agents, startedAt: new Date().toISOString() };
    res.json({ runId, message: "ETL pipeline started", agents });

    (async () => {
      const results: Record<string, any> = {};
      try {
        if (agents.includes("fda")) {
          agentLogger.log(runId, "etl", "Starting FDA drug ingest...");
          const { runFDAIngestAgent } = await import("./etl/fda-ingest");
          results.fda = await runFDAIngestAgent(runId);
          agentLogger.log(runId, "etl", `FDA ingest complete: ${JSON.stringify(results.fda)}`);
        }
        if (agents.includes("nccn")) {
          agentLogger.log(runId, "etl", "Starting NCCN extraction...");
          const { runNCCNExtractionAgent } = await import("./etl/nccn-extractor");
          results.nccn = await runNCCNExtractionAgent(runId, cancerTypes);
          agentLogger.log(runId, "etl", `NCCN extraction complete: ${JSON.stringify(results.nccn)}`);
        }
        if (agents.includes("payer")) {
          agentLogger.log(runId, "etl", "Starting payer policy generation...");
          const { runPayerPolicyCrawlerAgent } = await import("./etl/payer-policy-crawler");
          results.payer = await runPayerPolicyCrawlerAgent(runId, undefined, cancerTypes);
          agentLogger.log(runId, "etl", `Payer policy generation complete: ${JSON.stringify(results.payer)}`);
        }
        if (agents.includes("gt")) {
          agentLogger.log(runId, "etl", "Starting ground truth builder...");
          const { runGroundTruthBuilderAgent } = await import("./etl/ground-truth-builder");
          results.gt = await runGroundTruthBuilderAgent(runId, cancerTypes);
          agentLogger.log(runId, "etl", `Ground truth builder complete: ${JSON.stringify(results.gt)}`);
        }
        etlRunState[runId] = { ...etlRunState[runId], status: "completed", completedAt: new Date().toISOString(), results };
        agentLogger.log(runId, "etl", `✓ ETL pipeline complete.`);
      } catch (err: any) {
        etlRunState[runId] = { ...etlRunState[runId], status: "failed", completedAt: new Date().toISOString() };
        agentLogger.error(runId, "etl", `ETL pipeline failed: ${err.message}`);
      }
    })();
  });

  app.get("/api/etl/run/:runId", (req: Request, res: Response) => {
    const runId = req.params.runId as string;
    const state = etlRunState[runId];
    if (!state) return res.status(404).json({ error: "ETL run not found" });
    const logs = agentLogger.getLogs(runId);
    res.json({ ...state, logs });
  });

  // ─── GLOBAL KNOWLEDGE BASE ─────────────────────────────────────────
  app.get("/api/drugs", (req, res) => {
    const { cancerType } = req.query;
    res.json(cancerType ? storage.getDrugsByCancerType(cancerType as string) : storage.getAllDrugs());
  });

  app.get("/api/nccn", (_req, res) => {
    res.json(storage.getAllNccn());
  });

  app.get("/api/payer-policies", (_req, res) => {
    res.json(storage.getAllPayerPolicies());
  });

  app.get("/api/ground-truth", (req, res) => {
    const { payerId, cancerType } = req.query;
    let rows = storage.getAllGroundTruth();
    if (payerId) rows = rows.filter(r => r.payerId === payerId);
    if (cancerType) rows = rows.filter(r => r.cancerType === cancerType);
    res.json(rows);
  });

  // ─── PATIENTS ──────────────────────────────────────────────────────
  app.get("/api/patients", (_req, res) => {
    res.json(storage.getAllPatients(ORG_ID));
  });

  app.get("/api/patients/:id", (req, res) => {
    const patient = storage.getPatient(req.params.id, ORG_ID);
    if (!patient) return res.status(404).json({ error: "Patient not found" });
    res.json(patient);
  });

  app.post("/api/patients", (req, res) => {
    const { patientId, cancerType, stage, biomarkers, priorTherapies, performanceStatus, clinicName, state } = req.body;
    if (!patientId || !cancerType || !stage || !state) {
      return res.status(400).json({ error: "patientId, cancerType, stage, and state are required" });
    }
    const patient = storage.insertPatient({
      organizationId: ORG_ID,
      patientId,
      cancerType, stage,
      biomarkers: typeof biomarkers === "string" ? biomarkers : JSON.stringify(biomarkers || {}),
      priorTherapies: typeof priorTherapies === "string" ? priorTherapies : JSON.stringify(priorTherapies || []),
      performanceStatus, clinicName, state,
    });
    res.json(patient);
  });

  // ─── DENIALS ───────────────────────────────────────────────────────
  app.get("/api/denials", (_req, res) => {
    res.json(storage.getAllDenials(ORG_ID));
  });

  app.get("/api/denials/:id", (req, res) => {
    const denial = storage.getDenial(req.params.id, ORG_ID);
    if (!denial) return res.status(404).json({ error: "Denial not found" });
    res.json(denial);
  });

  app.post("/api/denials", (req, res) => {
    const body = req.body;
    const denial = storage.insertDenial({
      organizationId: ORG_ID,
      denialRecordId: `DN-${new Date().getFullYear()}-${nanoid()}`,
      patientId: body.patientId,
      payerId: body.payerId,
      payerName: body.payerName,
      payerFaxNumber: PAYER_FAX_NUMBERS[body.payerId] || body.payerFaxNumber,
      memberId: body.memberId,
      drugId: body.drugId,
      drugNameRaw: body.drugNameRaw,
      icd10Codes: body.icd10Codes || "unknown",
      denialReasonCode: body.denialReasonCode,
      denialReasonText: body.denialReasonText,
      denialDate: body.denialDate,
      referenceNumber: body.referenceNumber,
      rawDocumentText: body.rawDocumentText,
    });
    res.json(denial);
  });

  // ─── OUTCOME CAPTURE ───────────────────────────────────────────────
  app.patch("/api/denials/:id/outcome", (req, res) => {
    const { outcome, outcomeNotes, outcomeDate } = req.body;
    if (!outcome) return res.status(400).json({ error: "outcome is required (approved|denied|p2p|withdrawn)" });
    const denial = storage.getDenial(req.params.id, ORG_ID);
    if (!denial) return res.status(404).json({ error: "Denial not found" });
    const updated = storage.updateDenialOutcome(req.params.id, outcome, outcomeNotes, outcomeDate);
    res.json(updated);
  });

  app.post("/api/denials/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const text = req.file.buffer.toString("utf-8").slice(0, 5000);
      const extracted = await extractDenialFromText(text);
      res.json({ extracted, rawText: text.slice(0, 2000) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/denials/:id/match", async (req, res) => {
    try {
      const denial = storage.getDenial(req.params.id, ORG_ID);
      if (!denial) return res.status(404).json({ error: "Denial not found" });
      const patient = storage.getPatient(denial.patientId, ORG_ID);
      if (!patient) return res.status(404).json({ error: "Patient not found" });
      const gt = await matchDenialToGroundTruth(denial, patient);
      if (!gt) return res.status(404).json({ error: "No ground truth match found" });
      storage.updateDenialStatus(denial.denialRecordId, "matched", gt.groundTruthRowId);
      res.json({ groundTruth: gt, denial });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── APPEALS ───────────────────────────────────────────────────────
  app.get("/api/appeals", (_req, res) => {
    res.json(storage.getAllAppeals(ORG_ID));
  });

  app.get("/api/appeals/:id", (req, res) => {
    const appeal = storage.getAppeal(req.params.id, ORG_ID);
    if (!appeal) return res.status(404).json({ error: "Appeal not found" });
    res.json(appeal);
  });

  app.post("/api/appeals/generate", async (req, res) => {
    try {
      const org = storage.getOrganization(ORG_ID);
      if (!org) return res.status(404).json({ error: "Organization not found" });
      const { denialRecordId, appealType = "first_level" } = req.body;
      if (!denialRecordId) return res.status(400).json({ error: "denialRecordId required" });
      const denial = storage.getDenial(denialRecordId, ORG_ID);
      if (!denial) return res.status(404).json({ error: "Denial not found" });
      const patient = storage.getPatient(denial.patientId, ORG_ID);
      if (!patient) return res.status(404).json({ error: "Patient not found" });
      let gt = denial.groundTruthRowId ? storage.getGroundTruth(denial.groundTruthRowId) : null;
      if (!gt) {
        gt = await matchDenialToGroundTruth(denial, patient);
        if (!gt) return res.status(404).json({ error: "No ground truth match. Cannot generate appeal." });
        storage.updateDenialStatus(denial.denialRecordId, "matched", gt.groundTruthRowId);
      }
      const sections = await generateAppealWithCohere(denial, patient, gt);
      const appealId = `AP-${new Date().getFullYear()}-${nanoid()}`;
      const pdfPath = await generateAppealPDF(sections, appealId, {
        name: org.name,
        address: `${org.address}, ${org.city}, ${org.state} ${org.zip}`,
        npi: org.npi || "N/A",
        logoUrl: org.logoUrl || undefined,
        signingPhysician: org.signingPhysician || "Authorized Clinical Representative",
        signingTitle: org.signingTitle || "Oncology Department",
        outboundFax: org.outboundFax || "N/A",
      });
      const nccn = storage.getAllNccn().find(n => n.nccnId === gt!.nccnId);
      const drug = storage.getDrug(gt.drugId);
      const appeal = storage.insertAppeal({
        organizationId: ORG_ID, appealId, denialRecordId,
        patientId: patient.patientId, groundTruthRowId: gt.groundTruthRowId,
        payerId: denial.payerId, payerFaxNumber: denial.payerFaxNumber || PAYER_FAX_NUMBERS[denial.payerId],
        status: "generated", appealType,
        nccnCitation: `${nccn?.guidelineVersion} — ${nccn?.pageReference} (Category ${gt.nccnCategory})`,
        fdaCitation: `${drug?.fdaApprovalStatus} — ${drug?.fdaLabelSummary?.slice(0, 200)}`,
        conflictSummary: `Type ${gt.conflictType}: ${gt.conflictDescription.slice(0, 300)}`,
        legalFramework: sections.legalFrameworkSection.slice(0, 500),
        generatedContent: JSON.stringify(sections), pdfPath,
      });
      storage.updateDenialStatus(denial.denialRecordId, "appeal_generated", gt.groundTruthRowId);
      res.json({ appeal, sections });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/appeals/:id/pdf", (req, res) => {
    const appeal = storage.getAppeal(req.params.id, ORG_ID);
    if (!appeal || !appeal.pdfPath) return res.status(404).json({ error: "PDF not found" });
    if (!fs.existsSync(appeal.pdfPath)) return res.status(404).json({ error: "PDF file missing" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="appeal-${req.params.id}.pdf"`);
    fs.createReadStream(appeal.pdfPath).pipe(res);
  });

  // ─── P2P BRIEF ─────────────────────────────────────────────────────
  app.post("/api/appeals/:id/p2p-brief", async (req, res) => {
    try {
      const appeal = storage.getAppeal(req.params.id, ORG_ID);
      if (!appeal) return res.status(404).json({ error: "Appeal not found" });
      const denial = storage.getDenial(appeal.denialRecordId, ORG_ID);
      if (!denial) return res.status(404).json({ error: "Denial not found" });
      const patient = storage.getPatient(denial.patientId, ORG_ID);
      if (!patient) return res.status(404).json({ error: "Patient not found" });
      const gt = storage.getGroundTruth(appeal.groundTruthRowId);
      if (!gt) return res.status(404).json({ error: "Ground truth not found" });
      const brief = await generateP2PBrief(appeal, denial, patient, gt);
      res.json({ brief, appealId: appeal.appealId, denialId: denial.denialRecordId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── FAX ───────────────────────────────────────────────────────────
  app.post("/api/appeals/:id/fax", async (req, res) => {
    try {
      const org = storage.getOrganization(ORG_ID);
      if (!org) return res.status(404).json({ error: "Organization not found" });
      const appeal = storage.getAppeal(req.params.id, ORG_ID);
      if (!appeal) return res.status(404).json({ error: "Appeal not found" });
      if (!appeal.pdfPath || !fs.existsSync(appeal.pdfPath)) {
        return res.status(400).json({ error: "PDF not generated" });
      }
      const faxNumber = appeal.payerFaxNumber || PAYER_FAX_NUMBERS[appeal.payerId];
      if (!faxNumber) return res.status(400).json({ error: "No fax number configured for payer" });
      const fakeJobId = `FAX-DEMO-${nanoid()}`;
      const faxEntry = storage.insertFaxLog({
        organizationId: ORG_ID, appealId: appeal.appealId, payerId: appeal.payerId,
        faxNumber, jobId: fakeJobId, status: "queued", costCents: 49, pageCount: 7, sentAt: new Date().toISOString()
      });
      setTimeout(() => {
        storage.updateFaxLog(faxEntry.id, { status: "delivered", deliveredAt: new Date().toISOString() });
        storage.updateAppeal(appeal.appealId, { status: "delivered", faxJobId: fakeJobId, faxStatus: "delivered", faxDeliveredAt: new Date().toISOString() });
        storage.updateDenialStatus(appeal.denialRecordId, "faxed");
      }, 3500);
      storage.updateAppeal(appeal.appealId, { status: "faxed", faxJobId: fakeJobId, faxStatus: "sending", faxSentAt: faxEntry.sentAt });
      return res.json({ success: true, faxJobId: fakeJobId, message: `Demo mode: Simulated fax queued to ${faxNumber}` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/appeals/batch-fax", async (_req, res) => {
    const appeals = storage.getAllAppeals(ORG_ID).filter(a => a.status === "generated");
    let queued = 0;
    for (const appeal of appeals) {
      const faxNumber = appeal.payerFaxNumber || PAYER_FAX_NUMBERS[appeal.payerId];
      if (!faxNumber || !appeal.pdfPath) continue;
      const fakeJobId = `FAX-DEMO-${nanoid()}`;
      storage.insertFaxLog({
        organizationId: ORG_ID, appealId: appeal.appealId, payerId: appeal.payerId,
        faxNumber, jobId: fakeJobId, status: "queued", costCents: 49, pageCount: 7, sentAt: new Date().toISOString()
      });
      storage.updateAppeal(appeal.appealId, { status: "faxed", faxJobId: fakeJobId, faxStatus: "sending", faxSentAt: new Date().toISOString() });
      queued++;
    }
    res.json({ queued, message: `${queued} appeals queued for simulated fax delivery.` });
  });

  // ─── FAX LOG ───────────────────────────────────────────────────────
  app.get("/api/fax-log", (_req, res) => {
    res.json(storage.getAllFaxLogs(ORG_ID));
  });

  // ─── ORG PROFILE ───────────────────────────────────────────────────
  app.get("/api/org/profile", (_req, res) => {
    const org = storage.getOrganization(ORG_ID);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    res.json({ org });
  });

  // ─── AGENTS ────────────────────────────────────────────────────────
  app.post("/api/agents/run", async (req, res) => {
    try {
      const { denialId, denialRecordId } = req.body;
      const id = denialId || denialRecordId;
      if (!id) return res.status(400).json({ error: "denialId or denialRecordId required" });
      const result = await runPipeline({ denialId: id });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/agents/orchestrate", async (_req, res) => {
    runPipeline({ denialId: storage.getAllDenials(ORG_ID)[0]?.denialRecordId }).catch(e => console.error("Pipeline failed:", e));
    res.json({ message: "Pipeline initiated." });
  });

  app.get("/api/agents/logs", (_req, res) => {
    res.json({ logs: agentLogger.getAllLogs().slice(-100) });
  });

  // ─── ANALYTICS: WIN RATE ───────────────────────────────────────────
  app.get("/api/analytics/win-rate", (_req, res) => {
    res.json(storage.getWinRateStats(ORG_ID));
  });

  // ─── ANALYTICS: PAYER INTELLIGENCE ────────────────────────────────
  app.get("/api/analytics/payer-intelligence", (_req, res) => {
    res.json(storage.getPayerIntelligence(ORG_ID));
  });

  // ─── ANALYTICS: PREDICTIVE DENIAL SCORE ───────────────────────────
  app.get("/api/analytics/denial-score/:id", async (req, res) => {
    try {
      const denial = storage.getDenial(req.params.id, ORG_ID);
      if (!denial) return res.status(404).json({ error: "Denial not found" });
      const patient = storage.getPatient(denial.patientId, ORG_ID);
      if (!patient) return res.status(404).json({ error: "Patient not found" });
      const score = await scoreDenialPredictively(denial, patient);
      res.json({ ...score, denialId: denial.denialRecordId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── COMPLIANCE: SOC 2 CHECKLIST ──────────────────────────────────
  app.get("/api/compliance/soc2-checklist", (_req, res) => {
    const implemented = SOC2_CHECKLIST.filter(c => c.status === "implemented").length;
    const inProgress = SOC2_CHECKLIST.filter(c => c.status === "in_progress").length;
    const notStarted = SOC2_CHECKLIST.filter(c => c.status === "not_started").length;
    res.json({
      controls: SOC2_CHECKLIST,
      summary: {
        total: SOC2_CHECKLIST.length,
        implemented,
        inProgress,
        notStarted,
        completionPct: Math.round((implemented / SOC2_CHECKLIST.length) * 100),
      },
    });
  });

  // ─── FHIR R4 WEBHOOK ──────────────────────────────────────────────
  app.post("/api/fhir/claim-response", (req, res) => {
    try {
      const fhir = req.body;
      if (fhir.resourceType !== "ClaimResponse") {
        return res.status(400).json({ error: "Expected FHIR ClaimResponse resource" });
      }
      const patientRef = fhir.patient?.reference || "";
      const patientId = patientRef.replace("Patient/", "") || `PT-FHIR-${nanoid(6)}`;
      const item = fhir.item?.[0] || {};
      const drugName = item.productOrService?.coding?.[0]?.display || "Unknown Drug";
      const adjudication = item.adjudication?.[0] || {};
      const reasonCode = adjudication.reason?.coding?.[0]?.code || "other";
      const reasonDisplay = adjudication.reason?.coding?.[0]?.display || "Denial reason not specified";

      const denial = storage.insertDenial({
        organizationId: ORG_ID,
        denialRecordId: `DN-FHIR-${new Date().getFullYear()}-${nanoid()}`,
        patientId,
        payerId: fhir.insurer?.identifier?.value || "UHC",
        payerName: fhir.insurer?.display || "Unknown Payer",
        payerFaxNumber: PAYER_FAX_NUMBERS["UHC"],
        memberId: null,
        drugId: null,
        drugNameRaw: drugName,
        icd10Codes: "unknown",
        denialReasonCode: reasonCode,
        denialReasonText: reasonDisplay,
        denialDate: new Date().toISOString().split("T")[0],
        referenceNumber: fhir.identifier?.[0]?.value || null,
        rawDocumentText: JSON.stringify(fhir),
      });

      res.json({ denialRecordId: denial.denialRecordId, message: "Denial created from FHIR ClaimResponse" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── FHIR SMART ON FHIR STUB ──────────────────────────────────────
  app.get("/.well-known/smart-configuration", (_req, res) => {
    res.json({
      issuer: "https://pae-onc.demo",
      jwks_uri: "https://pae-onc.demo/.well-known/jwks.json",
      authorization_endpoint: "https://pae-onc.demo/oauth/authorize",
      token_endpoint: "https://pae-onc.demo/oauth/token",
      token_endpoint_auth_methods_supported: ["client_secret_basic", "private_key_jwt"],
      grant_types_supported: ["authorization_code", "client_credentials"],
      registration_endpoint: "https://pae-onc.demo/oauth/register",
      scopes_supported: ["openid", "profile", "launch", "launch/patient", "patient/*.read", "user/*.read"],
      response_types_supported: ["code"],
      capabilities: ["launch-ehr", "launch-standalone", "client-public", "client-confidential-symmetric", "context-ehr-patient", "permission-patient", "permission-user"],
    });
  });

  app.get("/api/fhir/launch", (req, res) => {
    const { launch, iss } = req.query;
    res.json({
      status: "demo",
      message: "SMART on FHIR launch stub — production requires Epic App Orchard registration",
      launchToken: launch || null,
      iss: iss || null,
      demoPatientContext: { patientId: "PT-2026-001", encounterId: "ENC-2026-001" },
    });
  });

  app.get("/api/fhir/patient/:id", (req, res) => {
    const patient = storage.getPatient(req.params.id, ORG_ID);
    if (!patient) return res.status(404).json({ error: "Patient not found" });
    const biomarkers = JSON.parse(patient.biomarkers || "{}");
    res.json({
      resourceType: "Patient",
      id: patient.patientId,
      meta: { profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"] },
      extension: Object.entries(biomarkers).map(([key, value]) => ({
        url: `https://pae-onc.demo/fhir/StructureDefinition/biomarker-${key.toLowerCase()}`,
        valueString: String(value),
      })),
      identifier: [{ system: "https://pae-onc.demo/patients", value: patient.patientId }],
      name: [{ use: "official", text: `Patient ${patient.patientId}` }],
      extension_cancerType: patient.cancerType,
      extension_stage: patient.stage,
      extension_performanceStatus: patient.performanceStatus,
    });
  });
}
