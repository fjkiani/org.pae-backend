import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, Activity, Dna, FileX, FileText, Plus, ChevronRight } from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30",
    matched: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30",
    appeal_generated: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30",
    faxed: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30",
    delivered: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colors[status] || "bg-muted text-muted-foreground border-border"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: patient, isLoading } = useQuery<any>({
    queryKey: [`/api/patients/${id}`],
  });

  const { data: allDenials = [] } = useQuery<any[]>({
    queryKey: ["/api/denials"],
  });

  const { data: allAppeals = [] } = useQuery<any[]>({
    queryKey: ["/api/appeals"],
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading patient...</div>;
  if (!patient) return <div className="p-6 text-muted-foreground">Patient not found.</div>;

  const biomarkers = (() => { try { return Object.entries(JSON.parse(patient.biomarkers || "{}")); } catch { return []; } })();
  const priorTherapies = (() => { try { return JSON.parse(patient.priorTherapies || "[]"); } catch { return []; } })();
  const patientDenials = (allDenials as any[]).filter((d: any) => d.patientId === id);
  const patientAppeals = (allAppeals as any[]).filter((a: any) => a.patientId === id);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/patients">
        <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Patients
        </button>
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Activity className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{patient.patientId}</h1>
            <p className="text-muted-foreground capitalize">{patient.cancerType?.replace("_", " ")} Cancer · {patient.stage}</p>
            <p className="text-sm text-muted-foreground">{patient.clinicName} · {patient.state}</p>
          </div>
        </div>
        <Link href={`/denials/new?patientId=${id}`}>
          <button className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> New Denial
          </button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Molecular Profile */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Dna className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground text-sm">Molecular Profile</h2>
            </div>
            <div className="space-y-2">
              {biomarkers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No biomarkers recorded.</p>
              ) : biomarkers.map(([k, v]: any) => (
                <div key={k} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <span className="text-sm font-medium text-foreground">{k}</span>
                  <span className="text-sm text-muted-foreground">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground text-sm mb-4">Performance Status</h2>
            <div className="text-2xl font-bold text-primary">{patient.performanceStatus || "Not recorded"}</div>
          </div>

          {priorTherapies.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-semibold text-foreground text-sm mb-4">Prior Therapies</h2>
              <div className="space-y-3">
                {priorTherapies.map((t: any, i: number) => (
                  <div key={i} className="border-l-2 border-primary/30 pl-3">
                    <p className="text-sm font-medium text-foreground">{t.drug}</p>
                    <p className="text-xs text-muted-foreground">{t.start} – {t.end}</p>
                    <span className={`text-xs font-medium ${t.response === "progression" ? "text-red-600" : t.response === "complete response" ? "text-green-600" : "text-amber-600"}`}>
                      {t.response}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Denials & Appeals */}
        <div className="lg:col-span-2 space-y-6">
          {/* Denials */}
          <div className="bg-card border border-border rounded-xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <FileX className="w-4 h-4 text-red-500" />
                <h2 className="font-semibold text-foreground text-sm">Denials ({patientDenials.length})</h2>
              </div>
            </div>
            {patientDenials.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No denials for this patient.</div>
            ) : (
              <div className="divide-y divide-border">
                {patientDenials.map((d: any) => (
                  <Link key={d.denialRecordId} href={`/denials/${d.denialRecordId}`}>
                    <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                      <div>
                        <p className="text-sm font-medium text-foreground">{d.drugNameRaw}</p>
                        <p className="text-xs text-muted-foreground">{d.payerName} · {d.denialDate}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{d.denialReasonCode?.replace("_", " ")}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={d.status} />
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Appeals */}
          <div className="bg-card border border-border rounded-xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-foreground text-sm">Appeals ({patientAppeals.length})</h2>
              </div>
            </div>
            {patientAppeals.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No appeals generated yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {patientAppeals.map((a: any) => (
                  <Link key={a.appealId} href={`/appeals/${a.appealId}`}>
                    <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                      <div>
                        <p className="text-sm font-medium text-foreground">{a.appealId}</p>
                        <p className="text-xs text-muted-foreground">{a.payerId} · {a.appealType?.replace("_", " ")}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={a.status} />
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
