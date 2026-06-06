import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, CheckCircle, Clock, AlertCircle } from "lucide-react";

function StatusIcon({ status }: { status: string }) {
  if (status === "implemented") return <CheckCircle className="w-4 h-4 text-green-500" />;
  if (status === "in_progress") return <Clock className="w-4 h-4 text-amber-500" />;
  return <AlertCircle className="w-4 h-4 text-red-400" />;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    implemented: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30",
    in_progress: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30",
    not_started: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status] || "bg-muted text-muted-foreground border-border"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  CC1: "Control Environment", CC2: "Communication", CC3: "Risk Assessment",
  CC4: "Monitoring", CC5: "Control Activities", CC6: "Logical Access",
  CC7: "System Operations", CC8: "Change Management", CC9: "Risk Mitigation",
  A1: "Availability", C1: "Confidentiality", PI1: "Processing Integrity",
  P1: "Privacy Notice", P2: "Choice & Consent", P3: "Collection",
  P4: "Use & Retention", P5: "Access", P6: "Third Party Disclosure",
  P7: "Quality", P8: "Monitoring",
};

export default function Compliance() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/compliance/soc2-checklist"] });

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading compliance data...</div>;

  const { controls = [], summary = {} } = data || {};
  const pct = summary.completionPct || 0;

  // Group by category
  const grouped: Record<string, any[]> = {};
  controls.forEach((c: any) => {
    if (!grouped[c.category]) grouped[c.category] = [];
    grouped[c.category].push(c);
  });

  // SVG ring
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">SOC 2 Compliance</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Security and availability controls progress</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="md:col-span-1 bg-card border border-border rounded-xl p-6 flex flex-col items-center justify-center">
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle cx="70" cy="70" r={r} fill="none" stroke="currentColor" strokeWidth="12" className="text-muted/30" />
            <circle cx="70" cy="70" r={r} fill="none" stroke="currentColor" strokeWidth="12"
              strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
              transform="rotate(-90 70 70)" className="text-primary transition-all duration-700" />
            <text x="70" y="70" textAnchor="middle" dominantBaseline="middle" className="fill-foreground" fontSize="22" fontWeight="bold">{pct}%</text>
            <text x="70" y="88" textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground" fontSize="10">Complete</text>
          </svg>
        </div>
        {[
          { label: "Implemented", value: summary.implemented, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30" },
          { label: "In Progress", value: summary.inProgress, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30" },
          { label: "Not Started", value: summary.notStarted, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/30" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} border border-border rounded-xl p-6 flex flex-col justify-center`}>
            <div className={`text-4xl font-bold ${color}`}>{value}</div>
            <div className="text-sm text-muted-foreground mt-1">{label}</div>
            <div className="text-xs text-muted-foreground">of {summary.total} controls</div>
          </div>
        ))}
      </div>

      {/* Controls by category */}
      <div className="space-y-4">
        {Object.entries(grouped).map(([cat, catControls]) => {
          const catPct = Math.round((catControls.filter(c => c.status === "implemented").length / catControls.length) * 100);
          return (
            <div key={cat} className="bg-card border border-border rounded-xl">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <div>
                    <span className="font-semibold text-foreground text-sm">{cat}</span>
                    <span className="text-muted-foreground text-sm ml-2">— {CATEGORY_LABELS[cat] || cat}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${catPct}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">{catPct}%</span>
                </div>
              </div>
              <div className="divide-y divide-border">
                {catControls.map((ctrl: any) => (
                  <div key={ctrl.id} className="flex items-start gap-3 p-4">
                    <StatusIcon status={ctrl.status} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono text-muted-foreground">{ctrl.id}</span>
                        <span className="text-sm font-medium text-foreground">{ctrl.name}</span>
                        <StatusBadge status={ctrl.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">{ctrl.description}</p>
                      {ctrl.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{ctrl.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
