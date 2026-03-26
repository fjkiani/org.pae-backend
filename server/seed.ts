import { storage } from "./storage";

// The hardcoded UUIDs for the demo account
export const DEMO_ORG_ID = "00000000-demo-0000-0000-000000000000";
export const DEMO_USER_ID = "user0000-demo-0000-0000-000000000000";

// Payer fax numbers (Medical Director queues)
export const PAYER_FAX_NUMBERS: Record<string, string> = {
  UHC: "+1-866-252-0566",
  Cigna: "+1-800-337-0255",
  Aetna: "+1-860-754-3604",
  Humana: "+1-800-457-4708",
};

export const CANCER_TYPES = ["breast", "ovarian", "brain", "colon", "lung"];
export const PAYERS = ["UHC", "Cigna", "Aetna", "Humana"];

/**
 * Idempotent seeder.
 * Checks if the DEMO_ORG exists. If it does, we return early.
 * If not, we create the org, the demo user, the global clinical tables,
 * and the demo org-scoped patients/denials.
 */
export async function ensureDemoOrg() {
  const existingOrg = storage.getOrganization(DEMO_ORG_ID);
  if (existingOrg) {
    console.log("[Seed] Demo organization already exists. Skipping seed.");
    return { status: "already_seeded" };
  }

  const now = new Date().toISOString();
  const today = now.split("T")[0];

  console.log("[Seed] Creating demo organization and data...");

  // 1. Create Demo Organization
  storage.insertOrganization({
    id: DEMO_ORG_ID,
    name: "PAE-Onc Demo Facility",
    slug: "demo",
    logoUrl: null,
    address: "123 Innovation Way",
    city: "San Francisco",
    state: "CA",
    zip: "94105",
    npi: "1234567890",
    phone: "+1-555-0199",
    outboundFax: "+1-555-0198",
    signingPhysician: "Dr. Sarah Miller",
    signingTitle: "Attending Oncologist",
    plan: "enterprise",
    isDemo: true,
  });

  // 2. Create Demo User
  storage.insertUser({
    id: DEMO_USER_ID,
    organizationId: DEMO_ORG_ID,
    role: "admin",
    fullName: "Demo Physician",
    title: "MD",
    email: "demo@pae-onc.com",
  });

  // ─────────────────────────────────────────────────
  // DRUGS — Pan-Cancer Panel
  // ─────────────────────────────────────────────────
  const drugData = [
    // BREAST
    {
      id: "enhertu",
      genericName: "trastuzumab deruxtecan",
      brandName: "Enhertu",
      cancerType: "breast",
      indication: "Metastatic HER2-low or HER2-positive breast cancer",
      lineOfTherapy: "2L",
      biomarkerProfile: JSON.stringify({ HER2: "low or positive", HR: "positive or negative" }),
      fdaApprovalStatus: "approved",
      fdaLabelSummary: "FDA approved for unresectable or metastatic HER2-positive breast cancer (Aug 2019) and HER2-low (Aug 2022) after prior chemotherapy.",
      fdaLabelReference: "NDA 761139",
      drugClass: "ADC",
    },
    {
      id: "trodelvy",
      genericName: "sacituzumab govitecan",
      brandName: "Trodelvy",
      cancerType: "breast",
      indication: "Metastatic triple-negative breast cancer (TNBC) or HR+/HER2- breast cancer",
      lineOfTherapy: "2L",
      biomarkerProfile: JSON.stringify({ TNBC: "positive", HER2: "negative", Trop2: "expressed" }),
      fdaApprovalStatus: "approved",
      fdaLabelSummary: "FDA approved for unresectable locally advanced or metastatic TNBC (Apr 2021) and HR+/HER2- (Feb 2023) after prior therapies.",
      fdaLabelReference: "BLA 761115",
      drugClass: "ADC",
    },
    {
      id: "verzenio",
      genericName: "abemaciclib",
      brandName: "Verzenio",
      cancerType: "breast",
      indication: "HR+/HER2- early or advanced breast cancer with high recurrence risk",
      lineOfTherapy: "1L",
      biomarkerProfile: JSON.stringify({ HR: "positive", HER2: "negative", Ki67: "high" }),
      fdaApprovalStatus: "approved",
      fdaLabelSummary: "FDA approved for HR+/HER2- early breast cancer with Ki67 ≥20% (Oct 2021) and advanced disease.",
      fdaLabelReference: "NDA 208716",
      drugClass: "targeted",
    },
    // OVARIAN
    {
      id: "lynparza",
      genericName: "olaparib",
      brandName: "Lynparza",
      cancerType: "ovarian",
      indication: "BRCA-mutated advanced ovarian cancer",
      lineOfTherapy: "1L",
      biomarkerProfile: JSON.stringify({ BRCA: "mutated", gBRCA: "germline or somatic" }),
      fdaApprovalStatus: "approved",
      fdaLabelSummary: "FDA approved as maintenance therapy for adults with deleterious BRCA-mutated advanced ovarian cancer (Dec 2018).",
      fdaLabelReference: "NDA 206162",
      drugClass: "targeted",
    },
    {
      id: "zejula",
      genericName: "niraparib",
      brandName: "Zejula",
      cancerType: "ovarian",
      indication: "Advanced ovarian cancer maintenance — HRD positive or BRCA mutated",
      lineOfTherapy: "1L",
      biomarkerProfile: JSON.stringify({ HRD: "positive", BRCA: "mutated or wildtype" }),
      fdaApprovalStatus: "approved",
      fdaLabelSummary: "FDA approved for first-line maintenance in adults with advanced ovarian cancer after platinum-based chemotherapy (Apr 2020).",
      fdaLabelReference: "NDA 208447",
      drugClass: "targeted",
    },
    {
      id: "bevacizumab-ov",
      genericName: "bevacizumab",
      brandName: "Avastin (ovarian)",
      cancerType: "ovarian",
      indication: "Recurrent platinum-resistant ovarian cancer",
      lineOfTherapy: "2L",
      biomarkerProfile: JSON.stringify({ BRCA: "any", HRD: "any" }),
      fdaApprovalStatus: "approved",
      fdaLabelSummary: "FDA approved for recurrent platinum-resistant epithelial ovarian cancer (Nov 2014).",
      fdaLabelReference: "BLA 125085",
      drugClass: "targeted",
    },
    // BRAIN (GBM)
    {
      id: "temodar",
      genericName: "temozolomide",
      brandName: "Temodar",
      cancerType: "brain",
      indication: "Newly diagnosed GBM with concurrent radiotherapy",
      lineOfTherapy: "1L",
      biomarkerProfile: JSON.stringify({ MGMT: "methylated or unmethylated", IDH: "wildtype" }),
      fdaApprovalStatus: "approved",
      fdaLabelSummary: "FDA approved for newly diagnosed GBM concomitant with radiotherapy then as maintenance (Mar 2005).",
      fdaLabelReference: "NDA 021029",
      drugClass: "chemo",
    },
    {
      id: "optune",
      genericName: "tumor treating fields",
      brandName: "Optune",
      cancerType: "brain",
      indication: "Newly diagnosed GBM after surgery and chemoradiation",
      lineOfTherapy: "1L",
      biomarkerProfile: JSON.stringify({ IDH: "wildtype", MGMT: "any" }),
      fdaApprovalStatus: "approved",
      fdaLabelSummary: "FDA approved (Oct 2015) for newly diagnosed GBM as adjunct to TMZ maintenance, extending median OS in EF-14 trial.",
      fdaLabelReference: "PMA P140003",
      drugClass: "targeted",
    },
    {
      id: "vorasidenib",
      genericName: "vorasidenib",
      brandName: "Voranigo",
      cancerType: "brain",
      indication: "Grade 2 IDH-mutant glioma after surgery",
      lineOfTherapy: "1L",
      biomarkerProfile: JSON.stringify({ IDH1: "mutated", IDH2: "mutated" }),
      fdaApprovalStatus: "approved",
      fdaLabelSummary: "FDA approved Aug 2024 for adults with residual or recurrent grade 2 IDH-mutant glioma.",
      fdaLabelReference: "NDA 218108",
      drugClass: "targeted",
    },
    // COLON
    {
      id: "pembrolizumab-crc",
      genericName: "pembrolizumab",
      brandName: "Keytruda (CRC)",
      cancerType: "colon",
      indication: "MSI-H/dMMR metastatic colorectal cancer",
      lineOfTherapy: "1L",
      biomarkerProfile: JSON.stringify({ MSI: "high", dMMR: "deficient" }),
      fdaApprovalStatus: "approved",
      fdaLabelSummary: "FDA approved for unresectable or metastatic MSI-H or dMMR CRC (Jun 2017 accelerated; Jun 2020 regular).",
      fdaLabelReference: "BLA 125514",
      drugClass: "checkpoint_inhibitor",
    },
    {
      id: "braftovi-mectovi",
      genericName: "encorafenib + binimetinib",
      brandName: "Braftovi + Mektovi",
      cancerType: "colon",
      indication: "BRAF V600E-mutant metastatic colorectal cancer",
      lineOfTherapy: "2L",
      biomarkerProfile: JSON.stringify({ BRAF: "V600E mutant", RAS: "wildtype" }),
      fdaApprovalStatus: "approved",
      fdaLabelSummary: "FDA approved for BRAF V600E-mutant metastatic CRC after prior therapy (Apr 2020).",
      fdaLabelReference: "NDA 210496",
      drugClass: "targeted",
    },
    {
      id: "vectibix",
      genericName: "panitumumab",
      brandName: "Vectibix",
      cancerType: "colon",
      indication: "RAS wildtype metastatic colorectal cancer",
      lineOfTherapy: "1L",
      biomarkerProfile: JSON.stringify({ RAS: "wildtype", KRAS: "wildtype", NRAS: "wildtype" }),
      fdaApprovalStatus: "approved",
      fdaLabelSummary: "FDA approved for RAS wildtype mCRC as first or later line (Sep 2006, extended 2017).",
      fdaLabelReference: "BLA 125147",
      drugClass: "targeted",
    },
    // LUNG
    {
      id: "tagrisso",
      genericName: "osimertinib",
      brandName: "Tagrisso",
      cancerType: "lung",
      indication: "EGFR-mutant NSCLC (ex19del or L858R)",
      lineOfTherapy: "1L",
      biomarkerProfile: JSON.stringify({ EGFR: "ex19del or L858R", T790M: "any" }),
      fdaApprovalStatus: "approved",
      fdaLabelSummary: "FDA approved for first-line EGFR ex19del or L858R NSCLC (Apr 2018) and T790M-positive (Nov 2015).",
      fdaLabelReference: "NDA 208065",
      drugClass: "targeted",
    },
    {
      id: "keytruda-nsclc",
      genericName: "pembrolizumab",
      brandName: "Keytruda (NSCLC)",
      cancerType: "lung",
      indication: "PD-L1 ≥1% NSCLC without EGFR/ALK",
      lineOfTherapy: "1L",
      biomarkerProfile: JSON.stringify({ PDL1: "≥1%", EGFR: "negative", ALK: "negative" }),
      fdaApprovalStatus: "approved",
      fdaLabelSummary: "FDA approved for metastatic NSCLC with PD-L1 ≥1% without EGFR or ALK alterations (Oct 2016, extended).",
      fdaLabelReference: "BLA 125514",
      drugClass: "checkpoint_inhibitor",
    },
    {
      id: "alecensa",
      genericName: "alectinib",
      brandName: "Alecensa",
      cancerType: "lung",
      indication: "ALK-positive metastatic NSCLC",
      lineOfTherapy: "1L",
      biomarkerProfile: JSON.stringify({ ALK: "positive rearrangement" }),
      fdaApprovalStatus: "approved",
      fdaLabelSummary: "FDA approved for ALK-positive metastatic NSCLC as first-line (Nov 2017).",
      fdaLabelReference: "NDA 208434",
      drugClass: "targeted",
    },
  ];

  drugData.forEach(d => storage.upsertDrug({ ...d, createdAt: now }));

  // ─────────────────────────────────────────────────
  // NCCN GUIDELINES
  // ─────────────────────────────────────────────────
  const nccnData = [
    { nccnId: "NCCN-BREAST-2L-HER2LOW", guidelineVersion: "Breast Cancer v2.2026", cancerType: "breast", indication: "Metastatic HER2-low breast cancer", biomarkerProfile: '{"HER2":"low","HR":"positive or negative"}', lineOfTherapy: "2L", drugId: "enhertu", nccnCategory: "1", recommendationType: "preferred", pageReference: "BRE-M p.10", fullCitationText: "NCCN Category 1: Trastuzumab deruxtecan is the preferred regimen for HER2-low metastatic breast cancer in the second-line setting. Category 1 reflects uniform consensus based on high-level evidence.", lastUpdated: today },
    { nccnId: "NCCN-BREAST-2L-TNBC", guidelineVersion: "Breast Cancer v2.2026", cancerType: "breast", indication: "Metastatic TNBC", biomarkerProfile: '{"TNBC":"positive","Trop2":"expressed"}', lineOfTherapy: "2L", drugId: "trodelvy", nccnCategory: "1", recommendationType: "preferred", pageReference: "BRE-M p.14", fullCitationText: "NCCN Category 1: Sacituzumab govitecan is the preferred regimen for metastatic TNBC in the second-line setting.", lastUpdated: today },
    { nccnId: "NCCN-BREAST-1L-HR-HER2NEG", guidelineVersion: "Breast Cancer v2.2026", cancerType: "breast", indication: "HR+/HER2- early breast cancer high recurrence risk", biomarkerProfile: '{"HR":"positive","HER2":"negative","Ki67":"≥20%"}', lineOfTherapy: "1L", drugId: "verzenio", nccnCategory: "1", recommendationType: "preferred", pageReference: "BRE-A p.5", fullCitationText: "NCCN Category 1: Abemaciclib plus endocrine therapy for HR+/HER2- early breast cancer with high recurrence risk (Ki67 ≥20% or node-positive).", lastUpdated: today },
    { nccnId: "NCCN-OV-1L-BRCA", guidelineVersion: "Ovarian Cancer v2.2026", cancerType: "ovarian", indication: "Advanced ovarian cancer BRCA-mutated", biomarkerProfile: '{"BRCA":"mutated"}', lineOfTherapy: "1L", drugId: "lynparza", nccnCategory: "1", recommendationType: "preferred", pageReference: "OV-D p.8", fullCitationText: "NCCN Category 1: Olaparib maintenance is the preferred regimen for germline or somatic BRCA-mutated advanced ovarian cancer.", lastUpdated: today },
    { nccnId: "NCCN-OV-1L-HRD", guidelineVersion: "Ovarian Cancer v2.2026", cancerType: "ovarian", indication: "Advanced ovarian cancer HRD positive", biomarkerProfile: '{"HRD":"positive"}', lineOfTherapy: "1L", drugId: "zejula", nccnCategory: "2A", recommendationType: "other_recommended", pageReference: "OV-D p.9", fullCitationText: "NCCN Category 2A: Niraparib maintenance for HRD-positive advanced ovarian cancer after first-line platinum-based chemo.", lastUpdated: today },
    { nccnId: "NCCN-OV-2L-PLAT-RESIST", guidelineVersion: "Ovarian Cancer v2.2026", cancerType: "ovarian", indication: "Platinum-resistant recurrent ovarian cancer", biomarkerProfile: '{"platinum":"resistant"}', lineOfTherapy: "2L", drugId: "bevacizumab-ov", nccnCategory: "2A", recommendationType: "other_recommended", pageReference: "OV-F p.12", fullCitationText: "NCCN Category 2A: Bevacizumab plus chemotherapy for platinum-resistant recurrent ovarian cancer.", lastUpdated: today },
    { nccnId: "NCCN-BRAIN-1L-GBM", guidelineVersion: "CNS Cancers v2.2026", cancerType: "brain", indication: "Newly diagnosed GBM", biomarkerProfile: '{"IDH":"wildtype","MGMT":"any"}', lineOfTherapy: "1L", drugId: "temodar", nccnCategory: "1", recommendationType: "preferred", pageReference: "GBM-2 p.4", fullCitationText: "NCCN Category 1: Temozolomide concurrent with radiotherapy followed by maintenance TMZ for newly diagnosed GBM.", lastUpdated: today },
    { nccnId: "NCCN-BRAIN-1L-TTF", guidelineVersion: "CNS Cancers v2.2026", cancerType: "brain", indication: "Newly diagnosed GBM post-chemoradiation", biomarkerProfile: '{"IDH":"wildtype"}', lineOfTherapy: "1L", drugId: "optune", nccnCategory: "1", recommendationType: "preferred", pageReference: "GBM-3 p.5", fullCitationText: "NCCN Category 1: Tumor treating fields (TTF) with temozolomide maintenance for newly diagnosed GBM.", lastUpdated: today },
    { nccnId: "NCCN-BRAIN-1L-GLIOMA-IDH", guidelineVersion: "CNS Cancers v2.2026", cancerType: "brain", indication: "Grade 2 IDH-mutant glioma post-surgery", biomarkerProfile: '{"IDH1":"mutated","IDH2":"mutated"}', lineOfTherapy: "1L", drugId: "vorasidenib", nccnCategory: "1", recommendationType: "preferred", pageReference: "GLIO-2 p.6", fullCitationText: "NCCN Category 1: Vorasidenib for residual or recurrent grade 2 IDH-mutant glioma.", lastUpdated: today },
    { nccnId: "NCCN-CRC-1L-MSIH", guidelineVersion: "Colon Cancer v1.2026", cancerType: "colon", indication: "Metastatic MSI-H/dMMR colorectal cancer", biomarkerProfile: '{"MSI":"high","dMMR":"deficient"}', lineOfTherapy: "1L", drugId: "pembrolizumab-crc", nccnCategory: "1", recommendationType: "preferred", pageReference: "COLO-D p.7", fullCitationText: "NCCN Category 1: Pembrolizumab monotherapy is preferred first-line for MSI-H or dMMR metastatic CRC.", lastUpdated: today },
    { nccnId: "NCCN-CRC-2L-BRAF", guidelineVersion: "Colon Cancer v1.2026", cancerType: "colon", indication: "BRAF V600E-mutant metastatic CRC", biomarkerProfile: '{"BRAF":"V600E"}', lineOfTherapy: "2L", drugId: "braftovi-mectovi", nccnCategory: "1", recommendationType: "preferred", pageReference: "COLO-F p.10", fullCitationText: "NCCN Category 1: Encorafenib + binimetinib + cetuximab for BRAF V600E-mutant metastatic CRC after prior therapy.", lastUpdated: today },
    { nccnId: "NCCN-CRC-1L-RAS-WT", guidelineVersion: "Colon Cancer v1.2026", cancerType: "colon", indication: "RAS wildtype metastatic CRC left-sided", biomarkerProfile: '{"RAS":"wildtype","KRAS":"wildtype"}', lineOfTherapy: "1L", drugId: "vectibix", nccnCategory: "2A", recommendationType: "other_recommended", pageReference: "COLO-C p.6", fullCitationText: "NCCN Category 2A: Panitumumab-based regimen for RAS wildtype left-sided metastatic CRC.", lastUpdated: today },
    { nccnId: "NCCN-LUNG-1L-EGFR", guidelineVersion: "NSCLC v4.2026", cancerType: "lung", indication: "EGFR-mutant NSCLC first-line", biomarkerProfile: '{"EGFR":"ex19del or L858R"}', lineOfTherapy: "1L", drugId: "tagrisso", nccnCategory: "1", recommendationType: "preferred", pageReference: "NSCLC-18 p.9", fullCitationText: "NCCN Category 1: Osimertinib is the preferred first-line therapy for EGFR exon 19 deletion or L858R substitution NSCLC.", lastUpdated: today },
    { nccnId: "NCCN-LUNG-1L-PDL1", guidelineVersion: "NSCLC v4.2026", cancerType: "lung", indication: "PD-L1 ≥1% NSCLC no driver mutation", biomarkerProfile: '{"PDL1":"≥1%","EGFR":"negative","ALK":"negative"}', lineOfTherapy: "1L", drugId: "keytruda-nsclc", nccnCategory: "1", recommendationType: "preferred", pageReference: "NSCLC-16 p.8", fullCitationText: "NCCN Category 1: Pembrolizumab monotherapy or combination chemoimmunotherapy for PD-L1 ≥1% NSCLC.", lastUpdated: today },
    { nccnId: "NCCN-LUNG-1L-ALK", guidelineVersion: "NSCLC v4.2026", cancerType: "lung", indication: "ALK-positive metastatic NSCLC", biomarkerProfile: '{"ALK":"positive"}', lineOfTherapy: "1L", drugId: "alecensa", nccnCategory: "1", recommendationType: "preferred", pageReference: "NSCLC-20 p.11", fullCitationText: "NCCN Category 1: Alectinib is the preferred first-line therapy for ALK-positive metastatic NSCLC.", lastUpdated: today },
  ];

  nccnData.forEach(n => storage.insertNccn(n));

  // ─────────────────────────────────────────────────
  // PAYER POLICIES — 4 payers × key drugs
  // ─────────────────────────────────────────────────
  const policies = [
    // UHC Policies
    { payerId: "UHC", policyId: "MP-ONC-1234", policyVersion: "2025-Q4", drugId: "enhertu", cancerType: "breast", indication: "Metastatic breast cancer", biomarkerConstraints: "HER2-positive only (IHC 3+ or ISH+); does not cover HER2-low", stepTherapyRequirements: "trastuzumab, pertuzumab", experimentalInvestigationalFlag: false, experimentalRationale: null, priorAuthRequired: true, notMedicallyNecessaryLanguage: "Not covered for HER2-low (IHC 1+, IHC 2+/ISH-) as clinical benefit not established per plan criteria", coverageCriteriaText: "Coverage requires HER2-positive disease confirmed by IHC 3+ or ISH+. HER2-low does not meet criteria under this policy.", policySourceUrl: "https://www.uhcprovider.com/content/dam/provider/docs/public/policies/medadvanpol/oncology-drug-therapy.pdf", policyEffectiveDate: "2025-01-01", lastValidated: today },
    { payerId: "UHC", policyId: "MP-ONC-2891", policyVersion: "2025-Q4", drugId: "optune", cancerType: "brain", indication: "GBM", biomarkerConstraints: null, stepTherapyRequirements: "temozolomide, radiation", experimentalInvestigationalFlag: true, experimentalRationale: "Classified as experimental/investigational; insufficient long-term survival data per UHC medical technology assessment", priorAuthRequired: true, notMedicallyNecessaryLanguage: "Tumor Treating Fields device classified as experimental; coverage denied pending further clinical evidence", coverageCriteriaText: "TTF devices are not covered under this policy as they are considered experimental and investigational per UHC technology assessment committee.", policySourceUrl: "https://www.uhcprovider.com/policies", policyEffectiveDate: "2025-01-01", lastValidated: today },
    { payerId: "UHC", policyId: "MP-ONC-3301", policyVersion: "2025-Q4", drugId: "vorasidenib", cancerType: "brain", indication: "IDH-mutant glioma", biomarkerConstraints: "IDH1/IDH2 mutation required", stepTherapyRequirements: "temozolomide", experimentalInvestigationalFlag: true, experimentalRationale: "Limited long-term outcome data; FDA approval recent (2024); classified experimental pending broader evidence", priorAuthRequired: true, notMedicallyNecessaryLanguage: null, coverageCriteriaText: "Vorasidenib classified as experimental/investigational for glioma. Requires Medical Director review.", policySourceUrl: "https://www.uhcprovider.com/policies", policyEffectiveDate: "2025-01-01", lastValidated: today },
    { payerId: "UHC", policyId: "MP-ONC-4102", policyVersion: "2025-Q4", drugId: "tagrisso", cancerType: "lung", indication: "EGFR-mutant NSCLC", biomarkerConstraints: "EGFR ex19del or L858R required; T790M for second-line", stepTherapyRequirements: "erlotinib or gefitinib for first-line (prior generation TKI)", experimentalInvestigationalFlag: false, experimentalRationale: null, priorAuthRequired: true, notMedicallyNecessaryLanguage: null, coverageCriteriaText: "Prior authorization required. First-line coverage requires trial of first-generation EGFR TKI (erlotinib/gefitinib) unless T790M+ at diagnosis.", policySourceUrl: "https://www.uhcprovider.com/policies", policyEffectiveDate: "2025-01-01", lastValidated: today },

    // Cigna Policies
    { payerId: "Cigna", policyId: "CPG-ONC-0887", policyVersion: "2025-11", drugId: "trodelvy", cancerType: "breast", indication: "Metastatic TNBC", biomarkerConstraints: "Must have PD-L1 testing; prior checkpoint inhibitor required for PD-L1+ disease", stepTherapyRequirements: "atezolizumab or pembrolizumab, carboplatin, gemcitabine", experimentalInvestigationalFlag: false, priorAuthRequired: true, notMedicallyNecessaryLanguage: "Not medically necessary unless ≥2 prior lines including checkpoint inhibitor for PD-L1+ disease", coverageCriteriaText: "For metastatic TNBC: covered after ≥2 prior cytotoxic regimens. PD-L1+ patients must have received checkpoint inhibitor.", policySourceUrl: "https://cignapolicies.com/oncology", policyEffectiveDate: "2025-11-01", lastValidated: today },
    { payerId: "Cigna", policyId: "CPG-ONC-1122", policyVersion: "2025-11", drugId: "lynparza", cancerType: "ovarian", indication: "Advanced ovarian cancer", biomarkerConstraints: "gBRCA mutation required for first-line; somatic BRCA requires Medical Director review", stepTherapyRequirements: "platinum-based chemotherapy (minimum 4 cycles)", experimentalInvestigationalFlag: false, priorAuthRequired: true, notMedicallyNecessaryLanguage: "Not covered for somatic BRCA without prior platinum platinum-free interval documentation", coverageCriteriaText: "First-line olaparib maintenance covered for gBRCA1/2-mutated advanced ovarian cancer after response to platinum chemotherapy.", policySourceUrl: "https://cignapolicies.com/oncology", policyEffectiveDate: "2025-11-01", lastValidated: today },
    { payerId: "Cigna", policyId: "CPG-ONC-2244", policyVersion: "2025-11", drugId: "pembrolizumab-crc", cancerType: "colon", indication: "Metastatic CRC MSI-H", biomarkerConstraints: "MSI-H confirmed by both PCR and IHC (dMMR)", stepTherapyRequirements: "FOLFOX or FOLFIRI with bevacizumab", experimentalInvestigationalFlag: false, priorAuthRequired: true, notMedicallyNecessaryLanguage: "Not medically necessary as first-line without prior oxaliplatin-based chemotherapy failure", coverageCriteriaText: "Pembrolizumab for MSI-H mCRC: covered as second-line or beyond. First-line requires step-therapy documentation.", policySourceUrl: "https://cignapolicies.com/oncology", policyEffectiveDate: "2025-11-01", lastValidated: today },
    { payerId: "Cigna", policyId: "CPG-ONC-3315", policyVersion: "2025-11", drugId: "keytruda-nsclc", cancerType: "lung", indication: "NSCLC PD-L1 positive", biomarkerConstraints: "PD-L1 ≥50% for monotherapy; ≥1% only with chemotherapy combination", stepTherapyRequirements: "carboplatin-based doublet chemotherapy for PD-L1 1-49%", experimentalInvestigationalFlag: false, priorAuthRequired: true, notMedicallyNecessaryLanguage: "Monotherapy not covered for PD-L1 1-49%; combination required", coverageCriteriaText: "Pembrolizumab monotherapy covered only for PD-L1 ≥50%. For PD-L1 1-49%, must combine with platinum-doublet chemotherapy.", policySourceUrl: "https://cignapolicies.com/oncology", policyEffectiveDate: "2025-11-01", lastValidated: today },

    // Aetna Policies
    { payerId: "Aetna", policyId: "CPB-0600", policyVersion: "2026-01", drugId: "verzenio", cancerType: "breast", indication: "HR+/HER2- breast cancer", biomarkerConstraints: "Node-positive or Ki67 ≥20%; high genomic risk score", stepTherapyRequirements: "letrozole or anastrozole (3 months minimum)", experimentalInvestigationalFlag: false, priorAuthRequired: true, notMedicallyNecessaryLanguage: "Not medically necessary for node-negative low-risk disease", coverageCriteriaText: "Abemaciclib covered for HR+/HER2- high-risk early breast cancer. Requires node-positive disease or Ki67 ≥20% with genomic high-risk score.", policySourceUrl: "https://www.aetna.com/cpb/medical/data/600_699/0600.html", policyEffectiveDate: "2026-01-01", lastValidated: today },
    { payerId: "Aetna", policyId: "CPB-0750", policyVersion: "2026-01", drugId: "zejula", cancerType: "ovarian", indication: "Ovarian cancer maintenance", biomarkerConstraints: "HRD score ≥42 required for non-BRCA patients", stepTherapyRequirements: "6 cycles platinum doublet", experimentalInvestigationalFlag: false, priorAuthRequired: true, notMedicallyNecessaryLanguage: "Not medically necessary for HRD-negative patients without BRCA mutation", coverageCriteriaText: "Niraparib maintenance covered for BRCA-mutated or HRD-positive (score ≥42 by Myriad myChoice) ovarian cancer.", policySourceUrl: "https://www.aetna.com/cpb/medical/data/700_799/0750.html", policyEffectiveDate: "2026-01-01", lastValidated: today },
    { payerId: "Aetna", policyId: "CPB-0820", policyVersion: "2026-01", drugId: "braftovi-mectovi", cancerType: "colon", indication: "BRAF V600E CRC", biomarkerConstraints: "BRAF V600E confirmed by validated assay; RAS wildtype required", stepTherapyRequirements: "FOLFIRI-bevacizumab or FOLFOX-bevacizumab", experimentalInvestigationalFlag: false, priorAuthRequired: true, notMedicallyNecessaryLanguage: null, coverageCriteriaText: "Encorafenib + binimetinib + cetuximab covered for BRAF V600E mCRC after prior chemotherapy. Step therapy with prior oxaliplatin AND irinotecan required.", policySourceUrl: "https://www.aetna.com/cpb/medical/data/800_899/0820.html", policyEffectiveDate: "2026-01-01", lastValidated: today },
    { payerId: "Aetna", policyId: "CPB-0910", policyVersion: "2026-01", drugId: "alecensa", cancerType: "lung", indication: "ALK-positive NSCLC", biomarkerConstraints: "ALK rearrangement confirmed by FISH or IHC", stepTherapyRequirements: "crizotinib (prior ALK inhibitor)", experimentalInvestigationalFlag: false, priorAuthRequired: true, notMedicallyNecessaryLanguage: "Not medically necessary as first-line without crizotinib trial", coverageCriteriaText: "Alectinib for ALK-positive NSCLC: covered as second-line after crizotinib failure. First-line requires prior authorization and crizotinib contraindication documentation.", policySourceUrl: "https://www.aetna.com/cpb/medical/data/900_999/0910.html", policyEffectiveDate: "2026-01-01", lastValidated: today },

    // Humana Policies
    { payerId: "Humana", policyId: "HUM-ONC-441", policyVersion: "2025-10", drugId: "enhertu", cancerType: "breast", indication: "Metastatic breast cancer HER2+", biomarkerConstraints: "HER2 3+ by IHC or ISH amplified; HER2-low indication not covered", stepTherapyRequirements: "trastuzumab + pertuzumab + docetaxel, then TDM1", experimentalInvestigationalFlag: false, priorAuthRequired: true, notMedicallyNecessaryLanguage: "Denied for HER2-low: classified as not medically necessary; insufficient peer-reviewed evidence beyond TDM1", coverageCriteriaText: "Prior authorization required. Must have progressed on trastuzumab + pertuzumab AND TDM1. HER2-low indication requires expanded Medical Director review.", policySourceUrl: "https://humana.com/providers/drug-policies", policyEffectiveDate: "2025-10-01", lastValidated: today },
    { payerId: "Humana", policyId: "HUM-ONC-512", policyVersion: "2025-10", drugId: "temodar", cancerType: "brain", indication: "GBM", biomarkerConstraints: null, stepTherapyRequirements: null, experimentalInvestigationalFlag: false, priorAuthRequired: false, notMedicallyNecessaryLanguage: null, coverageCriteriaText: "Temozolomide covered without prior authorization for newly diagnosed GBM with concurrent radiotherapy per standard of care.", policySourceUrl: "https://humana.com/providers/drug-policies", policyEffectiveDate: "2025-10-01", lastValidated: today },
    { payerId: "Humana", policyId: "HUM-ONC-603", policyVersion: "2025-10", drugId: "tagrisso", cancerType: "lung", indication: "EGFR-mutant NSCLC", biomarkerConstraints: "EGFR ex19del or L858R required", stepTherapyRequirements: "gefitinib or erlotinib (first-generation TKI, 30-day minimum)", experimentalInvestigationalFlag: false, priorAuthRequired: true, notMedicallyNecessaryLanguage: "Not medically necessary as first-line for patients who have not trialed first-generation EGFR TKI unless T790M+ at diagnosis", coverageCriteriaText: "Osimertinib covered as first-line only with documented contraindication or intolerance to first-generation TKI, OR T790M+ at diagnosis.", policySourceUrl: "https://humana.com/providers/drug-policies", policyEffectiveDate: "2025-10-01", lastValidated: today },
    { payerId: "Humana", policyId: "HUM-ONC-720", policyVersion: "2025-10", drugId: "bevacizumab-ov", cancerType: "ovarian", indication: "Platinum-resistant ovarian cancer", biomarkerConstraints: null, stepTherapyRequirements: "carboplatin, paclitaxel, pegylated liposomal doxorubicin, topotecan", experimentalInvestigationalFlag: false, priorAuthRequired: true, notMedicallyNecessaryLanguage: "Not medically necessary without prior failure of ≥3 cytotoxic regimens", coverageCriteriaText: "Bevacizumab for platinum-resistant ovarian cancer requires ≥3 prior lines of chemotherapy including carboplatin + paclitaxel.", policySourceUrl: "https://humana.com/providers/drug-policies", policyEffectiveDate: "2025-10-01", lastValidated: today },
  ];

  policies.forEach(p => storage.insertPayerPolicy(p));

  // ─────────────────────────────────────────────────
  // GROUND TRUTH TABLE
  // ─────────────────────────────────────────────────
  const gtRows = [
    // CONFLICT TYPE A: NCCN Cat 1/2A labeled experimental
    { groundTruthRowId: "GT-UHC-OPTUNE-1L-BRAIN", drugId: "optune", cancerType: "brain", indication: "Newly diagnosed GBM", biomarkerProfile: '{"IDH":"wildtype"}', lineOfTherapy: "1L", nccnId: "NCCN-BRAIN-1L-TTF", nccnCategory: "1", payerId: "UHC", policyId: "MP-ONC-2891", denialRationaleType: "experimental", denialTextSnippet: "TTF devices are not covered under this policy as they are considered experimental and investigational per UHC technology assessment committee.", conflictType: "A", conflictDescription: "NCCN Category 1 drug labeled experimental by UHC. Optune demonstrated OS benefit in EF-14 phase III trial (FDA approved 2015). UHC classification contradicts highest-level clinical evidence.", cmsBehaviorFlags: '{"prior_auth_flag":true,"pattern":"PA required across all UHC plan IDs in NY, NJ, CA"}', legalExposureTags: '["contradicts NCCN Cat 1","FDA approved","pattern denial","bad-faith classification"]', severity: "high", lastValidatedTimestamp: today },
    { groundTruthRowId: "GT-UHC-VORASIDENIB-1L-BRAIN", drugId: "vorasidenib", cancerType: "brain", indication: "Grade 2 IDH-mutant glioma", biomarkerProfile: '{"IDH1":"mutated"}', lineOfTherapy: "1L", nccnId: "NCCN-BRAIN-1L-GLIOMA-IDH", nccnCategory: "1", payerId: "UHC", policyId: "MP-ONC-3301", denialRationaleType: "experimental", denialTextSnippet: "Vorasidenib classified as experimental/investigational for glioma. Requires Medical Director review.", conflictType: "A", conflictDescription: "NCCN Category 1 (added 2025) but UHC classifies as experimental. FDA approved Aug 2024 based on INDIGO phase 3 trial showing 61% PFS improvement. Systematic delay of FDA-approved NCCN Cat 1 therapy.", cmsBehaviorFlags: '{"prior_auth_flag":true,"allowed_amount_suspicious":true}', legalExposureTags: '["contradicts NCCN Cat 1","FDA approved 2024","systematic barrier","recent approval delay pattern"]', severity: "high", lastValidatedTimestamp: today },
    // CONFLICT TYPE B: FDA approved + NCCN 1/2A labeled not medically necessary
    { groundTruthRowId: "GT-UHC-ENHERTU-2L-BREAST-HER2LOW", drugId: "enhertu", cancerType: "breast", indication: "Metastatic HER2-low breast cancer", biomarkerProfile: '{"HER2":"low","HR":"positive"}', lineOfTherapy: "2L", nccnId: "NCCN-BREAST-2L-HER2LOW", nccnCategory: "1", payerId: "UHC", policyId: "MP-ONC-1234", denialRationaleType: "not_medically_necessary", denialTextSnippet: "Not covered for HER2-low (IHC 1+, IHC 2+/ISH-) as clinical benefit not established per plan criteria", conflictType: "B", conflictDescription: "FDA approved Aug 2022 specifically for HER2-low. NCCN Category 1 recommendation. UHC policy only recognizes HER2-positive (3+ or ISH+), directly contradicting the FDA indication and NCCN guideline for HER2-low.", cmsBehaviorFlags: '{"prior_auth_flag":true,"allowed_amount":0.00,"pattern":"zero allowed amounts observed across UHC plans in NY"}', legalExposureTags: '["contradicts NCCN Cat 1","FDA HER2-low indication","zero allowed amount CMS data","bad-faith NMN"]', severity: "high", lastValidatedTimestamp: today },
    { groundTruthRowId: "GT-HUMANA-ENHERTU-2L-BREAST", drugId: "enhertu", cancerType: "breast", indication: "Metastatic HER2-low breast cancer", biomarkerProfile: '{"HER2":"low"}', lineOfTherapy: "2L", nccnId: "NCCN-BREAST-2L-HER2LOW", nccnCategory: "1", payerId: "Humana", policyId: "HUM-ONC-441", denialRationaleType: "not_medically_necessary", denialTextSnippet: "Denied for HER2-low: classified as not medically necessary; insufficient peer-reviewed evidence beyond TDM1", conflictType: "B", conflictDescription: "Humana NMN denial directly contradicts FDA approval for HER2-low indication and NCCN Category 1 recommendation in the same clinical scenario.", cmsBehaviorFlags: '{"prior_auth_flag":true}', legalExposureTags: '["NMN contradicts FDA label","contradicts NCCN Cat 1","cross-payer denial pattern"]', severity: "high", lastValidatedTimestamp: today },
    // CONFLICT TYPE C: Step therapy contradicts NCCN sequence
    { groundTruthRowId: "GT-UHC-TAGRISSO-1L-LUNG", drugId: "tagrisso", cancerType: "lung", indication: "EGFR-mutant NSCLC first-line", biomarkerProfile: '{"EGFR":"ex19del or L858R"}', lineOfTherapy: "1L", nccnId: "NCCN-LUNG-1L-EGFR", nccnCategory: "1", payerId: "UHC", policyId: "MP-ONC-4102", denialRationaleType: "step_therapy", denialTextSnippet: "First-line coverage requires trial of first-generation EGFR TKI (erlotinib/gefitinib) unless T790M+ at diagnosis.", conflictType: "C", conflictDescription: "UHC step therapy requires erlotinib/gefitinib before osimertinib. NCCN Category 1 designates osimertinib as preferred FIRST-LINE. FLAURA trial showed superior OS with osimertinib vs first-gen TKIs. Requiring inferior prior therapy contradicts NCCN sequence.", cmsBehaviorFlags: '{"prior_auth_flag":true,"step_therapy_denials":"high frequency in NY/NJ plans"}', legalExposureTags: '["step therapy contradicts NCCN sequence","forces inferior therapy","FLAURA OS data ignored","ERISA 502"]', severity: "high", lastValidatedTimestamp: today },
    { groundTruthRowId: "GT-HUMANA-TAGRISSO-1L-LUNG", drugId: "tagrisso", cancerType: "lung", indication: "EGFR-mutant NSCLC first-line", biomarkerProfile: '{"EGFR":"ex19del or L858R"}', lineOfTherapy: "1L", nccnId: "NCCN-LUNG-1L-EGFR", nccnCategory: "1", payerId: "Humana", policyId: "HUM-ONC-603", denialRationaleType: "step_therapy", denialTextSnippet: "Osimertinib covered as first-line only with documented contraindication or intolerance to first-generation TKI", conflictType: "C", conflictDescription: "Humana requires prior failure of first-generation TKI. NCCN Category 1 consensus designates osimertinib as the preferred first-line; requiring prior inferior TKI directly contradicts the guideline-recommended treatment sequence.", cmsBehaviorFlags: '{"prior_auth_flag":true}', legalExposureTags: '["step therapy contradicts NCCN Cat 1","inferior prior therapy forced","systematic EGFR-NSCLC barrier"]', severity: "high", lastValidatedTimestamp: today },
    { groundTruthRowId: "GT-AETNA-ALECENSA-1L-LUNG", drugId: "alecensa", cancerType: "lung", indication: "ALK-positive NSCLC", biomarkerProfile: '{"ALK":"positive"}', lineOfTherapy: "1L", nccnId: "NCCN-LUNG-1L-ALK", nccnCategory: "1", payerId: "Aetna", policyId: "CPB-0910", denialRationaleType: "step_therapy", denialTextSnippet: "Alectinib for ALK-positive NSCLC: covered as second-line after crizotinib failure.", conflictType: "C", conflictDescription: "Aetna requires prior crizotinib for first-line alectinib. NCCN Category 1 and ALEX trial data establish alectinib superiority over crizotinib. Requiring inferior first-line therapy violates NCCN preferred sequence.", cmsBehaviorFlags: '{"prior_auth_flag":true}', legalExposureTags: '["step therapy forces inferior ALK inhibitor","contradicts NCCN Cat 1","ALEX trial OS data"]', severity: "high", lastValidatedTimestamp: today },
    { groundTruthRowId: "GT-CIGNA-PEMBROLIZUMAB-CRC-1L", drugId: "pembrolizumab-crc", cancerType: "colon", indication: "MSI-H metastatic CRC first-line", biomarkerProfile: '{"MSI":"high","dMMR":"deficient"}', lineOfTherapy: "1L", nccnId: "NCCN-CRC-1L-MSIH", nccnCategory: "1", payerId: "Cigna", policyId: "CPG-ONC-2244", denialRationaleType: "step_therapy", denialTextSnippet: "Pembrolizumab for MSI-H mCRC: covered as second-line or beyond. First-line requires step-therapy documentation.", conflictType: "C", conflictDescription: "Cigna requires FOLFOX/FOLFIRI failure before pembrolizumab in MSI-H CRC. NCCN Category 1 and KEYNOTE-177 trial establish pembrolizumab as preferred FIRST-LINE for MSI-H disease. Step therapy forces chemotherapy that is inferior per clinical evidence.", cmsBehaviorFlags: '{"prior_auth_flag":true}', legalExposureTags: '["step therapy contradicts NCCN Cat 1","KEYNOTE-177 PFS/OS data","forces inferior chemo first-line"]', severity: "high", lastValidatedTimestamp: today },
    // Ovarian conflicts
    { groundTruthRowId: "GT-CIGNA-LYNPARZA-1L-OV", drugId: "lynparza", cancerType: "ovarian", indication: "Advanced ovarian BRCA-mutated", biomarkerProfile: '{"BRCA":"mutated","somatic":true}', lineOfTherapy: "1L", nccnId: "NCCN-OV-1L-BRCA", nccnCategory: "1", payerId: "Cigna", policyId: "CPG-ONC-1122", denialRationaleType: "not_medically_necessary", denialTextSnippet: "Not covered for somatic BRCA without prior platinum platinum-free interval documentation", conflictType: "B", conflictDescription: "FDA approval and NCCN Category 1 cover both germline and somatic BRCA-mutated ovarian cancer. Cigna restricts somatic BRCA to Medical Director review creating additional barrier not supported by FDA label or guidelines.", cmsBehaviorFlags: '{"prior_auth_flag":true}', legalExposureTags: '["FDA label covers somatic BRCA","NCCN Cat 1 no germline restriction","creates unauthorized coverage gap"]', severity: "high", lastValidatedTimestamp: today },
    { groundTruthRowId: "GT-HUMANA-BEVACIZUMAB-OV-2L", drugId: "bevacizumab-ov", cancerType: "ovarian", indication: "Platinum-resistant ovarian cancer", biomarkerProfile: '{"platinum":"resistant"}', lineOfTherapy: "2L", nccnId: "NCCN-OV-2L-PLAT-RESIST", nccnCategory: "2A", payerId: "Humana", policyId: "HUM-ONC-720", denialRationaleType: "step_therapy", denialTextSnippet: "Bevacizumab for platinum-resistant ovarian cancer requires ≥3 prior lines of chemotherapy", conflictType: "C", conflictDescription: "Humana requires ≥3 prior chemo lines. NCCN Category 2A covers bevacizumab + chemotherapy for platinum-resistant ovarian cancer at 2L. Requiring additional chemo failure delays guideline-recommended therapy.", cmsBehaviorFlags: '{"prior_auth_flag":true}', legalExposureTags: '["step therapy exceeds NCCN 2A requirements","delays guideline-recommended therapy"]', severity: "medium", lastValidatedTimestamp: today },
  ];

  gtRows.forEach(row => storage.upsertGroundTruth(row));

  // ─────────────────────────────────────────────────
  // SAMPLE PATIENTS (Org-Scoped)
  // ─────────────────────────────────────────────────
  const samplePatients = [
    { organizationId: DEMO_ORG_ID, patientId: "PT-2026-001", cancerType: "breast", stage: "Stage IV", biomarkers: JSON.stringify({ HER2: "low (IHC 1+)", HR: "positive", ESR1: "wildtype" }), priorTherapies: JSON.stringify([{ drug: "anastrozole", start: "2024-01", end: "2024-08", response: "progression" }, { drug: "fulvestrant", start: "2024-09", end: "2025-01", response: "progression" }]), performanceStatus: "ECOG 1", clinicName: "Memorial Oncology Center", state: "NY" },
    { organizationId: DEMO_ORG_ID, patientId: "PT-2026-002", cancerType: "lung", stage: "Stage IV", biomarkers: JSON.stringify({ EGFR: "L858R", PDL1: "40%", ALK: "negative" }), priorTherapies: JSON.stringify([]), performanceStatus: "ECOG 1", clinicName: "NYU Langone Thoracic Oncology", state: "NY" },
    { organizationId: DEMO_ORG_ID, patientId: "PT-2026-003", cancerType: "brain", stage: "Grade 4 GBM", biomarkers: JSON.stringify({ IDH: "wildtype", MGMT: "unmethylated", EGFR: "amplified" }), priorTherapies: JSON.stringify([{ drug: "temozolomide", start: "2025-03", end: "2025-06", response: "completion" }]), performanceStatus: "ECOG 1", clinicName: "Columbia Neuro-Oncology", state: "NY" },
  ];

  samplePatients.forEach(p => storage.insertPatient(p));

  // ─────────────────────────────────────────────────
  // SAMPLE DENIALS (Org-Scoped)
  // ─────────────────────────────────────────────────
  const sampleDenials = [
    { organizationId: DEMO_ORG_ID, denialRecordId: "DN-2026-001", patientId: "PT-2026-001", payerId: "UHC", payerName: "UnitedHealthcare", payerFaxNumber: PAYER_FAX_NUMBERS["UHC"], memberId: "UHC-ENC-XXXX", drugId: "enhertu", drugNameRaw: "Enhertu (trastuzumab deruxtecan)", icd10Codes: "C50.912,Z17.0", denialReasonCode: "not_medically_necessary", denialReasonText: "Requested therapy Enhertu (trastuzumab deruxtecan) does not meet medical necessity criteria for the submitted diagnosis. HER2-low breast cancer (IHC 1+) does not qualify under current coverage policy MP-ONC-1234. Coverage is limited to HER2-positive (IHC 3+ or ISH+) disease. Request denied.", denialDate: "2026-03-10", referenceNumber: "PA-2026-4491827", rawDocumentText: "PRIOR AUTHORIZATION DENIAL NOTICE\nUnitedHealthcare\nDate: March 10, 2026\nMember: [REDACTED]\nDrug: Enhertu (trastuzumab deruxtecan)\nDecision: DENIED\nReason: Not Medically Necessary\n\nRequested therapy does not meet medical necessity criteria for the submitted diagnosis. HER2-low breast cancer (IHC 1+) does not qualify under current coverage policy MP-ONC-1234." },
    { organizationId: DEMO_ORG_ID, denialRecordId: "DN-2026-002", patientId: "PT-2026-002", payerId: "UHC", payerName: "UnitedHealthcare", payerFaxNumber: PAYER_FAX_NUMBERS["UHC"], memberId: "UHC-OSI-XXXX", drugId: "tagrisso", drugNameRaw: "Tagrisso (osimertinib)", icd10Codes: "C34.12,C78.00", denialReasonCode: "step_therapy", denialReasonText: "Step therapy requirement not met. Tagrisso (osimertinib) is not covered as first-line therapy unless the member has trialed and failed a first-generation EGFR TKI (erlotinib or gefitinib) or has documented T790M mutation at diagnosis. Please provide documentation of prior TKI trial or T790M positivity.", denialDate: "2026-03-11", referenceNumber: "PA-2026-5582910", rawDocumentText: "PRIOR AUTHORIZATION DENIAL\nDate: March 11, 2026\nDrug: Tagrisso (osimertinib)\nDecision: DENIED — Step Therapy Not Met\n\nTagrisso is not covered as first-line therapy without prior first-generation EGFR TKI trial." },
    { organizationId: DEMO_ORG_ID, denialRecordId: "DN-2026-003", patientId: "PT-2026-003", payerId: "UHC", payerName: "UnitedHealthcare", payerFaxNumber: PAYER_FAX_NUMBERS["UHC"], memberId: "UHC-OPT-XXXX", drugId: "optune", drugNameRaw: "Optune (tumor treating fields)", icd10Codes: "C71.9", denialReasonCode: "experimental", denialReasonText: "Optune (tumor treating fields) is classified as experimental and investigational under UHC Medical Policy. This technology has not been shown to meet the UHC coverage criteria for proven benefit in standard clinical practice. Coverage is denied pending additional peer-reviewed evidence.", denialDate: "2026-03-12", referenceNumber: "PA-2026-6693044", rawDocumentText: "PRIOR AUTHORIZATION DENIAL\nDate: March 12, 2026\nDrug: Optune (tumor treating fields device)\nDecision: DENIED — Experimental/Investigational\n\nOptune is classified as experimental and investigational under UHC Medical Policy MP-ONC-2891." },
  ];

  sampleDenials.forEach(d => storage.insertDenial(d));

  return {
    status: "seeded",
    drugs: storage.getAllDrugs().length,
    nccn: storage.getAllNccn().length,
    policies: storage.getAllPayerPolicies().length,
    groundTruth: storage.getAllGroundTruth().length,
    patients: storage.getAllPatients(DEMO_ORG_ID).length,
    denials: storage.getAllDenials(DEMO_ORG_ID).length,
  };
}
