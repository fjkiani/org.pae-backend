/**
 * ETL Agent A1 — FDA Drug Ingest
 * Pulls all oncology drugs from openFDA label API across all cancer types.
 * Uses Cohere to parse indications text → structured drug record.
 */

import { CohereClient } from "cohere-ai";
import { storage } from "../storage";
import { agentLogger } from "../agents/logger";

const cohere = new CohereClient({ token: "lfWaRwjaOdTuZEOlP2uLFyFMTWcDfM0EtLLQZl7Q" });

// Pan-cancer taxonomy — all major NCCN-covered cancer types
export const ALL_CANCER_TYPES = [
  "breast", "lung", "colon", "ovarian", "brain",
  "prostate", "bladder", "pancreatic", "liver", "gastric",
  "esophageal", "cervical", "endometrial", "thyroid", "melanoma",
  "renal", "head_neck", "leukemia", "lymphoma", "myeloma",
  "sarcoma", "mesothelioma", "bile_duct", "neuroendocrine", "myelodysplastic"
];

// Search terms for openFDA per cancer type
const CANCER_SEARCH_TERMS: Record<string, string[]> = {
  breast: ["breast cancer", "HER2-positive breast", "triple-negative breast"],
  lung: ["non-small cell lung", "small cell lung", "NSCLC", "SCLC"],
  colon: ["colorectal cancer", "colon cancer", "rectal cancer"],
  ovarian: ["ovarian cancer", "fallopian tube", "peritoneal carcinoma"],
  brain: ["glioblastoma", "glioma", "brain tumor", "CNS tumor"],
  prostate: ["prostate cancer", "castration-resistant prostate"],
  bladder: ["bladder cancer", "urothelial carcinoma"],
  pancreatic: ["pancreatic cancer", "pancreatic adenocarcinoma"],
  liver: ["hepatocellular carcinoma", "liver cancer"],
  gastric: ["gastric cancer", "stomach cancer", "gastroesophageal"],
  esophageal: ["esophageal cancer", "esophageal carcinoma"],
  cervical: ["cervical cancer"],
  endometrial: ["endometrial cancer", "uterine cancer"],
  thyroid: ["thyroid cancer", "differentiated thyroid"],
  melanoma: ["melanoma", "unresectable melanoma"],
  renal: ["renal cell carcinoma", "kidney cancer"],
  head_neck: ["head and neck cancer", "squamous cell carcinoma head"],
  leukemia: ["acute myeloid leukemia", "AML", "acute lymphoblastic leukemia", "ALL", "CML", "CLL"],
  lymphoma: ["diffuse large B-cell lymphoma", "follicular lymphoma", "Hodgkin lymphoma", "NHL"],
  myeloma: ["multiple myeloma"],
  sarcoma: ["sarcoma", "soft tissue sarcoma"],
  mesothelioma: ["mesothelioma", "pleural mesothelioma"],
  bile_duct: ["cholangiocarcinoma", "bile duct cancer"],
  neuroendocrine: ["neuroendocrine tumor", "NET", "carcinoid"],
  myelodysplastic: ["myelodysplastic syndrome", "MDS"],
};

// Drug class inference from mechanism keywords
function inferDrugClass(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("antibody-drug conjugate") || t.includes("adc")) return "ADC";
  if (t.includes("checkpoint") || t.includes("pd-1") || t.includes("pd-l1") || t.includes("ctla-4")) return "checkpoint_inhibitor";
  if (t.includes("car-t") || t.includes("chimeric antigen")) return "cell_therapy";
  if (t.includes("bispecific")) return "bispecific_antibody";
  if (t.includes("kinase inhibitor") || t.includes("tyrosine kinase")) return "kinase_inhibitor";
  if (t.includes("parp inhibitor") || t.includes("olaparib") || t.includes("niraparib")) return "parp_inhibitor";
  if (t.includes("monoclonal antibody") || t.includes("mab")) return "monoclonal_antibody";
  if (t.includes("hormone") || t.includes("aromatase") || t.includes("endocrine")) return "endocrine";
  if (t.includes("proteasome")) return "proteasome_inhibitor";
  if (t.includes("imid") || t.includes("lenalidomide") || t.includes("pomalidomide")) return "immunomodulator";
  if (t.includes("radiopharmaceutical") || t.includes("lutetium") || t.includes("actinium")) return "radiopharmaceutical";
  return "targeted";
}

interface FDADrug {
  id: string;
  genericName: string;
  brandName: string;
  cancerType: string;
  indication: string;
  lineOfTherapy: string;
  biomarkerProfile: string;
  fdaApprovalStatus: string;
  fdaLabelSummary: string;
  fdaLabelReference: string;
  drugClass: string;
}

async function fetchFDADrugsForCancer(cancerType: string, searchTerm: string, runId: string): Promise<FDADrug[]> {
  const encoded = encodeURIComponent(`"${searchTerm}"`);
  const url = `https://api.fda.gov/drug/label.json?search=indications_and_usage:${encoded}&limit=20&skip=0`;

  let results: any[] = [];
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!resp.ok) return [];
    const data = await resp.json();
    results = data.results || [];
  } catch {
    return [];
  }

  const drugs: FDADrug[] = [];

  for (const r of results.slice(0, 10)) {
    const genericName = (r.openfda?.generic_name?.[0] || "").replace(/[^a-zA-Z0-9\s\-]/g, "").trim();
    const brandName = (r.openfda?.brand_name?.[0] || genericName).trim();
    if (!genericName || genericName.length < 3) continue;

    const indicationText = (r.indications_and_usage?.[0] || "").slice(0, 1200);
    const appNumber = r.openfda?.application_number?.[0] || "";

    // Ask Cohere to extract structured info
    let structured: any = {};
    try {
      const resp = await cohere.chat({
        model: "command-a-03-2025",
        message: `Extract structured data from this FDA drug label indication text for ${genericName} (${brandName}).
Return ONLY valid JSON, no prose:
{
  "indication": "one sentence describing the approved oncology indication",
  "line_of_therapy": "1L or 2L or 3L+ or maintenance or any",
  "biomarker_profile": {"key_biomarker": "value"},
  "approval_status": "approved or accelerated",
  "label_summary": "one sentence FDA approval summary with year if mentioned"
}

Indication text: """${indicationText.slice(0, 800)}"""`,
        temperature: 0.1,
        maxTokens: 300,
      });
      const raw = (resp.text || "{}").replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
      structured = JSON.parse(raw);
    } catch {
      structured = {
        indication: `${cancerType} cancer treatment`,
        line_of_therapy: "any",
        biomarker_profile: {},
        approval_status: "approved",
        label_summary: `FDA-approved ${genericName} for ${cancerType} cancer.`,
      };
    }

    const drugId = genericName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "").slice(0, 40);

    drugs.push({
      id: `${drugId}-${cancerType}`,
      genericName,
      brandName,
      cancerType,
      indication: structured.indication || `${cancerType} cancer`,
      lineOfTherapy: structured.line_of_therapy || "any",
      biomarkerProfile: JSON.stringify(structured.biomarker_profile || {}),
      fdaApprovalStatus: structured.approval_status || "approved",
      fdaLabelSummary: structured.label_summary || `FDA-approved for ${cancerType} cancer.`,
      fdaLabelReference: appNumber,
      drugClass: inferDrugClass(indicationText + " " + (r.description?.[0] || "")),
    });
  }

  agentLogger.log(runId, "etl_fda", `Fetched ${drugs.length} drugs for ${cancerType} (term: "${searchTerm}")`);
  return drugs;
}

export async function runFDAIngestAgent(runId: string): Promise<{ inserted: number; skipped: number; cancerTypes: number }> {
  agentLogger.log(runId, "etl_fda", "Starting pan-cancer FDA drug ingest...");
  let inserted = 0;
  let skipped = 0;

  for (const cancerType of ALL_CANCER_TYPES) {
    const searchTerms = CANCER_SEARCH_TERMS[cancerType] || [cancerType.replace("_", " ") + " cancer"];
    const seenIds = new Set<string>();

    for (const term of searchTerms.slice(0, 2)) {
      const drugs = await fetchFDADrugsForCancer(cancerType, term, runId);
      for (const drug of drugs) {
        if (seenIds.has(drug.id)) continue;
        seenIds.add(drug.id);
        const existing = storage.getDrug(drug.id);
        if (!existing) {
          storage.upsertDrug({ ...drug, createdAt: new Date().toISOString() });
          inserted++;
        } else {
          skipped++;
        }
      }
      // Rate limit respect
      await new Promise(r => setTimeout(r, 600));
    }
  }

  agentLogger.log(runId, "etl_fda", `FDA ingest complete. Inserted: ${inserted}, Skipped: ${skipped}`);
  return { inserted, skipped, cancerTypes: ALL_CANCER_TYPES.length };
}
