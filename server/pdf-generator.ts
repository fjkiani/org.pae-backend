import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { AppealSections } from "./cohere-engine";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Color palette — medical/legal professional
const COLORS = {
  primary: "#0F4C81",       // deep navy
  accent: "#C8102E",        // alert red for critical statements
  headingBg: "#1A5276",     // section header bg
  lightBg: "#F0F4F8",       // light section bg
  border: "#BDC3C7",
  text: "#2C3E50",
  muted: "#7F8C8D",
  white: "#FFFFFF",
  gold: "#B7950B",          // citation highlight
};

export interface OrgInfo {
  name: string;
  address: string;
  npi: string;
  logoUrl?: string;
  signingPhysician: string;
  signingTitle: string;
  outboundFax: string;
}

export async function generateAppealPDF(
  sections: AppealSections,
  appealId: string,
  _orgInfo?: OrgInfo
): Promise<string> {
  return new Promise((resolve, reject) => {
    const filePath = path.join(UPLOAD_DIR, `appeal-${appealId}.pdf`);
    const doc = new PDFDocument({ size: "LETTER", margins: { top: 72, bottom: 72, left: 72, right: 72 } });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const W = doc.page.width - 144; // usable width
    const cd = sections.coverPageData;

    // ─── COVER PAGE ──────────────────────────────────────────────────
    // Header bar
    doc.rect(0, 0, doc.page.width, 8).fill(COLORS.primary);

    // Logo / org name
    doc.moveDown(1);
    doc.fontSize(22).font("Helvetica-Bold").fillColor(COLORS.primary)
      .text("PRIOR AUTHORIZATION APPEAL", 72, 60, { align: "center" });
    doc.fontSize(12).font("Helvetica").fillColor(COLORS.muted)
      .text("Formal Medical Appeal — Oncology", { align: "center" });

    doc.moveDown(2);

    // Info box
    const boxY = doc.y;
    doc.roundedRect(72, boxY, W, 200, 4).fillAndStroke(COLORS.lightBg, COLORS.border);
    doc.fillColor(COLORS.text);

    const infoLeft = 90;
    const infoRight = 310;
    const lineH = 22;
    let y = boxY + 16;

    const fields = [
      ["TO:", `${cd.payerName} — ${cd.medicalDirectorDept}`],
      ["DATE:", cd.date],
      ["RE: Drug:", cd.drugName],
      ["Denial Type:", cd.denialReasonCode.toUpperCase()],
      ["Reference #:", cd.referenceNumber],
      ["Patient ID:", cd.patientId],
      ["Member ID:", cd.memberId],
    ];

    fields.forEach(([label, value]) => {
      doc.fontSize(9).font("Helvetica-Bold").fillColor(COLORS.muted).text(label, infoLeft, y, { continued: false });
      doc.fontSize(9).font("Helvetica").fillColor(COLORS.text).text(value, infoRight, y);
      y += lineH;
    });

    doc.y = boxY + 215;
    doc.moveDown(1);

    // Urgency banner
    doc.rect(72, doc.y, W, 36).fill(COLORS.accent);
    doc.fontSize(11).font("Helvetica-Bold").fillColor(COLORS.white)
      .text("⚠  URGENT ONCOLOGY APPEAL — LIFE-SAVING TREATMENT AT ISSUE  ⚠", 72, doc.y - 28, { align: "center" });
    doc.moveDown(2.5);

    // Attachments list
    sectionHeader(doc, "ATTACHMENTS ENCLOSED", W);
    sections.attachmentsList.forEach((att, i) => {
      doc.fontSize(10).font("Helvetica").fillColor(COLORS.text)
        .text(`  ${i + 1}. ${att}`, { indent: 12 });
    });

    doc.moveDown(1);
    footer(doc, 1);
    doc.addPage();

    // ─── EXECUTIVE SUMMARY ───────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 8).fill(COLORS.primary);
    sectionHeader(doc, "I. EXECUTIVE SUMMARY", W, 30);
    renderBody(doc, sections.executiveSummary, W);
    footer(doc, 2);
    doc.addPage();

    // ─── CLINICAL BACKGROUND ─────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 8).fill(COLORS.primary);
    sectionHeader(doc, "II. CLINICAL BACKGROUND", W, 30);
    renderBody(doc, sections.clinicalBackground, W);
    footer(doc, 3);
    doc.addPage();

    // ─── NCCN / FDA ───────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 8).fill(COLORS.primary);
    sectionHeader(doc, "III. NCCN & FDA GROUND TRUTH — CLINICAL STANDARDS", W, 30);
    renderBody(doc, sections.nccnFdaSection, W);

    // Citation box
    doc.moveDown(1);
    const citY = doc.y;
    doc.roundedRect(72, citY, W, 56, 4).fillAndStroke("#FEF9E7", COLORS.gold);
    doc.fontSize(9).font("Helvetica-BoldOblique").fillColor(COLORS.gold)
      .text("▶  NCCN CITATION", 84, citY + 8);
    doc.fontSize(9).font("Helvetica").fillColor(COLORS.text)
      .text(sections.attachmentsList[0], 84, citY + 22, { width: W - 24 });
    doc.y = citY + 64;

    footer(doc, 4);
    doc.addPage();

    // ─── PAYER CONTRADICTION ──────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 8).fill(COLORS.primary);
    sectionHeader(doc, "IV. PAYER POLICY CONTRADICTION ANALYSIS", W, 30);
    renderBody(doc, sections.payerContradictionSection, W);
    footer(doc, 5);
    doc.addPage();

    // ─── LEGAL FRAMEWORK ─────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 8).fill(COLORS.primary);
    sectionHeader(doc, "V. LEGAL FRAMEWORK & BAD-FAITH ANALYSIS", W, 30);
    renderBody(doc, sections.legalFrameworkSection, W);

    // Legal callout
    doc.moveDown(1);
    const legY = doc.y;
    doc.roundedRect(72, legY, W, 68, 4).fillAndStroke("#FDEDEC", COLORS.accent);
    doc.fontSize(9.5).font("Helvetica-Bold").fillColor(COLORS.accent)
      .text("NOTICE TO MEDICAL DIRECTOR:", 84, legY + 10);
    doc.fontSize(9.5).font("Helvetica").fillColor(COLORS.accent)
      .text("Continued denial of this FDA-approved, NCCN Category 1 therapy constitutes bad-faith delay of life-saving oncology treatment. This notice serves as formal documentation of bad-faith practices under applicable state and federal law.", 84, legY + 26, { width: W - 24 });
    doc.y = legY + 76;

    footer(doc, 6);
    doc.addPage();

    // ─── REQUESTED RESOLUTION ─────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 8).fill(COLORS.primary);
    sectionHeader(doc, "VI. REQUESTED RESOLUTION", W, 30);
    renderBody(doc, sections.requestedResolution, W);

    doc.moveDown(2);
    doc.fontSize(10).font("Helvetica-Bold").fillColor(COLORS.primary)
      .text("Respectfully submitted,", { align: "left" });
    doc.moveDown(1.5);
    doc.text("Authorized Clinical Representative", { align: "left" });
    doc.moveDown(0.5);
    doc.fontSize(9).font("Helvetica").fillColor(COLORS.muted)
      .text(`Generated by PAE-Onc Appeal Engine | ${new Date().toISOString()} | Appeal ID: ${appealId}`);

    footer(doc, 7);

    doc.end();
    stream.on("finish", () => resolve(filePath));
    stream.on("error", reject);
  });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function sectionHeader(doc: PDFKit.PDFDocument, title: string, W: number, topOffset = 20) {
  const y = doc.y + topOffset;
  doc.rect(72, y, W, 28).fill(COLORS.headingBg);
  doc.fontSize(11).font("Helvetica-Bold").fillColor(COLORS.white)
    .text(title, 84, y + 8, { width: W - 24 });
  doc.y = y + 36;
  doc.moveDown(0.5);
}

function renderBody(doc: PDFKit.PDFDocument, text: string, W: number) {
  const paragraphs = text.split(/\n\n+/);
  paragraphs.forEach((para, i) => {
    if (!para.trim()) return;
    doc.fontSize(10).font("Helvetica").fillColor(COLORS.text)
      .text(para.trim(), 72, doc.y, { width: W, align: "justify", lineGap: 2 });
    if (i < paragraphs.length - 1) doc.moveDown(0.8);
  });
  doc.moveDown(0.5);
}

function footer(doc: PDFKit.PDFDocument, page: number) {
  const y = doc.page.height - 50;
  doc.rect(0, y - 4, doc.page.width, 1).fill(COLORS.border);
  doc.fontSize(8).font("Helvetica").fillColor(COLORS.muted)
    .text(`PAE-Onc — Prior Authorization Appeal Engine | CONFIDENTIAL — HIPAA Protected | Page ${page}`,
      72, y + 4, { align: "center", width: doc.page.width - 144 });
}
