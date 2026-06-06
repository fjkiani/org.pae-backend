import {
  Drug, InsertDrug,
  NccnGuideline, InsertNccn,
  PayerPolicy, InsertPayerPolicy,
  CmsBehavior, InsertCmsBehavior,
  GroundTruth, InsertGroundTruth,
  PatientProfile, InsertPatient,
  DenialRecord, InsertDenial,
  AppealPacket, InsertAppeal,
  FaxLog, InsertFaxLog,
  Organization, InsertOrganization,
  User, InsertUser,
} from "@shared/schema";

export interface PayerIntelligenceRow {
  payerId: string;
  drugId: string;
  denialReasonCode: string;
  totalDenials: number;
  totalAppeals: number;
  approvedOutcomes: number;
  winRate: number;
  topWinningArgument: string;
}

export interface WinRateStats {
  overall: number;
  byPayer: Record<string, number>;
  byDrug: Record<string, number>;
  byReason: Record<string, number>;
  totalOutcomes: number;
}

export interface IStorage {
  getDrug(id: string): Drug | undefined;
  getAllDrugs(): Drug[];
  getDrugsByCancerType(cancerType: string): Drug[];
  upsertDrug(drug: InsertDrug & { id: string }): Drug;

  getNccnGuideline(nccnId: string): NccnGuideline | undefined;
  getNccnByDrugAndCancer(drugId: string, cancerType: string): NccnGuideline[];
  getAllNccn(): NccnGuideline[];
  insertNccn(entry: InsertNccn): NccnGuideline;

  getPayerPolicy(payerId: string, drugId: string): PayerPolicy[];
  getAllPayerPolicies(): PayerPolicy[];
  insertPayerPolicy(policy: InsertPayerPolicy): PayerPolicy;

  getCmsBehavior(payerId: string, drugId: string): CmsBehavior[];
  insertCmsBehavior(entry: InsertCmsBehavior): CmsBehavior;

  getGroundTruth(id: string): GroundTruth | undefined;
  getGroundTruthByPayerAndDrug(payerId: string, drugId: string): GroundTruth[];
  getGroundTruthByDrugAndCancer(drugId: string, cancerType: string): GroundTruth[];
  getAllGroundTruth(): GroundTruth[];
  upsertGroundTruth(row: InsertGroundTruth): GroundTruth;

  getPatient(patientId: string, orgId: string): PatientProfile | undefined;
  insertPatient(patient: InsertPatient): PatientProfile;
  getAllPatients(orgId: string): PatientProfile[];

  getDenial(denialRecordId: string, orgId: string): DenialRecord | undefined;
  getAllDenials(orgId: string): DenialRecord[];
  insertDenial(denial: InsertDenial): DenialRecord;
  updateDenialStatus(denialRecordId: string, status: string, groundTruthRowId?: string): DenialRecord;
  updateDenialOutcome(denialRecordId: string, outcome: string, outcomeNotes?: string, outcomeDate?: string): DenialRecord;

  getAppeal(appealId: string, orgId: string): AppealPacket | undefined;
  getAppealByDenial(denialRecordId: string, orgId: string): AppealPacket | undefined;
  getAllAppeals(orgId: string): AppealPacket[];
  insertAppeal(appeal: InsertAppeal): AppealPacket;
  updateAppeal(appealId: string, updates: Partial<AppealPacket>): AppealPacket;

  getFaxLog(appealId: string, orgId: string): FaxLog[];
  getAllFaxLogs(orgId: string): FaxLog[];
  insertFaxLog(log: InsertFaxLog): FaxLog;
  updateFaxLog(id: number, updates: Partial<FaxLog>): FaxLog;

  getOrganization(id: string): Organization | undefined;
  getOrganizationBySlug(slug: string): Organization | undefined;
  insertOrganization(org: InsertOrganization & { id: string }): Organization;
  updateOrganization(id: string, updates: Partial<Organization>): Organization;

  getUser(id: string): User | undefined;
  getUsersByOrg(orgId: string): User[];
  insertUser(user: InsertUser): User;

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

  getWinRateStats(orgId: string): WinRateStats;
  getPayerIntelligence(orgId: string): PayerIntelligenceRow[];
}

export class MemStorage implements IStorage {
  private drugsMap = new Map<string, Drug>();
  private nccnMap = new Map<number, NccnGuideline>();
  private payerPoliciesMap = new Map<number, PayerPolicy>();
  private cmsBehaviorMap = new Map<number, CmsBehavior>();
  private groundTruthMap = new Map<number, GroundTruth>();
  private patientsMap = new Map<string, PatientProfile>();
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

  getDrug(id: string) { return this.drugsMap.get(id); }
  getAllDrugs() { return Array.from(this.drugsMap.values()); }
  getDrugsByCancerType(cancerType: string) {
    return Array.from(this.drugsMap.values()).filter(d => d.cancerType === cancerType);
  }
  upsertDrug(drug: InsertDrug & { id: string }): Drug {
    const d: Drug = {
      ...drug,
      fdaLabelReference: drug.fdaLabelReference ?? null,
      createdAt: new Date().toISOString(),
    };
    this.drugsMap.set(drug.id, d);
    return d;
  }

  getNccnGuideline(nccnId: string) {
    return Array.from(this.nccnMap.values()).find(n => n.nccnId === nccnId);
  }
  getNccnByDrugAndCancer(drugId: string, cancerType: string) {
    return Array.from(this.nccnMap.values()).filter(n => n.drugId === drugId && n.cancerType === cancerType);
  }
  getAllNccn() { return Array.from(this.nccnMap.values()); }
  insertNccn(entry: InsertNccn): NccnGuideline {
    const id = this.nccnSeq++;
    const n: NccnGuideline = { ...entry, id, pageReference: entry.pageReference ?? null };
    this.nccnMap.set(id, n);
    return n;
  }

  getPayerPolicy(payerId: string, drugId: string) {
    return Array.from(this.payerPoliciesMap.values()).filter(p => p.payerId === payerId && p.drugId === drugId);
  }
  getAllPayerPolicies() { return Array.from(this.payerPoliciesMap.values()); }
  insertPayerPolicy(policy: InsertPayerPolicy): PayerPolicy {
    const id = this.policySeq++;
    const p: PayerPolicy = {
      ...policy,
      id,
      biomarkerConstraints: policy.biomarkerConstraints ?? null,
      stepTherapyRequirements: policy.stepTherapyRequirements ?? null,
      policySourceUrl: policy.policySourceUrl ?? null,
      experimentalInvestigationalFlag: policy.experimentalInvestigationalFlag ?? false,
      experimentalRationale: policy.experimentalRationale ?? null,
      notMedicallyNecessaryLanguage: policy.notMedicallyNecessaryLanguage ?? null,
      priorAuthRequired: policy.priorAuthRequired ?? true,
    };
    this.payerPoliciesMap.set(id, p);
    return p;
  }

  getCmsBehavior(payerId: string, drugId: string) {
    return Array.from(this.cmsBehaviorMap.values()).filter(c => c.payerId === payerId && c.drugId === drugId);
  }
  insertCmsBehavior(entry: InsertCmsBehavior): CmsBehavior {
    const id = this.cmsSeq++;
    const c: CmsBehavior = {
      ...entry,
      id,
      geography: entry.geography ?? null,
      allowedAmount: entry.allowedAmount ?? null,
      priorAuthFlag: entry.priorAuthFlag ?? null,
      fileReference: entry.fileReference ?? null,
      reportingPeriod: entry.reportingPeriod ?? null,
      notes: entry.notes ?? null,
    };
    this.cmsBehaviorMap.set(id, c);
    return c;
  }

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
    const normalized = {
      ...row,
      denialTextSnippet: row.denialTextSnippet ?? null,
      severity: row.severity ?? "moderate",
      cmsBehaviorFlags: row.cmsBehaviorFlags ?? null,
    };
    if (existing) {
      const updated = { ...existing, ...normalized };
      this.groundTruthMap.set(existing.id, updated);
      return updated;
    }
    const id = this.gtSeq++;
    const g: GroundTruth = { ...normalized, id };
    this.groundTruthMap.set(id, g);
    return g;
  }

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
    const p: PatientProfile = {
      ...patient,
      id,
      performanceStatus: patient.performanceStatus ?? null,
      clinicName: patient.clinicName ?? null,
      createdAt: new Date().toISOString(),
    };
    this.patientsMap.set(`${patient.organizationId}:${patient.patientId}`, p);
    return p;
  }

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
    const d: DenialRecord = {
      ...denial,
      id,
      drugId: denial.drugId ?? null,
      memberId: denial.memberId ?? null,
      payerFaxNumber: denial.payerFaxNumber ?? null,
      referenceNumber: denial.referenceNumber ?? null,
      rawDocumentText: denial.rawDocumentText ?? null,
      groundTruthRowId: null,
      status: "pending",
      outcome: null,
      outcomeNotes: null,
      outcomeDate: null,
      createdAt: new Date().toISOString(),
    };
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
  updateDenialOutcome(denialRecordId: string, outcome: string, outcomeNotes?: string, outcomeDate?: string): DenialRecord {
    const denial = this.denialsMap.get(denialRecordId);
    if (!denial) throw new Error(`Denial ${denialRecordId} not found`);
    const updated = {
      ...denial,
      outcome,
      outcomeNotes: outcomeNotes ?? denial.outcomeNotes,
      outcomeDate: outcomeDate ?? new Date().toISOString().split("T")[0],
      status: outcome === "approved" ? "resolved" : denial.status,
    };
    this.denialsMap.set(denialRecordId, updated);
    return updated;
  }

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
    const a: AppealPacket = {
      ...appeal,
      id,
      status: appeal.status ?? "generated",
      appealType: appeal.appealType ?? "first_level",
      payerFaxNumber: appeal.payerFaxNumber ?? null,
      pdfPath: appeal.pdfPath ?? null,
      faxJobId: appeal.faxJobId ?? null,
      faxStatus: appeal.faxStatus ?? null,
      faxSentAt: appeal.faxSentAt ?? null,
      faxDeliveredAt: appeal.faxDeliveredAt ?? null,
      generatedContent: appeal.generatedContent ?? null,
      createdAt: now,
      updatedAt: now,
    };
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
    const f: FaxLog = {
      ...log,
      id,
      status: log.status ?? "queued",
      metadata: log.metadata ?? null,
      errorMessage: log.errorMessage ?? null,
      jobId: log.jobId ?? null,
      costCents: log.costCents ?? null,
      pageCount: log.pageCount ?? null,
      attemptNumber: log.attemptNumber ?? 1,
      sentAt: log.sentAt ?? null,
      deliveredAt: log.deliveredAt ?? null,
    };
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

  getOrganization(id: string) { return this.orgsMap.get(id); }
  getOrganizationBySlug(slug: string) {
    return Array.from(this.orgsMap.values()).find(o => o.slug === slug);
  }
  insertOrganization(org: InsertOrganization & { id: string }): Organization {
    const o: Organization = {
      ...org,
      address: org.address ?? null,
      city: org.city ?? null,
      state: org.state ?? null,
      zip: org.zip ?? null,
      npi: org.npi ?? null,
      phone: org.phone ?? null,
      logoUrl: org.logoUrl ?? null,
      outboundFax: org.outboundFax ?? null,
      signingPhysician: org.signingPhysician ?? null,
      signingTitle: org.signingTitle ?? null,
      plan: org.plan ?? "starter",
      isDemo: org.isDemo ?? false,
      createdAt: new Date().toISOString(),
    };
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

  getUser(id: string) { return this.usersMap.get(id); }
  getUsersByOrg(orgId: string) {
    return Array.from(this.usersMap.values()).filter(u => u.organizationId === orgId);
  }
  insertUser(user: InsertUser): User {
    const u: User = {
      ...user,
      role: user.role ?? "provider",
      fullName: user.fullName ?? null,
      title: user.title ?? null,
      createdAt: new Date().toISOString(),
    };
    this.usersMap.set(user.id, u);
    return u;
  }

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

  getWinRateStats(orgId: string): WinRateStats {
    const denials = Array.from(this.denialsMap.values()).filter(
      d => d.organizationId === orgId && d.outcome !== null && d.outcome !== undefined
    );
    if (denials.length === 0) {
      return { overall: 0, byPayer: {}, byDrug: {}, byReason: {}, totalOutcomes: 0 };
    }
    const approved = denials.filter(d => d.outcome === "approved");
    const overall = Math.round((approved.length / denials.length) * 100);

    const byPayer: Record<string, number> = {};
    const byDrug: Record<string, number> = {};
    const byReason: Record<string, number> = {};

    const payerGroups = new Map<string, DenialRecord[]>();
    const drugGroups = new Map<string, DenialRecord[]>();
    const reasonGroups = new Map<string, DenialRecord[]>();

    for (const d of denials) {
      if (!payerGroups.has(d.payerId)) payerGroups.set(d.payerId, []);
      payerGroups.get(d.payerId)!.push(d);
      const drugKey = d.drugNameRaw || d.drugId || "unknown";
      if (!drugGroups.has(drugKey)) drugGroups.set(drugKey, []);
      drugGroups.get(drugKey)!.push(d);
      if (!reasonGroups.has(d.denialReasonCode)) reasonGroups.set(d.denialReasonCode, []);
      reasonGroups.get(d.denialReasonCode)!.push(d);
    }

    for (const [payer, rows] of payerGroups) {
      byPayer[payer] = Math.round((rows.filter(r => r.outcome === "approved").length / rows.length) * 100);
    }
    for (const [drug, rows] of drugGroups) {
      byDrug[drug] = Math.round((rows.filter(r => r.outcome === "approved").length / rows.length) * 100);
    }
    for (const [reason, rows] of reasonGroups) {
      byReason[reason] = Math.round((rows.filter(r => r.outcome === "approved").length / rows.length) * 100);
    }

    return { overall, byPayer, byDrug, byReason, totalOutcomes: denials.length };
  }

  getPayerIntelligence(orgId: string): PayerIntelligenceRow[] {
    const denials = Array.from(this.denialsMap.values()).filter(d => d.organizationId === orgId);
    const appeals = Array.from(this.appealsMap.values()).filter(a => a.organizationId === orgId);

    const groups = new Map<string, { denials: DenialRecord[]; appeals: AppealPacket[] }>();
    for (const d of denials) {
      const key = `${d.payerId}::${d.drugId || d.drugNameRaw}::${d.denialReasonCode}`;
      if (!groups.has(key)) groups.set(key, { denials: [], appeals: [] });
      groups.get(key)!.denials.push(d);
    }
    for (const a of appeals) {
      const denial = this.denialsMap.get(a.denialRecordId);
      if (!denial) continue;
      const key = `${denial.payerId}::${denial.drugId || denial.drugNameRaw}::${denial.denialReasonCode}`;
      if (groups.has(key)) groups.get(key)!.appeals.push(a);
    }

    const rows: PayerIntelligenceRow[] = [];
    for (const [key, { denials: ds, appeals: as }] of groups) {
      const [payerId, drugId, denialReasonCode] = key.split("::");
      const approvedOutcomes = ds.filter(d => d.outcome === "approved").length;
      const winRate = as.length > 0 ? Math.round((approvedOutcomes / as.length) * 100) : 0;

      // Find top winning argument from GT
      const gtRows = this.getGroundTruthByPayerAndDrug(payerId, drugId);
      let topWinningArgument = "NCCN Category 1 citation";
      if (gtRows.length > 0) {
        try {
          const tags = JSON.parse(gtRows[0].legalExposureTags || "[]");
          topWinningArgument = tags[0] || topWinningArgument;
        } catch { /* keep default */ }
      }

      rows.push({ payerId, drugId, denialReasonCode, totalDenials: ds.length, totalAppeals: as.length, approvedOutcomes, winRate, topWinningArgument });
    }

    return rows.sort((a, b) => b.winRate - a.winRate);
  }
}

export const storage = new MemStorage();
