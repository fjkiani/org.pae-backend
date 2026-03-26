import { CohereClient } from "cohere-ai";
import { storage } from "./storage";
import { DenialRecord, PatientProfile, GroundTruth } from "@shared/schema";

const cohere = new CohereClient({ token: "lfWaRwjaOdTuZEOlP2uLFyFMTWcDfM0EtLLQZl7Q" });

// ─── BAD-FAITH STATUTES BY STATE ──────────────────────────────────────────────
export const BAD_FAITH_STATUTES: Record<string, string> = {
  NY: "New York Insurance Law § 2601 (unfair settlement practices) and NY Public Health Law § 4903 (utilization review requiring medically necessary care approval within 72 hours for urgent requests)",
  CA: "California Insurance Code § 790.03 (unfair claims settlement practices) and California Health & Safety Code § 1367.01 (independent medical review rights for experimental denials)",
  NJ: "New Jersey Insurance Fair Conduct Act (NJSA 17:29B-4) prohibiting unreasonable denial of benefits contrary to clinical evidence",
  TX: "Texas Insurance Code Chapter 541 (unfair insurance practices) and TX Health & Safety Code § 4201 (utilization review agent standards requiring evidence-based criteria)",
  FL: "Florida Statutes § 627.604 (insurance bad faith) and FL Statutes § 627.6131 (claim payment requirements for health insurers)",
  PA: "Pennsylvania Bad Faith Statute (42 Pa. C.S. § 8371) allowing punitive damages for bad-faith denial of insurance benefits",
  IL: "Illinois Insurance Code 215 ILCS 5/155 (bad faith claims handling) and IL Compiled Statutes § 356z.3 (step therapy exemptions for cancer patients)",
  MA: "Massachusetts General Laws Chapter 176O § 13 (utilization review — written decisions citing clinical criteria) and MGL Chapter 93A (consumer protection for unfair trade practices)",
  DEFAULT: "applicable state insurance bad-faith statutes and ERISA § 502(a)(1)(B) (29 U.S.C. § 1132) providing right to recover wrongfully denied plan benefits",
};

// ─── APPEAL SECTIONS TYPES ────────────────────────────────────────────────────
export interface AppealSections {
  executiveSummary: string;
  clinicalBackground: string;
  nccnFdaSection: string;
  payerContradictionSection: string;
  legalFrameworkSection: string;
  requestedResolution: string;
  coverPageData: {
    payerName: string;
    medicalDirectorDept: string;
    patientId: string;
    memberId: string;
    referenceNumber: string;
    date: string;
    drugName: string;
    denialReasonCode: string;
  };
  attachmentsList: string[];
}

// ─── MATCH DENIAL TO GROUND TRUTH ─────────────────────────────────────────────
export async function matchDenialToGroundTruth(denial: DenialRecord, patient: PatientProfile): Promise<GroundTruth | null> {
  // First try exact match
  const gtRows = storage.getAllGroundTruth();
  const candidates = gtRows.filter(gt =>
    gt.payerId === denial.payerId &&
    (denial.drugId ? gt.drugId === denial.drugId : true) &&
    gt.cancerType === patient.cancerType
  );

  if (candidates.length > 0) {
    // Score by denial reason match too
    const scored = candidates.map(gt => {
      let score = 0;
      if (gt.drugId === denial.drugId) score += 10;
      if (gt.denialRationaleType === denial.denialReasonCode) score += 5;
      if (gt.cancerType === patient.cancerType) score += 3;
      return { gt, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0].gt;
  }

  // Fuzzy fallback — use any GT row matching cancer type + payer
  const fuzzy = gtRows.filter(gt => gt.payerId === denial.payerId || gt.cancerType === patient.cancerType);
  if (fuzzy.length > 0) return fuzzy[0];

  return null;
}

// ─── GENERATE APPEAL WITH COHERE ─────────────────────────────────────────────
export async function generateAppealWithCohere(
  denial: DenialRecord,
  patient: PatientProfile,
  gt: GroundTruth
): Promise<AppealSections> {
  const drug = storage.getDrug(gt.drugId);
  const nccn = Array.from(storage.getAllNccn()).find(n => n.nccnId === gt.nccnId);
  const payerPolicies = storage.getPayerPolicy(gt.payerId, gt.drugId);
  const policy = payerPolicies[0];
  const statute = BAD_FAITH_STATUTES[patient.state] || BAD_FAITH_STATUTES["DEFAULT"];
  const biomarkers = JSON.parse(patient.biomarkers || "{}");
  const priorTherapies = JSON.parse(patient.priorTherapies || "[]");
  const legalTags = JSON.parse(gt.legalExposureTags || "[]");

  const conflictTypeLabels: Record<string, string> = {
    A: "NCCN Category 1/2A drug classified as experimental/investigational despite FDA approval and guideline consensus",
    B: "FDA-approved, NCCN-recommended therapy classified as not medically necessary contrary to regulatory and clinical standards",
    C: "Payer-imposed step therapy sequence contradicts NCCN-recommended treatment sequence and forces clinically inferior prior therapy",
    D: "CMS Transparency in Coverage data reveals systematic prior authorization barriers for NCCN-mandated therapies",
  };

  const prompt = `You are a senior oncology appeals attorney and medical director writing a formal prior authorization appeal letter.

DENIAL INFORMATION:
- Payer: ${denial.payerName} (${denial.payerId})
- Drug Requested: ${denial.drugNameRaw}
- Denial Reason: ${denial.denialReasonCode.replace(/_/g, " ")} — "${denial.denialReasonText}"
- Denial Date: ${denial.denialDate}
- Reference Number: ${denial.referenceNumber}

PATIENT PROFILE:
- Cancer Type: ${patient.cancerType} cancer, ${patient.stage}
- Biomarker Profile: ${JSON.stringify(biomarkers)}
- Prior Therapies: ${priorTherapies.map((t: any) => `${t.drug} (${t.start}–${t.end}, response: ${t.response})`).join("; ") || "None (treatment-naive)"}
- Performance Status: ${patient.performanceStatus || "Not specified"}
- State: ${patient.state}

GROUND TRUTH CONFLICT:
- Conflict Type: ${gt.conflictType} — ${conflictTypeLabels[gt.conflictType] || "Policy-guideline mismatch"}
- Conflict Description: ${gt.conflictDescription}
- NCCN Guideline: ${nccn?.guidelineVersion} — Category ${gt.nccnCategory} — ${nccn?.fullCitationText}
- NCCN Page Reference: ${nccn?.pageReference}
- Payer Policy: ${gt.policyId} (${policy?.policyVersion}) — "${gt.denialTextSnippet}"
- Legal Exposure: ${legalTags.join("; ")}
- FDA Status: ${drug?.fdaApprovalStatus} — ${drug?.fdaLabelSummary}

APPLICABLE LAW: ${statute}

Write ONLY valid JSON (no markdown, no prose outside the JSON) with exactly these fields:
{
  "executiveSummary": "2-3 paragraph professional summary of the appeal. State the drug, indication, denial reason, NCCN category, FDA status, and that this denial constitutes bad-faith delay of life-saving treatment.",
  "clinicalBackground": "3-4 paragraph clinical context. Include cancer type, stage, biomarker profile, prior therapies, and why this drug is the appropriate next treatment. Be specific and cite biomarkers.",
  "nccnFdaSection": "Detailed 3-4 paragraph section citing the exact NCCN guideline version, category, page reference, and full rationale. Include FDA approval details, indication, and supporting trial data.",
  "payerContradictionSection": "3-4 paragraph section quoting and analyzing the payer policy language. Map each denial reason to the specific conflict with NCCN/FDA. Be direct and adversarial.",
  "legalFrameworkSection": "2-3 paragraph section citing ERISA Section 502, state bad-faith statutes, and CMS Transparency in Coverage. Include the key sentence about bad-faith denial of life-saving treatment.",
  "requestedResolution": "1-2 paragraph clear demand for immediate approval and reversal within 72 hours for urgent/expedited or 30 days for standard, with reference to applicable ERISA/plan deadlines."
}`;

  let sections: AppealSections;

  try {
    const response = await cohere.chat({
      model: "command-a-03-2025",
      message: prompt,
      temperature: 0.3,
      maxTokens: 4000,
    });

    const rawText = response.text?.trim() || "";
    // Strip markdown code fences if present
    const jsonStr = rawText.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(jsonStr);

    sections = {
      executiveSummary: parsed.executiveSummary,
      clinicalBackground: parsed.clinicalBackground,
      nccnFdaSection: parsed.nccnFdaSection,
      payerContradictionSection: parsed.payerContradictionSection,
      legalFrameworkSection: parsed.legalFrameworkSection,
      requestedResolution: parsed.requestedResolution,
      coverPageData: {
        payerName: denial.payerName,
        medicalDirectorDept: `${denial.payerName} Medical Director — Prior Authorization Appeals`,
        patientId: patient.patientId,
        memberId: denial.memberId || "On File",
        referenceNumber: denial.referenceNumber || "N/A",
        date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
        drugName: denial.drugNameRaw,
        denialReasonCode: denial.denialReasonCode.replace(/_/g, " "),
      },
      attachmentsList: [
        `NCCN ${nccn?.guidelineVersion} — ${nccn?.pageReference} (${gt.nccnCategory === "1" ? "Category 1" : "Category " + gt.nccnCategory} recommendation)`,
        `FDA Package Insert — ${drug?.brandName} (${drug?.fdaLabelReference})`,
        `Prior Therapy Documentation — ${priorTherapies.length} prior regimens`,
        `Original Denial Notice dated ${denial.denialDate} (Ref: ${denial.referenceNumber})`,
        `Patient Biomarker Report — ${Object.entries(biomarkers).map(([k, v]) => `${k}: ${v}`).join(", ")}`,
      ],
    };
  } catch (err) {
    // Fallback to structured template if Cohere fails
    sections = generateFallbackAppeal(denial, patient, gt, statute);
  }

  return sections;
}

// ─── FALLBACK TEMPLATE ────────────────────────────────────────────────────────
function generateFallbackAppeal(
  denial: DenialRecord,
  patient: PatientProfile,
  gt: GroundTruth,
  statute: string
): AppealSections {
  const drug = storage.getDrug(gt.drugId);
  const nccn = Array.from(storage.getAllNccn()).find(n => n.nccnId === gt.nccnId);

  return {
    executiveSummary: `This appeal requests immediate reversal of ${denial.payerName}'s denial of ${denial.drugNameRaw} for a patient with ${patient.stage} ${patient.cancerType} cancer. The denial, citing "${denial.denialReasonCode.replace(/_/g, " ")}", directly contradicts ${nccn?.guidelineVersion} Category ${gt.nccnCategory} recommendation and FDA approval for this indication.\n\nThe requested therapy is ${drug?.fdaApprovalStatus === "approved" ? "FDA-approved" : "FDA-accelerated approved"} specifically for this patient population. The conflict has been identified as Type ${gt.conflictType}: ${gt.conflictDescription}.\n\nThis denial constitutes bad-faith delay of life-saving oncology treatment and may violate ${statute}.`,
    clinicalBackground: `The patient presents with ${patient.stage} ${patient.cancerType} cancer with the following biomarker profile: ${patient.biomarkers}. Prior therapies include: ${patient.priorTherapies}. Current performance status: ${patient.performanceStatus || "adequate for treatment"}.\n\nGiven the documented disease progression and biomarker profile, ${denial.drugNameRaw} represents the evidence-based, guideline-concordant next line of therapy. No alternative therapies in the same class are available that match this patient's molecular profile.\n\nDelaying access to this therapy risks disease progression, metastatic spread, and irreversible harm to this patient's survival outcomes.`,
    nccnFdaSection: `The ${nccn?.guidelineVersion} — the authoritative oncology treatment standard — designates ${drug?.genericName} as a Category ${gt.nccnCategory} recommendation (${nccn?.recommendationType?.replace(/_/g, " ")}) for this exact indication: ${gt.indication} in patients with biomarker profile ${gt.biomarkerProfile}.\n\n${nccn?.fullCitationText}\n\nFDA approval was granted for ${drug?.fdaLabelSummary} (Reference: ${drug?.fdaLabelReference}). This approval constitutes the highest regulatory standard of evidence for efficacy and safety in this population.\n\nNCC Category 1 indicates uniform consensus based on high-level evidence — there is no credible clinical or scientific basis for the payer's denial classification.`,
    payerContradictionSection: `${denial.payerName} policy ${gt.policyId} states: "${gt.denialTextSnippet}". This language directly contradicts:\n\n1. FDA-approved indication for ${drug?.brandName} covering this exact patient population.\n2. ${nccn?.guidelineVersion} Category ${gt.nccnCategory} recommendation.\n3. The peer-reviewed clinical evidence base underlying both of the above.\n\nConflict type ${gt.conflictType}: ${gt.conflictDescription}\n\nThis denial appears to be a systematic policy that creates coverage barriers for guideline-concordant oncology care — a pattern that has been identified across multiple plans and geographies. Such systematic barriers may constitute bad-faith insurance practices.`,
    legalFrameworkSection: `Under ERISA Section 502(a)(1)(B) (29 U.S.C. § 1132), the patient has the right to recover benefits wrongfully denied under the plan. The plan's denial, which contradicts NCCN Category ${gt.nccnCategory} guidelines and FDA regulatory standards, exceeds the plan's lawful authority to define medical necessity contrary to established clinical evidence.\n\nApplicable state law: ${statute}\n\n"This denial contradicts ${nccn?.guidelineVersion}, ${nccn?.pageReference}. Continued denial constitutes bad-faith delay of life-saving oncology treatment and may constitute a violation of ${statute}."`,
    requestedResolution: `We respectfully demand immediate approval of ${denial.drugNameRaw} for the above-referenced patient and reversal of denial reference ${denial.referenceNumber}. This request should be treated as urgent given the oncologic context.\n\nPer ERISA regulations and applicable state law, a decision must be rendered within 72 hours for urgent/expedited appeals or 30 days for standard appeals. Failure to respond within this timeframe will be treated as a deemed denial and will be escalated to the appropriate state insurance regulatory authority and, if necessary, federal courts.`,
    coverPageData: {
      payerName: denial.payerName,
      medicalDirectorDept: `${denial.payerName} Medical Director — Prior Authorization Appeals`,
      patientId: patient.patientId,
      memberId: denial.memberId || "On File",
      referenceNumber: denial.referenceNumber || "N/A",
      date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      drugName: denial.drugNameRaw,
      denialReasonCode: denial.denialReasonCode.replace(/_/g, " "),
    },
    attachmentsList: [
      `NCCN ${nccn?.guidelineVersion} — ${nccn?.pageReference}`,
      `FDA Package Insert — ${drug?.brandName} (${drug?.fdaLabelReference})`,
      `Prior Therapy Summary`,
      `Original Denial Notice dated ${denial.denialDate}`,
      `Patient Biomarker Report`,
    ],
  };
}

// ─── EXTRACT DENIAL FROM TEXT (Cohere) ────────────────────────────────────────
export async function extractDenialFromText(rawText: string): Promise<Partial<DenialRecord>> {
  const prompt = `Extract structured data from this prior authorization denial notice. Return ONLY valid JSON, no prose.

Denial text:
"""
${rawText.slice(0, 3000)}
"""

Return JSON with exactly these fields (use null for missing):
{
  "payer_name": "payer company name",
  "payer_fax_number": "fax number or null",
  "member_id": "member ID or null",
  "drug_name_raw": "drug brand/generic name",
  "icd10_codes": "comma-separated ICD-10 codes or 'unknown'",
  "denial_reason_code": "one of: step_therapy, experimental, not_medically_necessary, other",
  "denial_reason_text": "full denial reason paragraph",
  "denial_date": "YYYY-MM-DD format or today",
  "reference_number": "PA or claim reference number or null"
}`;

  try {
    const response = await cohere.chat({
      model: "command-a-03-2025",
      message: prompt,
      temperature: 0.1,
      maxTokens: 800,
    });
    const raw = response.text?.trim() || "{}";
    const jsonStr = raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
    return JSON.parse(jsonStr);
  } catch {
    return {};
  }
}
