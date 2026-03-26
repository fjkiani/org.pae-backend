import {
  Drug, InsertDrug, drugs,
  NccnGuideline, InsertNccn, nccnGuidelines,
  PayerPolicy, InsertPayerPolicy, payerPolicies,
  CmsBehavior, InsertCmsBehavior, cmsBehavior,
  GroundTruth, InsertGroundTruth, groundTruth,
  PatientProfile, InsertPatient, patientProfiles,
  DenialRecord, InsertDenial, denialRecords,
  AppealPacket, InsertAppeal, appealPackets,
  FaxLog, InsertFaxLog, faxLog,
  Organization, InsertOrganization, organizations,
  User, InsertUser, users,
} from "@shared/schema";

export interface IStorage {
  // ─── Drugs (global — shared clinical knowledge base) ─────────────────────────
  getDrug(id: string): Drug | undefined;
  getAllDrugs(): Drug[];
  getDrugsByCancerType(cancerType: string): Drug[];
  upsertDrug(drug: InsertDrug & { id: string }): Drug;

  // ─── NCCN (global — shared) ──────────────────────────────────────────────────
  getNccnGuideline(nccnId: string): NccnGuideline | undefined;
  getNccnByDrugAndCancer(drugId: string, cancerType: string): NccnGuideline[];
  getAllNccn(): NccnGuideline[];
  insertNccn(entry: InsertNccn): NccnGuideline;

  // ─── Payer Policies (global — shared) ────────────────────────────────────────
  getPayerPolicy(payerId: string, drugId: string): PayerPolicy[];
  getAllPayerPolicies(): PayerPolicy[];
  insertPayerPolicy(policy: InsertPayerPolicy): PayerPolicy;

  // ─── CMS Behavior (global — shared) ──────────────────────────────────────────
  getCmsBehavior(payerId: string, drugId: string): CmsBehavior[];
  insertCmsBehavior(entry: InsertCmsBehavior): CmsBehavior;

  // ─── Ground Truth (global — shared) ──────────────────────────────────────────
  getGroundTruth(id: string): GroundTruth | undefined;
  getGroundTruthByPayerAndDrug(payerId: string, drugId: string): GroundTruth[];
  getGroundTruthByDrugAndCancer(drugId: string, cancerType: string): GroundTruth[];
  getAllGroundTruth(): GroundTruth[];
  upsertGroundTruth(row: InsertGroundTruth): GroundTruth;

  // ─── Patients (tenant-scoped) ─────────────────────────────────────────────────
  getPatient(patientId: string, orgId: string): PatientProfile | undefined;
  insertPatient(patient: InsertPatient): PatientProfile;
  getAllPatients(orgId: string): PatientProfile[];

  // ─── Denials (tenant-scoped) ──────────────────────────────────────────────────
  getDenial(denialRecordId: string, orgId: string): DenialRecord | undefined;
  getAllDenials(orgId: string): DenialRecord[];
  insertDenial(denial: InsertDenial): DenialRecord;
  updateDenialStatus(denialRecordId: string, status: string, groundTruthRowId?: string): DenialRecord;

  // ─── Appeals (tenant-scoped) ──────────────────────────────────────────────────
  getAppeal(appealId: string, orgId: string): AppealPacket | undefined;
  getAppealByDenial(denialRecordId: string, orgId: string): AppealPacket | undefined;
  getAllAppeals(orgId: string): AppealPacket[];
  insertAppeal(appeal: InsertAppeal): AppealPacket;
  updateAppeal(appealId: string, updates: Partial<AppealPacket>): AppealPacket;

  // ─── Fax Log (tenant-scoped) ──────────────────────────────────────────────────
  getFaxLog(appealId: string, orgId: string): FaxLog[];
  getAllFaxLogs(orgId: string): FaxLog[];
  insertFaxLog(log: InsertFaxLog): FaxLog;
  updateFaxLog(id: number, updates: Partial<FaxLog>): FaxLog;

  // ─── Organizations ────────────────────────────────────────────────────────────
  getOrganization(id: string): Organization | undefined;
  getOrganizationBySlug(slug: string): Organization | undefined;
  insertOrganization(org: InsertOrganization & { id: string }): Organization;
  updateOrganization(id: string, updates: Partial<Organization>): Organization;

  // ─── Users ────────────────────────────────────────────────────────────────────
  getUser(id: string): User | undefined;
  getUsersByOrg(orgId: string): User[];
  insertUser(user: InsertUser): User;

  // ─── Stats (tenant-scoped) ───────────────────────────────────────────────────
  getStats(orgId: string): {
    totalDenials: number;
    totalAppeals: number;
    pendingDenials: number;
    faxedAppeals: number;
    deliveredAppeals: number;
    groundTruthRows: number;
    drugsCovered: number;
    payersCovered: number;
  };
}

export class MemStorage implements IStorage {
  private drugsMap = new Map<string, Drug>();
  private nccnMap = new Map<number, NccnGuideline>();
  private payerPoliciesMap = new Map<number, PayerPolicy>();
  private cmsBehaviorMap = new Map<number, CmsBehavior>();
  private groundTruthMap = new Map<number, GroundTruth>();
  private patientsMap = new Map<string, PatientProfile>();  // key: orgId:patientId
  private denialsMap = new Map<string, DenialRecord>();
  private appealsMap = new Map<string, AppealPacket>();
  private faxLogMap = new Map<number, FaxLog>();
  private orgsMap = new Map<string, Organization>();
  private usersMap = new Map<string, User>();

  private nccnSeq = 1;
  private policySeq = 1;
  private cmsSeq = 1;
  private gtSeq = 1;
  private patientSeq = 1;
  private denialSeq = 1;
  private appealSeq = 1;
  private faxSeq = 1;

  // ─── Drugs ──────────────────────────────────────────────────────────────────
  getDrug(id: string) { return this.drugsMap.get(id); }
  getAllDrugs() { return Array.from(this.drugsMap.values()); }
  getDrugsByCancerType(cancerType: string) {
    return Array.from(this.drugsMap.values()).filter(d => d.cancerType === cancerType);
  }
  upsertDrug(drug: InsertDrug & { id: string }): Drug {
    const now = new Date().toISOString();
    const d: Drug = { ...drug, createdAt: now };
    this.drugsMap.set(drug.id, d);
    return d;
  }

  // ─── NCCN ───────────────────────────────────────────────────────────────────
  getNccnGuideline(nccnId: string) {
    return Array.from(this.nccnMap.values()).find(n => n.nccnId === nccnId);
  }
  getNccnByDrugAndCancer(drugId: string, cancerType: string) {
    return Array.from(this.nccnMap.values()).filter(n => n.drugId === drugId && n.cancerType === cancerType);
  }
  getAllNccn() { return Array.from(this.nccnMap.values()); }
  insertNccn(entry: InsertNccn): NccnGuideline {
    const id = this.nccnSeq++;
    const n: NccnGuideline = { ...entry, id };
    this.nccnMap.set(id, n);
    return n;
  }

  // ─── Payer Policies ─────────────────────────────────────────────────────────
  getPayerPolicy(payerId: string, drugId: string) {
    return Array.from(this.payerPoliciesMap.values()).filter(p => p.payerId === payerId && p.drugId === drugId);
  }
  getAllPayerPolicies() { return Array.from(this.payerPoliciesMap.values()); }
  insertPayerPolicy(policy: InsertPayerPolicy): PayerPolicy {
    const id = this.policySeq++;
    const p: PayerPolicy = { ...policy, id };
    this.payerPoliciesMap.set(id, p);
    return p;
  }

  // ─── CMS ────────────────────────────────────────────────────────────────────
  getCmsBehavior(payerId: string, drugId: string) {
    return Array.from(this.cmsBehaviorMap.values()).filter(c => c.payerId === payerId && c.drugId === drugId);
  }
  insertCmsBehavior(entry: InsertCmsBehavior): CmsBehavior {
    const id = this.cmsSeq++;
    const c: CmsBehavior = { ...entry, id };
    this.cmsBehaviorMap.set(id, c);
    return c;
  }

  // ─── Ground Truth ───────────────────────────────────────────────────────────
  getGroundTruth(id: string) {
    return Array.from(this.groundTruthMap.values()).find(g => g.groundTruthRowId === id);
  }
  getGroundTruthByPayerAndDrug(payerId: string, drugId: string) {
    return Array.from(this.groundTruthMap.values()).filter(g => g.payerId === payerId && g.drugId === drugId);
  }
  getGroundTruthByDrugAndCancer(drugId: string, cancerType: string) {
    return Array.from(this.groundTruthMap.values()).filter(g => g.drugId === drugId && g.cancerType === cancerType);
  }
  getAllGroundTruth() { return Array.from(this.groundTruthMap.values()); }
  upsertGroundTruth(row: InsertGroundTruth): GroundTruth {
    const existing = this.getGroundTruth(row.groundTruthRowId);
    if (existing) {
      const updated = { ...existing, ...row };
      this.groundTruthMap.set(existing.id, updated);
      return updated;
    }
    const id = this.gtSeq++;
    const g: GroundTruth = { ...row, id };
    this.groundTruthMap.set(id, g);
    return g;
  }

  // ─── Patients (org-scoped) ───────────────────────────────────────────────────
  getPatient(patientId: string, orgId: string) {
    return Array.from(this.patientsMap.values()).find(
      p => p.patientId === patientId && p.organizationId === orgId
    );
  }
  getAllPatients(orgId: string) {
    return Array.from(this.patientsMap.values()).filter(p => p.organizationId === orgId);
  }
  insertPatient(patient: InsertPatient): PatientProfile {
    const id = this.patientSeq++;
    const now = new Date().toISOString();
    const p: PatientProfile = { ...patient, id, createdAt: now };
    this.patientsMap.set(`${patient.organizationId}:${patient.patientId}`, p);
    return p;
  }

  // ─── Denials (org-scoped) ────────────────────────────────────────────────────
  getDenial(denialRecordId: string, orgId: string) {
    const d = this.denialsMap.get(denialRecordId);
    return d?.organizationId === orgId ? d : undefined;
  }
  getAllDenials(orgId: string) {
    return Array.from(this.denialsMap.values())
      .filter(d => d.organizationId === orgId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  insertDenial(denial: InsertDenial): DenialRecord {
    const id = this.denialSeq++;
    const now = new Date().toISOString();
    const d: DenialRecord = { ...denial, id, groundTruthRowId: null, status: "pending", createdAt: now };
    this.denialsMap.set(denial.denialRecordId, d);
    return d;
  }
  updateDenialStatus(denialRecordId: string, status: string, groundTruthRowId?: string): DenialRecord {
    const denial = this.denialsMap.get(denialRecordId);
    if (!denial) throw new Error(`Denial ${denialRecordId} not found`);
    const updated = { ...denial, status, groundTruthRowId: groundTruthRowId ?? denial.groundTruthRowId };
    this.denialsMap.set(denialRecordId, updated);
    return updated;
  }

  // ─── Appeals (org-scoped) ────────────────────────────────────────────────────
  getAppeal(appealId: string, orgId: string) {
    const a = this.appealsMap.get(appealId);
    return a?.organizationId === orgId ? a : undefined;
  }
  getAppealByDenial(denialRecordId: string, orgId: string) {
    return Array.from(this.appealsMap.values()).find(
      a => a.denialRecordId === denialRecordId && a.organizationId === orgId
    );
  }
  getAllAppeals(orgId: string) {
    return Array.from(this.appealsMap.values())
      .filter(a => a.organizationId === orgId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  insertAppeal(appeal: InsertAppeal): AppealPacket {
    const id = this.appealSeq++;
    const now = new Date().toISOString();
    const a: AppealPacket = { ...appeal, id, createdAt: now, updatedAt: now };
    this.appealsMap.set(appeal.appealId, a);
    return a;
  }
  updateAppeal(appealId: string, updates: Partial<AppealPacket>): AppealPacket {
    const appeal = this.appealsMap.get(appealId);
    if (!appeal) throw new Error(`Appeal ${appealId} not found`);
    const updated = { ...appeal, ...updates, updatedAt: new Date().toISOString() };
    this.appealsMap.set(appealId, updated);
    return updated;
  }

  // ─── Fax Log (org-scoped) ────────────────────────────────────────────────────
  getFaxLog(appealId: string, orgId: string) {
    return Array.from(this.faxLogMap.values()).filter(
      f => f.appealId === appealId && f.organizationId === orgId
    );
  }
  getAllFaxLogs(orgId: string) {
    return Array.from(this.faxLogMap.values()).filter(f => f.organizationId === orgId);
  }
  insertFaxLog(log: InsertFaxLog): FaxLog {
    const id = this.faxSeq++;
    const f: FaxLog = { ...log, id };
    this.faxLogMap.set(id, f);
    return f;
  }
  updateFaxLog(id: number, updates: Partial<FaxLog>): FaxLog {
    const log = this.faxLogMap.get(id);
    if (!log) throw new Error(`Fax log ${id} not found`);
    const updated = { ...log, ...updates };
    this.faxLogMap.set(id, updated);
    return updated;
  }

  // ─── Organizations ───────────────────────────────────────────────────────────
  getOrganization(id: string) { return this.orgsMap.get(id); }
  getOrganizationBySlug(slug: string) {
    return Array.from(this.orgsMap.values()).find(o => o.slug === slug);
  }
  insertOrganization(org: InsertOrganization & { id: string }): Organization {
    const now = new Date().toISOString();
    const o: Organization = { ...org, createdAt: now };
    this.orgsMap.set(org.id, o);
    return o;
  }
  updateOrganization(id: string, updates: Partial<Organization>): Organization {
    const org = this.orgsMap.get(id);
    if (!org) throw new Error(`Organization ${id} not found`);
    const updated = { ...org, ...updates };
    this.orgsMap.set(id, updated);
    return updated;
  }

  // ─── Users ──────────────────────────────────────────────────────────────────
  getUser(id: string) { return this.usersMap.get(id); }
  getUsersByOrg(orgId: string) {
    return Array.from(this.usersMap.values()).filter(u => u.organizationId === orgId);
  }
  insertUser(user: InsertUser): User {
    const now = new Date().toISOString();
    const u: User = { ...user, createdAt: now };
    this.usersMap.set(user.id, u);
    return u;
  }

  // ─── Stats (org-scoped) ─────────────────────────────────────────────────────
  getStats(orgId: string) {
    const denials = Array.from(this.denialsMap.values()).filter(d => d.organizationId === orgId);
    const appeals = Array.from(this.appealsMap.values()).filter(a => a.organizationId === orgId);
    const payers = new Set(Array.from(this.groundTruthMap.values()).map(g => g.payerId));
    return {
      totalDenials: denials.length,
      totalAppeals: appeals.length,
      pendingDenials: denials.filter(d => d.status === "pending").length,
      faxedAppeals: appeals.filter(a => a.status === "faxed" || a.status === "delivered").length,
      deliveredAppeals: appeals.filter(a => a.status === "delivered").length,
      groundTruthRows: this.groundTruthMap.size,
      drugsCovered: this.drugsMap.size,
      payersCovered: payers.size,
    };
  }
}

export const storage = new MemStorage();
