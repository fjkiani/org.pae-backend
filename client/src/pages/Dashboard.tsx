import { useQuery } from "@tanstack/react-query";
import { FileX, FileText, Database, Send, CheckCircle, AlertTriangle, Pill, Users } from "lucide-react";

export default function Dashboard() {
  const { data: stats } = useQuery<any>({ queryKey: ["/api/stats"] });
  const { data: gt } = useQuery<any[]>({ queryKey: ["/api/ground-truth"] });
  const { data: denials } = useQuery<any[]>({ queryKey: ["/api/denials"] });
  const { data: appeals } = useQuery<any[]>({ queryKey: ["/api/appeals"] });

  const kpis = [
    { label: "Total Denials", value: stats?.totalDenials ?? 0, icon: FileX, color: "text-red-500", bg: "bg-red-50 dark:bg-red-900/20" },
    { label: "Pending", value: stats?.pendingDenials ?? 0, icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20" },
    { label: "Appeals Generated", value: stats?.totalAppeals ?? 0, icon: FileText, color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
    { label: "Faxed & Delivered", value: stats?.deliveredAppeals ?? 0, icon: Send, color: "text-green-500", bg: "bg-green-50 dark:bg-green-900/20" },
    { label: "Ground Truth Rows", value: stats?.groundTruthRows ?? 0, icon: Database, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" },
    { label: "Drugs Covered", value: stats?.drugsCovered ?? 0, icon: Pill, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/20" },
    { label: "Payers Monitored", value: stats?.payersCovered ?? 4, icon: Users, color: "text-teal-500", bg: "bg-teal-50 dark:bg-teal-900/20" },
  ];

  const conflictCounts = gt?.reduce((acc: any, row: any) => {
    acc[row.conflictType] = (acc[row.conflictType] || 0) + 1;
    return acc;
  }, {}) ?? {};

  const cancerCounts = gt?.reduce((acc: any, row: any) => {
    acc[row.cancerType] = (acc[row.cancerType] || 0) + 1;
    return acc;
  }, {}) ?? {};

  const payerCounts = gt?.reduce((acc: any, row: any) => {
    acc[row.payerId] = (acc[row.payerId] || 0) + 1;
    return acc;
  }, {}) ?? {};

  const conflictLabels: Record<string, string> = {
    A: "NCCN Cat 1 labeled Experimental",
    B: "FDA-approved labeled NMN",
    C: "Step Therapy Contradicts NCCN",
    D: "CMS Shadow Policy",
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground" data-testid="text-page-title">PAE-Onc Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Prior Authorization Appeal Engine — 25 cancer types · 4 payers · Agentic A→B→C pipeline · Real-time ground truth
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
            <div className={`w-11 h-11 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <div className="text-xl font-bold text-foreground" data-testid={`stat-${label.toLowerCase().replace(/ /g, "-")}`}>{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conflict Type Breakdown */}
        <div className="bg-card border border-border rounded-xl p-6 col-span-1">
          <h2 className="text-sm font-semibold text-foreground mb-4">Conflict Type Breakdown</h2>
          <div className="space-y-3">
            {Object.entries(conflictCounts).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded conflict-${type}`}>Type {type}</span>
                  <span className="text-xs text-muted-foreground">{conflictLabels[type]}</span>
                </div>
                <span className="text-sm font-semibold text-foreground">{count as number}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-accent">Type A+B</span> = highest legal exposure (experimental/NMN vs FDA/NCCN)
            </p>
          </div>
        </div>

        {/* Cancer Types */}
        <div className="bg-card border border-border rounded-xl p-6 col-span-1">
          <h2 className="text-sm font-semibold text-foreground mb-4">Coverage by Cancer Type</h2>
          <div className="space-y-2.5">
            {Object.entries(cancerCounts).map(([cancer, count]) => (
              <div key={cancer} className="flex items-center justify-between">
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium cancer-${cancer}`}>{cancer}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.min(100, (count as number / (gt?.length || 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-foreground w-4 text-right">{count as number}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payer Coverage */}
        <div className="bg-card border border-border rounded-xl p-6 col-span-1">
          <h2 className="text-sm font-semibold text-foreground mb-4">Ground Truth by Payer</h2>
          <div className="space-y-3">
            {Object.entries(payerCounts).map(([payer, count]) => (
              <div key={payer} className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{payer}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full"
                      style={{ width: `${Math.min(100, (count as number / (gt?.length || 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{count as number} rows</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Denials */}
      <div className="bg-card border border-border rounded-xl">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Recent Denials</h2>
          <span className="text-xs text-muted-foreground">{denials?.length ?? 0} total</span>
        </div>
        <div className="divide-y divide-border">
          {(denials ?? []).slice(0, 5).map((d: any) => (
            <div key={d.denialRecordId} className="px-6 py-4 flex items-center gap-4" data-testid={`row-denial-${d.denialRecordId}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-foreground truncate">{d.drugNameRaw}</span>
                  <span className="text-xs text-muted-foreground">— {d.payerName}</span>
                </div>
                <div className="text-xs text-muted-foreground">{d.denialDate} · Ref: {d.referenceNumber}</div>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full status-${d.status}`}>
                {d.status.replace(/_/g, " ")}
              </span>
              <span className="text-xs text-muted-foreground truncate max-w-40 hidden lg:block">
                {d.denialReasonCode.replace(/_/g, " ")}
              </span>
            </div>
          ))}
          {(!denials || denials.length === 0) && (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">No denials yet. Add one to get started.</div>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">How PAE-Onc Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[
            { step: "1", label: "Ingest Denial", desc: "Upload denial notice PDF or enter manually. AI extracts payer, drug, and denial reason." },
            { step: "2", label: "Ground Truth Match", desc: "System matches denial against NCCN/FDA standards vs payer policy. Identifies conflict type (A–D)." },
            { step: "3", label: "Generate Appeal", desc: "Cohere AI generates a 7-page legally robust appeal packet with citations and bad-faith language." },
            { step: "4", label: "Fax to Medical Director", desc: "Appeal is delivered directly to payer Medical Director queue with tracking and cost accounting." },
          ].map(({ step, label, desc }) => (
            <div key={step} className="relative">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{step}</div>
                <div>
                  <div className="text-sm font-semibold text-foreground mb-1">{label}</div>
                  <div className="text-xs text-muted-foreground leading-relaxed">{desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
