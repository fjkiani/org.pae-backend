/**
 * ETL Agent A2 — NCCN Rule Extractor
 * Uses Cohere to extract structured NCCN guideline rules.
 * Sources: uploaded PDF text OR the curated knowledge base built into Cohere.
 * In production: point at actual NCCN PDF text chunks.
 */

import { CohereClient } from "cohere-ai";
import { storage } from "../storage";
import { agentLogger } from "../agents/logger";

const cohere = new CohereClient({ token: "lfWaRwjaOdTuZEOlP2uLFyFMTWcDfM0EtLLQZl7Q" });

// NCCN guideline versions by cancer type
export const NCCN_GUIDELINES: Record<string, { version: string; focus: string[] }> = {
  breast: { version: "Breast Cancer v2.2026", focus: ["HER2+", "HER2-low", "TNBC", "HR+/HER2-", "inflammatory", "early stage", "metastatic"] },
  lung: { version: "NSCLC v4.2026", focus: ["EGFR", "ALK", "ROS1", "BRAF", "MET", "KRAS", "RET", "NTRK", "PD-L1", "squamous", "adenocarcinoma"] },
  colon: { version: "Colon Cancer v1.2026", focus: ["MSI-H", "dMMR", "BRAF V600E", "RAS wildtype", "HER2+", "stage IV", "resectable", "unresectable"] },
  ovarian: { version: "Ovarian Cancer v2.2026", focus: ["BRCA mutated", "HRD positive", "platinum sensitive", "platinum resistant", "FOLR1", "recurrent"] },
  brain: { version: "CNS Cancers v2.2026", focus: ["GBM IDH wildtype", "IDH mutant glioma", "grade 2", "grade 3", "anaplastic", "medulloblastoma", "meningioma"] },
  prostate: { version: "Prostate Cancer v2.2026", focus: ["castration-resistant", "mCRPC", "mHSPC", "BRCA mutated", "AR-V7", "PSMA", "neuroendocrine"] },
  bladder: { version: "Bladder Cancer v2.2026", focus: ["urothelial", "FGFR3", "cisplatin-eligible", "cisplatin-ineligible", "PD-L1", "BCG-unresponsive"] },
  pancreatic: { version: "Pancreatic Adenocarcinoma v1.2026", focus: ["BRCA mutated", "KRAS G12C", "MSI-H", "NTRK", "resectable", "borderline", "metastatic"] },
  liver: { version: "Hepatocellular Carcinoma v2.2026", focus: ["Child-Pugh A", "BCLC B", "BCLC C", "AFP", "PD-L1", "MET", "VEGF"] },
  gastric: { version: "Gastric Cancer v2.2026", focus: ["HER2+", "PD-L1 CPS≥1", "MSI-H", "CLDN18.2", "VEGFR2", "first-line", "second-line"] },
  esophageal: { version: "Esophageal Cancer v2.2026", focus: ["squamous", "adenocarcinoma", "PD-L1", "HER2+", "locally advanced", "metastatic"] },
  cervical: { version: "Cervical Cancer v1.2026", focus: ["PD-L1", "MSI-H", "VEGF", "locally advanced", "recurrent", "metastatic", "cisplatin"] },
  endometrial: { version: "Uterine Neoplasms v2.2026", focus: ["dMMR", "MSI-H", "HER2+", "POLE mutant", "hormone receptor positive", "stage III/IV"] },
  thyroid: { version: "Thyroid Carcinoma v2.2026", focus: ["BRAF V600E", "RET", "NTRK", "differentiated", "medullary", "anaplastic", "radioiodine refractory"] },
  melanoma: { version: "Melanoma Cutaneous v2.2026", focus: ["BRAF V600E", "BRAF/MEK", "PD-1", "CTLA-4", "unresectable", "stage III", "stage IV", "uveal"] },
  renal: { version: "Kidney Cancer v3.2026", focus: ["clear cell", "non-clear cell", "IMDC favorable", "IMDC intermediate/poor", "VHL", "MET", "VEGF", "PD-1"] },
  head_neck: { version: "Head and Neck Cancers v2.2026", focus: ["HPV+", "HPV-", "PD-L1 CPS≥1", "EGFR", "platinum-eligible", "recurrent", "metastatic"] },
  leukemia: { version: "AML v2.2026 / ALL v3.2026 / CML v2.2026", focus: ["FLT3 mutated", "IDH1/IDH2", "NPM1", "TP53", "BCR-ABL", "Ph+", "CD19", "CD20"] },
  lymphoma: { version: "DLBCL v4.2026 / Follicular v3.2026 / HL v2.2026", focus: ["CD20", "CD19 CAR-T", "bispecific", "R-CHOP", "DLBCL", "follicular", "mantle cell"] },
  myeloma: { version: "Multiple Myeloma v3.2026", focus: ["CD38", "BCMA", "SLAMF7", "proteasome inhibitor", "IMiD", "newly diagnosed", "relapsed/refractory"] },
  sarcoma: { version: "Soft Tissue Sarcoma v1.2026", focus: ["NTRK fusion", "CDK4 amplification", "MDM2", "VEGFR", "leiomyosarcoma", "liposarcoma"] },
  mesothelioma: { version: "Mesothelioma v1.2026", focus: ["PD-L1", "CTLA-4", "cisplatin", "pemetrexed", "pleural", "peritoneal", "BAP1"] },
  bile_duct: { version: "Biliary Tract v1.2026", focus: ["IDH1", "FGFR2", "BRAF V600E", "NTRK", "MSI-H", "HER2+", "intrahepatic", "extrahepatic"] },
  neuroendocrine: { version: "Neuroendocrine Tumors v2.2026", focus: ["SST receptor", "everolimus", "sunitinib", "lutetium PRRT", "well-differentiated", "poorly differentiated"] },
  myelodysplastic: { version: "MDS v1.2026", focus: ["lower-risk", "higher-risk", "del5q", "SF3B1", "TP53", "azacitidine", "lenalidomide", "HMA"] },
};

async function extractNCCNRulesForCancer(
  cancerType: string,
  guideline: { version: string; focus: string[] },
  runId: string
): Promise<number> {
  const drugs = storage.getDrugsByCancerType(cancerType);
  if (drugs.length === 0) {
    agentLogger.log(runId, "etl_nccn", `No drugs found for ${cancerType}, skipping NCCN extraction`);
    return 0;
  }

  let inserted = 0;

  for (const drug of drugs.slice(0, 15)) {
    // Check if NCCN rule already exists
    const existing = storage.getNccnByDrugAndCancer(drug.id, cancerType);
    if (existing.length > 0) continue;

    try {
      const resp = await cohere.chat({
        model: "command-a-03-2025",
        message: `You are an NCCN guideline expert. Based on your clinical knowledge of ${guideline.version}, extract the NCCN recommendation for:
Drug: ${drug.genericName} (${drug.brandName})
Cancer type: ${cancerType}
Indication: ${drug.indication}

Return ONLY valid JSON, no prose:
{
  "nccn_category": "1 or 2A or 2B or 3 or not_listed",
  "recommendation_type": "preferred or other_recommended or useful_in_certain or not_recommended",
  "line_of_therapy": "1L or 2L or 3L+ or maintenance or any",
  "biomarker_profile": {"biomarker": "value"},
  "page_reference": "approximate section or page reference",
  "citation_text": "one sentence describing the NCCN recommendation and its basis",
  "is_listed": true or false
}

If this drug is NOT in ${guideline.version} for ${cancerType}, return is_listed: false and nccn_category: "not_listed".`,
        temperature: 0.15,
        maxTokens: 400,
      });

      const raw = (resp.text || "{}").replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
      const parsed = JSON.parse(raw);

      if (!parsed.is_listed || parsed.nccn_category === "not_listed") continue;
      if (!["1", "2A", "2B", "3"].includes(parsed.nccn_category)) continue;

      const nccnId = `NCCN-${cancerType.toUpperCase()}-${drug.id.toUpperCase()}-${parsed.line_of_therapy || "ANY"}`.slice(0, 80);

      const existing2 = storage.getNccnGuideline(nccnId);
      if (!existing2) {
        storage.insertNccn({
          nccnId,
          guidelineVersion: guideline.version,
          cancerType,
          indication: drug.indication,
          biomarkerProfile: JSON.stringify(parsed.biomarker_profile || {}),
          lineOfTherapy: parsed.line_of_therapy || "any",
          drugId: drug.id,
          nccnCategory: parsed.nccn_category,
          recommendationType: parsed.recommendation_type || "other_recommended",
          pageReference: parsed.page_reference || "",
          fullCitationText: parsed.citation_text || `${drug.genericName} recommended in ${guideline.version}`,
          lastUpdated: new Date().toISOString().split("T")[0],
        });
        inserted++;
      }

      await new Promise(r => setTimeout(r, 400));
    } catch (err) {
      agentLogger.log(runId, "etl_nccn", `Error extracting NCCN for ${drug.id}: ${err}`);
    }
  }

  agentLogger.log(runId, "etl_nccn", `Extracted ${inserted} NCCN rules for ${cancerType}`);
  return inserted;
}

export async function runNCCNExtractionAgent(runId: string, cancerTypes?: string[]): Promise<{ inserted: number }> {
  agentLogger.log(runId, "etl_nccn", "Starting NCCN rule extraction across all cancer types...");
  let totalInserted = 0;

  const targets = cancerTypes || Object.keys(NCCN_GUIDELINES);
  for (const cancerType of targets) {
    const guideline = NCCN_GUIDELINES[cancerType];
    if (!guideline) continue;
    const n = await extractNCCNRulesForCancer(cancerType, guideline, runId);
    totalInserted += n;
  }

  agentLogger.log(runId, "etl_nccn", `NCCN extraction complete. Total rules: ${totalInserted}`);
  return { inserted: totalInserted };
}
