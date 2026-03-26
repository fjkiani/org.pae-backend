import type { Express, Request, Response } from "express";
import type { Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import { storage } from "./storage";
import { ensureDemoOrg, PAYER_FAX_NUMBERS, DEMO_ORG_ID } from "./seed";
import { matchDenialToGroundTruth, generateAppealWithCohere, extractDenialFromText } from "./cohere-engine";
import { generateAppealPDF } from "./pdf-generator";
import { agentLogger } from "./agents/logger";
import { runPipeline } from "./agents/orchestrator";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function nanoid(len = 8) {
  return Math.random().toString(36).slice(2, 2 + len).toUpperCase();
}

// In demo/stateless mode every request uses DEMO_ORG_ID.
// Auth is only added when PAE-Onc is deployed as its own standalone SaaS.
const ORG_ID = DEMO_ORG_ID;

export async function registerRoutes(httpServer: Server, app: Express) {

  // Seed demo org on startup (idempotent)
  await ensureDemoOrg();

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", mode: "demo", orgId: ORG_ID });
  });

  // ─── STATS ─────────────────────────────────────────────────────────
  app.get("/api/stats", (_req, res) => {
    res.json(storage.getStats(ORG_ID));
  });

  // ─── GLOBAL KNOWLEDGE BASE (no org scope) ──────────────────────────
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

  app.post("/api/patients", (req, res) => {
    const { patientId, cancerType, stage, biomarkers, priorTherapies, performanceStatus, clinicName, state } = req.body;
    if (!patientId || !cancerType || !stage || !state) {
      return res.status(400).json({ error: "patientId, cancerType, stage, and state are required" });
    }
    const patient = storage.insertPatient({
      organizationId: ORG_ID,
      patientId: patientId || `PT-${nanoid()}`,
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

      // Generate text with Cohere
      const sections = await generateAppealWithCohere(denial, patient, gt);
      const appealId = `AP-${new Date().getFullYear()}-${nanoid()}`;

      // Generate PDF injecting the tenant branding
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
        organizationId: ORG_ID,
        appealId,
        denialRecordId,
        patientId: patient.patientId,
        groundTruthRowId: gt.groundTruthRowId,
        payerId: denial.payerId,
        payerFaxNumber: denial.payerFaxNumber || PAYER_FAX_NUMBERS[denial.payerId],
        status: "generated",
        appealType,
        nccnCitation: `${nccn?.guidelineVersion} — ${nccn?.pageReference} (Category ${gt.nccnCategory})`,
        fdaCitation: `${drug?.fdaApprovalStatus} — ${drug?.fdaLabelSummary?.slice(0, 200)}`,
        conflictSummary: `Type ${gt.conflictType}: ${gt.conflictDescription.slice(0, 300)}`,
        legalFramework: sections.legalFrameworkSection.slice(0, 500),
        generatedContent: JSON.stringify(sections),
        pdfPath: pdfPath,
      });

      storage.updateDenialStatus(denial.denialRecordId, "appeal_generated", gt.groundTruthRowId);

      res.json({ appeal, sections });
    } catch (err: any) {
      console.error("Appeal generation error:", err);
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


  // ─── FAX DELIVERY (Simulated in demo mode) ────────────────────────
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

      // Demo mode: simulate fax delivery
      const fakeJobId = `FAX-DEMO-${nanoid()}`;
      const faxEntry = storage.insertFaxLog({
        organizationId: ORG_ID, appealId: appeal.appealId, payerId: appeal.payerId,
        faxNumber, jobId: fakeJobId, status: "queued", costCents: 49, pageCount: 7, sentAt: new Date().toISOString()
      });

      // Simulate delivery after 3.5 seconds
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

  // Batch fax all generated appeals
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


  // ─── AGENTS (Orchestration & ETL) ──────────────────────────────────
  app.post("/api/agents/orchestrate", async (_req, res) => {
    runPipeline().catch(e => console.error("Pipeline failed:", e));
    res.json({ message: "Enterprise ETL Pipeline initiated." });
  });

  app.get("/api/agents/logs", (_req, res) => {
    res.json({ logs: agentLogger.getLogs().slice(-100) });
  });
}
