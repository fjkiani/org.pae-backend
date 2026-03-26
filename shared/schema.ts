import { pgTable, text, integer, boolean, real, jsonb, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── ORGANIZATIONS ────────────────────────────────────────────────────────────
export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),                      // uuid
  name: text("name").notNull(),                     // "MD Anderson Cancer Center"
  slug: text("slug").notNull().unique(),            // "md-anderson" (URL-safe, for subdomain routing)
  logoUrl: text("logo_url"),                        // Supabase Storage bucket path
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  npi: text("npi"),                                 // National Provider Identifier
  phone: text("phone"),
  outboundFax: text("outbound_fax"),               // facility outbound fax caller ID
  signingPhysician: text("signing_physician"),      // e.g. "Dr. Jane Smith"
  signingTitle: text("signing_title"),              // e.g. "Attending Oncologist"
  plan: text("plan").notNull().default("starter"),  // starter | pro | enterprise
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({ createdAt: true });
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

// ─── USERS ────────────────────────────────────────────────────────────────────
// mirrors Supabase auth.users; id = supabase user uuid
export const users = pgTable("users", {
  id: text("id").primaryKey(),                                          // = auth.users.id
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  role: text("role").notNull().default("provider"),                     // admin | provider | viewer
  fullName: text("full_name"),
  title: text("title"),                                                 // "Appeals Coordinator"
  email: text("email").notNull(),
  createdAt: text("created_at").notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ─── DRUGS ───────────────────────────────────────────────────────────────────
export const drugs = pgTable("drugs", {
  id: text("id").primaryKey(), // e.g. "enhertu"
  genericName: text("generic_name").notNull(),
  brandName: text("brand_name").notNull(),
  cancerType: text("cancer_type").notNull(), // breast | ovarian | brain | colon | lung
  indication: text("indication").notNull(),
  lineOfTherapy: text("line_of_therapy").notNull(), // 1L | 2L | 3L+ | any
  biomarkerProfile: text("biomarker_profile").notNull(), // JSON-stringified key/value
  fdaApprovalStatus: text("fda_approval_status").notNull(), // approved | not_approved | accelerated
  fdaLabelSummary: text("fda_label_summary").notNull(),
  fdaLabelReference: text("fda_label_reference"),
  drugClass: text("drug_class").notNull(), // ADC | checkpoint_inhibitor | targeted | chemo | immunotherapy
  createdAt: text("created_at").notNull(),
});

export const insertDrugSchema = createInsertSchema(drugs).omit({ createdAt: true });
export type InsertDrug = z.infer<typeof insertDrugSchema>;
export type Drug = typeof drugs.$inferSelect;

// ─── NCCN GUIDELINE ENTRIES ───────────────────────────────────────────────────
export const nccnGuidelines = pgTable("nccn_guidelines", {
  id: serial("id").primaryKey(),
  nccnId: text("nccn_id").notNull().unique(), // e.g. "NCCN-BREAST-2L-HER2LOW"
  guidelineVersion: text("guideline_version").notNull(), // "Breast Cancer v2.2026"
  cancerType: text("cancer_type").notNull(),
  indication: text("indication").notNull(),
  biomarkerProfile: text("biomarker_profile").notNull(),
  lineOfTherapy: text("line_of_therapy").notNull(),
  drugId: text("drug_id").notNull(),
  nccnCategory: text("nccn_category").notNull(), // "1" | "2A" | "2B" | "3"
  recommendationType: text("recommendation_type").notNull(), // preferred | other_recommended | useful_in_certain
  pageReference: text("page_reference"),
  fullCitationText: text("full_citation_text").notNull(),
  lastUpdated: text("last_updated").notNull(),
});

export const insertNccnSchema = createInsertSchema(nccnGuidelines).omit({ id: true });
export type InsertNccn = z.infer<typeof insertNccnSchema>;
export type NccnGuideline = typeof nccnGuidelines.$inferSelect;

// ─── PAYER POLICY RULES ───────────────────────────────────────────────────────
export const payerPolicies = pgTable("payer_policies", {
  id: serial("id").primaryKey(),
  payerId: text("payer_id").notNull(), // UHC | Cigna | Aetna | Humana
  policyId: text("policy_id").notNull(), // payer internal policy number
  policyVersion: text("policy_version").notNull(), // date or version string
  drugId: text("drug_id").notNull(),
  cancerType: text("cancer_type").notNull(),
  indication: text("indication").notNull(),
  biomarkerConstraints: text("biomarker_constraints"), // e.g. "HER2-positive only"
  stepTherapyRequirements: text("step_therapy_requirements"), // comma-separated list
  experimentalInvestigationalFlag: boolean("experimental_investigational_flag").notNull().default(false),
  experimentalRationale: text("experimental_rationale"),
  priorAuthRequired: boolean("prior_auth_required").notNull().default(true),
  notMedicallyNecessaryLanguage: text("not_medically_necessary_language"),
  coverageCriteriaText: text("coverage_criteria_text").notNull(),
  policySourceUrl: text("policy_source_url"),
  policyEffectiveDate: text("policy_effective_date").notNull(),
  lastValidated: text("last_validated").notNull(),
});

export const insertPayerPolicySchema = createInsertSchema(payerPolicies).omit({ id: true });
export type InsertPayerPolicy = z.infer<typeof insertPayerPolicySchema>;
export type PayerPolicy = typeof payerPolicies.$inferSelect;

// ─── CMS TRANSPARENCY BEHAVIOR ────────────────────────────────────────────────
export const cmsBehavior = pgTable("cms_behavior", {
  id: serial("id").primaryKey(),
  payerId: text("payer_id").notNull(),
  planId: text("plan_id").notNull(),
  geography: text("geography"), // state abbreviation
  drugId: text("drug_id").notNull(),
  allowedAmount: real("allowed_amount"), // 0.00 = systemic barrier
  priorAuthFlag: boolean("prior_auth_flag"),
  fileReference: text("file_reference"),
  reportingPeriod: text("reporting_period"),
  notes: text("notes"),
});

export const insertCmsBehaviorSchema = createInsertSchema(cmsBehavior).omit({ id: true });
export type InsertCmsBehavior = z.infer<typeof insertCmsBehaviorSchema>;
export type CmsBehavior = typeof cmsBehavior.$inferSelect;

// ─── GROUND TRUTH / MISMATCH TABLE ───────────────────────────────────────────
export const groundTruth = pgTable("ground_truth", {
  id: serial("id").primaryKey(),
  groundTruthRowId: text("ground_truth_row_id").notNull().unique(), // e.g. "GT-UHC-ENHERTU-2L"
  drugId: text("drug_id").notNull(),
  cancerType: text("cancer_type").notNull(),
  indication: text("indication").notNull(),
  biomarkerProfile: text("biomarker_profile").notNull(),
  lineOfTherapy: text("line_of_therapy").notNull(),
  nccnId: text("nccn_id").notNull(),
  nccnCategory: text("nccn_category").notNull(),
  payerId: text("payer_id").notNull(),
  policyId: text("policy_id").notNull(),
  denialRationaleType: text("denial_rationale_type").notNull(), // step_therapy | experimental | not_medically_necessary | other
  denialTextSnippet: text("denial_text_snippet"),
  conflictType: text("conflict_type").notNull(), // A | B | C | D
  conflictDescription: text("conflict_description").notNull(),
  cmsBehaviorFlags: text("cms_behavior_flags"), // JSON summary
  legalExposureTags: text("legal_exposure_tags").notNull(), // JSON array
  severity: text("severity").notNull().default("high"), // high | medium | low
  lastValidatedTimestamp: text("last_validated_timestamp").notNull(),
});

export const insertGroundTruthSchema = createInsertSchema(groundTruth).omit({ id: true });
export type InsertGroundTruth = z.infer<typeof insertGroundTruthSchema>;
export type GroundTruth = typeof groundTruth.$inferSelect;

// ─── PATIENT PROFILES ─────────────────────────────────────────────────────────
export const patientProfiles = pgTable("patient_profiles", {
  id: serial("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  patientId: text("patient_id").notNull(),          // unique per org (not globally unique)
  cancerType: text("cancer_type").notNull(),
  stage: text("stage").notNull(), // Stage I | II | III | IV
  biomarkers: text("biomarkers").notNull(), // JSON: { HER2: "low", HR: "positive", ... }
  priorTherapies: text("prior_therapies").notNull(), // JSON array
  performanceStatus: text("performance_status"), // ECOG 0-4
  clinicName: text("clinic_name"),
  state: text("state").notNull(), // for bad-faith statute lookup
  createdAt: text("created_at").notNull(),
});

export const insertPatientSchema = createInsertSchema(patientProfiles).omit({ id: true, createdAt: true });
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type PatientProfile = typeof patientProfiles.$inferSelect;

// ─── DENIAL RECORDS ───────────────────────────────────────────────────────────
export const denialRecords = pgTable("denial_records", {
  id: serial("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  denialRecordId: text("denial_record_id").notNull().unique(),
  patientId: text("patient_id").notNull(),
  payerId: text("payer_id").notNull(),
  payerName: text("payer_name").notNull(),
  payerFaxNumber: text("payer_fax_number"),
  memberId: text("member_id"), // encrypted in production
  drugId: text("drug_id"),
  drugNameRaw: text("drug_name_raw").notNull(),
  icd10Codes: text("icd10_codes").notNull(), // comma-separated
  denialReasonCode: text("denial_reason_code").notNull(), // step_therapy | experimental | not_medically_necessary | other
  denialReasonText: text("denial_reason_text").notNull(),
  denialDate: text("denial_date").notNull(),
  referenceNumber: text("reference_number"),
  rawDocumentText: text("raw_document_text"),
  groundTruthRowId: text("ground_truth_row_id"), // populated after matching
  status: text("status").notNull().default("pending"), // pending | matched | appeal_generated | faxed | resolved
  createdAt: text("created_at").notNull(),
});

export const insertDenialSchema = createInsertSchema(denialRecords).omit({ id: true, createdAt: true, groundTruthRowId: true, status: true });
export type InsertDenial = z.infer<typeof insertDenialSchema>;
export type DenialRecord = typeof denialRecords.$inferSelect;

// ─── APPEAL PACKETS ───────────────────────────────────────────────────────────
export const appealPackets = pgTable("appeal_packets", {
  id: serial("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  appealId: text("appeal_id").notNull().unique(),
  denialRecordId: text("denial_record_id").notNull(),
  patientId: text("patient_id").notNull(),
  groundTruthRowId: text("ground_truth_row_id").notNull(),
  payerId: text("payer_id").notNull(),
  payerFaxNumber: text("payer_fax_number"),
  status: text("status").notNull().default("draft"), // draft | generated | faxed | delivered | failed
  appealType: text("appeal_type").notNull().default("first_level"), // first_level | second_level | expedited
  nccnCitation: text("nccn_citation").notNull(),
  fdaCitation: text("fda_citation").notNull(),
  conflictSummary: text("conflict_summary").notNull(),
  legalFramework: text("legal_framework").notNull(),
  generatedContent: text("generated_content"), // full JSON of all sections
  pdfPath: text("pdf_path"),
  faxJobId: text("fax_job_id"),
  faxStatus: text("fax_status"),
  faxSentAt: text("fax_sent_at"),
  faxDeliveredAt: text("fax_delivered_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const insertAppealSchema = createInsertSchema(appealPackets).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAppeal = z.infer<typeof insertAppealSchema>;
export type AppealPacket = typeof appealPackets.$inferSelect;

// ─── FAX LOG ──────────────────────────────────────────────────────────────────
export const faxLog = pgTable("fax_log", {
  id: serial("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  appealId: text("appeal_id").notNull(),
  payerId: text("payer_id").notNull(),
  faxNumber: text("fax_number").notNull(),
  jobId: text("job_id"),
  status: text("status").notNull().default("queued"), // queued | sending | delivered | failed
  costCents: integer("cost_cents"),
  pageCount: integer("page_count"),
  attemptNumber: integer("attempt_number").notNull().default(1),
  sentAt: text("sent_at"),
  deliveredAt: text("delivered_at"),
  errorMessage: text("error_message"),
  metadata: text("metadata"), // JSON
});

export const insertFaxLogSchema = createInsertSchema(faxLog).omit({ id: true });
export type InsertFaxLog = z.infer<typeof insertFaxLogSchema>;
export type FaxLog = typeof faxLog.$inferSelect;
