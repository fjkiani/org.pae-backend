import { CohereClient } from "cohere-ai";
import { storage } from "./storage";
import { DenialRecord, PatientProfile, GroundTruth, AppealPacket } from "@shared/schema";

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

// ─── BIOMARKER TRIAL CITATIONS ────────────────────────────────────────────────
const BIOMARKER_CITATIONS: Record<string, string> = {
  "EGFR": "FLAURA trial (NEJM 2018): osimertinib demonstrated superior OS (38.6 vs 31.8 months) vs first-generation EGFR TKIs in EGFR-mutant NSCLC.",
  "HER2_low": "DESTINY-Breast04 trial (NEJM 2022): trastuzumab deruxtecan demonstrated superior PFS (9.9 vs 5.1 months) and OS in HER2-low metastatic breast cancer.",
  "ALK": "ALEX trial (NEJM 2017): alectinib demonstrated superior PFS (34.8 vs 10.9 months) vs crizotinib in ALK-positive NSCLC.",
  "IDH1": "INDIGO trial (NEJM 2023): vorasidenib demonstrated 61% reduction in risk of progression in IDH-mutant grade 2 glioma.",
  "IDH2": "INDIGO trial (NEJM 2023): vorasidenib demonstrated 61% reduction in risk of progression in IDH-mutant grade 2 glioma.",
  "PDL1": "KEYNOTE-024 trial (NEJM 2016): pembrolizumab demonstrated superior PFS (10.3 vs 6.0 months) vs chemotherapy in PD-L1 >=50% NSCLC.",
  "TNBC": "ASCENT trial (NEJM 2021): sacituzumab govitecan demonstrated superior OS (12.1 vs 6.7 months) vs chemotherapy in metastatic TNBC.",
  "MGMT": "Stupp protocol (NEJM 2005): temozolomide with radiotherapy demonstrated superior OS in newly diagnosed GBM, with MGMT methylation as predictive biomarker.",
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
  const gtRows = storage.getAllGroundTruth();
  const candidates = gtRows.filter(gt =>
    gt.payerId === denial.payerId &&
    (denial.drugId ? gt.drugId === denial.drugId : true) &&
    gt.cancerType === patient.cancerType
  );

  if (candidates.length > 0) {
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

  // Biomarker-aware trial citations
  const biomarkerCitations: string[] = [];
  for (const [key, value] of Object.entries(biomarkers)) {
    const citationKey = key.toUpperCase();
    if (BIOMARKER_CITATIONS[citationKey]) {
      biomarkerCitations.push(BIOMARKER_CITATIONS[citationKey]);
    }
    // Special case: HER2-low
    if (key === "HER2" && String(value).toLowerCase().includes("low")) {
      biomarkerCitations.push(BIOMARKER_CITATIONS["HER2_low"]);
    }
  }

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

BIOMARKER-SPECIFIC TRIAL EVIDENCE:
${biomarkerCitations.length > 0 ? biomarkerCitations.join("\n") : "Standard clinical evidence applies."}

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
  "executiveSummary": "2-3 paragraph professional summary of the appeal.",
  "clinicalBackground": "3-4 paragraph clinical context including biomarker-specific trial citations.",
  "nccnFdaSection": "Detailed 3-4 paragraph section citing the exact NCCN guideline version, category, page reference, and full rationale.",
  "payerContradictionSection": "3-4 paragraph section quoting and analyzing the payer policy language.",
  "legalFrameworkSection": "2-3 paragraph section citing ERISA Section 502, state bad-faith statutes.",
  "requestedResolution": "1-2 paragraph clear demand for immediate approval and reversal within 72 hours."
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
    sections = generateFallbackAppeal(denial, patient, gt, statute, biomarkerCitations);
  }

  return sections;
}

// ─── FALLBACK TEMPLATE ────────────────────────────────────────────────────────
function generateFallbackAppeal(
  denial: DenialRecord,
  patient: PatientProfile,
  gt: GroundTruth,
  statute: string,
  biomarkerCitations: string[] = []
): AppealSections {
  const drug = storage.getDrug(gt.drugId);
  const nccn = Array.from(storage.getAllNccn()).find(n => n.nccnId === gt.nccnId);
  const biomarkers = JSON.parse(patient.biomarkers || "{}");
  const priorTherapies = JSON.parse(patient.priorTherapies || "[]");

  const biomarkerText = biomarkerCitations.length > 0
    ? `\n\nBiomarker-specific evidence:\n${biomarkerCitations.join("\n")}`
    : "";

  return {
    executiveSummary: `This appeal requests immediate reversal of ${denial.payerName}'s denial of ${denial.drugNameRaw} for a patient with ${patient.stage} ${patient.cancerType} cancer. The denial, citing "${denial.denialReasonCode.replace(/_/g, " ")}", directly contradicts ${nccn?.guidelineVersion} Category ${gt.nccnCategory} recommendation and FDA approval for this indication.\n\nThe requested therapy is ${drug?.fdaApprovalStatus === "approved" ? "FDA-approved" : "FDA-accelerated approved"} specifically for this patient population. The conflict has been identified as Type ${gt.conflictType}: ${gt.conflictDescription}.\n\nThis denial constitutes bad-faith delay of life-saving oncology treatment and may violate ${statute}.`,
    clinicalBackground: `The patient presents with ${patient.stage} ${patient.cancerType} cancer with the following biomarker profile: ${JSON.stringify(biomarkers)}. Prior therapies include: ${priorTherapies.map((t: any) => `${t.drug} (response: ${t.response})`).join("; ") || "none"}. Current performance status: ${patient.performanceStatus || "adequate for treatment"}.${biomarkerText}\n\nGiven the documented disease progression and biomarker profile, ${denial.drugNameRaw} represents the evidence-based, guideline-concordant next line of therapy. Delaying access to this therapy risks disease progression and irreversible harm to this patient's survival outcomes.`,
    nccnFdaSection: `The ${nccn?.guidelineVersion} designates ${drug?.genericName} as a Category ${gt.nccnCategory} recommendation (${nccn?.recommendationType?.replace(/_/g, " ")}) for this exact indication: ${gt.indication}.\n\n${nccn?.fullCitationText}\n\nFDA approval was granted for ${drug?.fdaLabelSummary} (Reference: ${drug?.fdaLabelReference}). NCCN Category 1 indicates uniform consensus based on high-level evidence — there is no credible clinical or scientific basis for the payer's denial classification.`,
    payerContradictionSection: `${denial.payerName} policy ${gt.policyId} states: "${gt.denialTextSnippet}". This language directly contradicts:\n\n1. FDA-approved indication for ${drug?.brandName} covering this exact patient population.\n2. ${nccn?.guidelineVersion} Category ${gt.nccnCategory} recommendation.\n3. The peer-reviewed clinical evidence base underlying both of the above.\n\nConflict type ${gt.conflictType}: ${gt.conflictDescription}`,
    legalFrameworkSection: `Under ERISA Section 502(a)(1)(B) (29 U.S.C. § 1132), the patient has the right to recover benefits wrongfully denied under the plan. The plan's denial, which contradicts NCCN Category ${gt.nccnCategory} guidelines and FDA regulatory standards, exceeds the plan's lawful authority to define medical necessity contrary to established clinical evidence.\n\nApplicable state law: ${statute}\n\nContinued denial constitutes bad-faith delay of life-saving oncology treatment.`,
    requestedResolution: `We respectfully demand immediate approval of ${denial.drugNameRaw} for the above-referenced patient and reversal of denial reference ${denial.referenceNumber}. Per ERISA regulations and applicable state law, a decision must be rendered within 72 hours for urgent/expedited appeals or 30 days for standard appeals.`,
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

// ─── EXTRACT DENIAL FROM TEXT ─────────────────────────────────────────────────
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

// ─── GENERATE P2P BRIEF ───────────────────────────────────────────────────────
export interface P2PBrief {
  openingStatement: string;
  talkingPoints: string[];
  anticipatedObjections: Array<{ objection: string; rebuttal: string }>;
  keyCitations: string[];
}

export async function generateP2PBrief(
  appeal: AppealPacket,
  denial: DenialRecord,
  patient: PatientProfile,
  gt: GroundTruth
): Promise<P2PBrief> {
  const drug = storage.getDrug(gt.drugId);
  const nccn = Array.from(storage.getAllNccn()).find(n => n.nccnId === gt.nccnId);
  const statute = BAD_FAITH_STATUTES[patient.state] || BAD_FAITH_STATUTES["DEFAULT"];
  const biomarkers = JSON.parse(patient.biomarkers || "{}");

  // Biomarker-aware citations
  const biomarkerCitations: string[] = [];
  for (const [key, value] of Object.entries(biomarkers)) {
    const citationKey = key.toUpperCase();
    if (BIOMARKER_CITATIONS[citationKey]) biomarkerCitations.push(BIOMARKER_CITATIONS[citationKey]);
    if (key === "HER2" && String(value).toLowerCase().includes("low")) biomarkerCitations.push(BIOMARKER_CITATIONS["HER2_low"]);
  }

  const prompt = `You are a senior oncologist preparing for a peer-to-peer (P2P) call with a payer medical director to appeal a prior authorization denial.

CASE:
- Drug: ${denial.drugNameRaw}
- Patient: ${patient.stage} ${patient.cancerType} cancer
- Biomarkers: ${JSON.stringify(biomarkers)}
- Denial reason: ${denial.denialReasonCode.replace(/_/g, " ")} — "${denial.denialReasonText}"
- Payer: ${denial.payerName}
- NCCN: ${nccn?.guidelineVersion} Category ${gt.nccnCategory} — ${nccn?.fullCitationText}
- FDA: ${drug?.fdaApprovalStatus} — ${drug?.fdaLabelSummary}
- Conflict: Type ${gt.conflictType} — ${gt.conflictDescription}
- Biomarker trial evidence: ${biomarkerCitations.join("; ") || "Standard clinical evidence"}
- State law: ${statute}

Return ONLY valid JSON:
{
  "openingStatement": "1-2 sentence professional opening for the P2P call",
  "talkingPoints": ["point 1", "point 2", "point 3", "point 4", "point 5"],
  "anticipatedObjections": [
    {"objection": "likely payer objection", "rebuttal": "your response"},
    {"objection": "second objection", "rebuttal": "your response"},
    {"objection": "third objection", "rebuttal": "your response"}
  ],
  "keyCitations": ["citation 1", "citation 2", "citation 3"]
}`;

  try {
    const response = await cohere.chat({
      model: "command-a-03-2025",
      message: prompt,
      temperature: 0.3,
      maxTokens: 1500,
    });
    const raw = response.text?.trim() || "{}";
    const jsonStr = raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
    return JSON.parse(jsonStr);
  } catch {
    // Fallback P2P brief
    return {
      openingStatement: `Thank you for taking the time to discuss this case. I am appealing the prior authorization denial for ${denial.drugNameRaw} for my patient with ${patient.stage} ${patient.cancerType} cancer, as the denial contradicts ${nccn?.guidelineVersion} Category ${gt.nccnCategory} guidelines and FDA approval.`,
      talkingPoints: [
        `Patient has ${Object.entries(biomarkers).map(([k,v]) => `${k}: ${v}`).join(", ")}, for which ${nccn?.guidelineVersion} Category ${gt.nccnCategory} guidelines recommend ${denial.drugNameRaw} as preferred therapy.`,
        `${drug?.fdaLabelSummary}`,
        `${gt.conflictDescription}`,
        biomarkerCitations[0] || `Clinical evidence strongly supports ${denial.drugNameRaw} for this patient population.`,
        `Denial of this therapy risks disease progression and may constitute bad-faith delay under ${statute}.`,
      ],
      anticipatedObjections: [
        { objection: "Step therapy requirements not met.", rebuttal: `NCCN Category ${gt.nccnCategory} designates ${denial.drugNameRaw} as the preferred therapy for this indication. Requiring inferior prior therapy contradicts the evidence-based treatment sequence.` },
        { objection: "Not medically necessary for this indication.", rebuttal: `FDA has approved ${drug?.brandName} specifically for this patient population (${drug?.fdaLabelReference}). FDA approval creates a presumption of medical necessity that the payer cannot override with internal criteria.` },
        { objection: "Classified as experimental/investigational.", rebuttal: `${drug?.brandName} received FDA approval based on Phase III trial data. NCCN Category ${gt.nccnCategory} classification reflects the highest level of clinical evidence. Experimental classification is factually incorrect.` },
      ],
      keyCitations: [
        `${nccn?.guidelineVersion} — ${nccn?.pageReference} (Category ${gt.nccnCategory})`,
        `FDA approval: ${drug?.fdaLabelReference} — ${drug?.fdaLabelSummary?.slice(0, 150)}`,
        biomarkerCitations[0] || `Clinical trial evidence supporting ${denial.drugNameRaw} in this population.`,
      ],
    };
  }
}

// ─── PREDICTIVE DENIAL SCORING ────────────────────────────────────────────────
export interface DenialScore {
  score: number;           // 0-100
  breakdown: {
    nccnCategory: number;
    conflictType: number;
    biomarkerMatch: number;
    historicalWinRate: number;
    priorTherapyDoc: number;
  };
  recommendation: string;
  estimatedWinRate: number;
  appealStrengthLabel: string;
}

export async function scoreDenialPredictively(
  denial: DenialRecord,
  patient: PatientProfile
): Promise<DenialScore> {
  const gt = await matchDenialToGroundTruth(denial, patient);

  let nccnScore = 0;
  let conflictScore = 0;
  let biomarkerScore = 0;
  let historicalScore = 0;
  let priorTherapyScore = 0;

  if (gt) {
    // NCCN category score
    if (gt.nccnCategory === "1") nccnScore = 30;
    else if (gt.nccnCategory === "2A") nccnScore = 20;
    else if (gt.nccnCategory === "2B") nccnScore = 10;
    else nccnScore = 5;

    // Conflict type score
    if (gt.conflictType === "A") conflictScore = 25;
    else if (gt.conflictType === "B") conflictScore = 20;
    else if (gt.conflictType === "C") conflictScore = 15;
    else conflictScore = 10;

    // Biomarker match score
    try {
      const patientBiomarkers = JSON.parse(patient.biomarkers || "{}");
      const gtBiomarkers = JSON.parse(gt.biomarkerProfile || "{}");
      const patientKeys = Object.keys(patientBiomarkers);
      const gtKeys = Object.keys(gtBiomarkers);
      const matchCount = patientKeys.filter(k => gtKeys.includes(k)).length;
      biomarkerScore = gtKeys.length > 0 ? Math.round((matchCount / gtKeys.length) * 20) : 10;
    } catch {
      biomarkerScore = 10;
    }
  } else {
    nccnScore = 10;
    conflictScore = 10;
    biomarkerScore = 5;
  }

  // Historical win rate (from outcome data)
  const winRateStats = storage.getWinRateStats(denial.organizationId);
  const payerWinRate = winRateStats.byPayer[denial.payerId];
  if (payerWinRate !== undefined) {
    historicalScore = Math.round(payerWinRate * 0.15); // max 15 points
  } else {
    historicalScore = 8; // default moderate
  }

  // Prior therapy documentation score
  try {
    const priorTherapies = JSON.parse(patient.priorTherapies || "[]");
    if (priorTherapies.length >= 2) priorTherapyScore = 15;
    else if (priorTherapies.length === 1) priorTherapyScore = 10;
    else priorTherapyScore = 5;
  } catch {
    priorTherapyScore = 5;
  }

  const score = Math.min(100, nccnScore + conflictScore + biomarkerScore + historicalScore + priorTherapyScore);
  const estimatedWinRate = Math.min(95, Math.round(score * 0.85));

  let recommendation: string;
  let appealStrengthLabel: string;
  if (score >= 75) {
    recommendation = "Submit expedited appeal immediately. High probability of reversal with proper documentation.";
    appealStrengthLabel = "VERY HIGH — near-certain reversal";
  } else if (score >= 55) {
    recommendation = "Submit standard appeal with full documentation package. Strong clinical and legal basis.";
    appealStrengthLabel = "HIGH — strong legal and clinical basis";
  } else if (score >= 35) {
    recommendation = "Submit appeal with additional supporting documentation. Consider requesting P2P review.";
    appealStrengthLabel = "MODERATE — merits appeal with documentation";
  } else {
    recommendation = "Escalate directly to external independent review. Consider state insurance commissioner complaint.";
    appealStrengthLabel = "FAIR — escalate to external review";
  }

  return {
    score,
    breakdown: { nccnCategory: nccnScore, conflictType: conflictScore, biomarkerMatch: biomarkerScore, historicalWinRate: historicalScore, priorTherapyDoc: priorTherapyScore },
    recommendation,
    estimatedWinRate,
    appealStrengthLabel,
  };
}
