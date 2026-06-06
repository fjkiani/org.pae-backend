import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, Play, CheckCircle, XCircle, Phone, Minus, TrendingUp, AlertTriangle, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? "text-green-600 bg-green-50 border-green-200 dark:bg-green-950/30"
    : score >= 55 ? "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/30"
    : score >= 35 ? "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30"
    : "text-red-600 bg-red-50 border-red-200 dark:bg-red-950/30";
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border font-medium ${color}`}>
      <TrendingUp className="w-4 h-4" />
      <span className="text-lg font-bold">{score}</span>
      <span className="text-sm">/100 Appeal Strength</span>
    </div>
  );
}

const OUTCOME_BUTTONS = [
  { value: "approved", label: "Approved", icon: CheckCircle, color: "bg-green-600 hover:bg-green-700 text-white" },
  { value: "denied", label: "Denied", icon: XCircle, color: "bg-red-600 hover:bg-red-700 text-white" },
  { value: "p2p", label: "P2P Requested", icon: Phone, color: "bg-blue-600 hover:bg-blue-700 text-white" },
  { value: "withdrawn", label: "Withdrawn", icon: Minus, color: "bg-gray-500 hover:bg-gray-600 text-white" },
];

export default function DenialDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [showOutcomeForm, setShowOutcomeForm] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState("");

  const { data: denial, isLoading } = useQuery<any>({
    queryKey: [`/api/denials/${id}`],
  });

  const { data: scoreData } = useQuery<any>({
    queryKey: [`/api/analytics/denial-score/${id}`],
    enabled: !!id,
  });

  const { data: allAppeals = [] } = useQuery<any[]>({
    queryKey: ["/api/appeals"],
  });

  const runPipeline = useMutation({
    mutationFn: () => apiRequest("POST", "/api/agents/run", { denialId: id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/denials/${id}`] }),
  });

  const setOutcome = useMutation({
    mutationFn: (outcome: string) => apiRequest("PATCH", `/api/denials/${id}/outcome`, {
      outcome, outcomeNotes, outcomeDate: new Date().toISOString().split("T")[0],
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/denials/${id}`] });
      setShowOutcomeForm(false);
      setOutcomeNotes("");
    },
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading denial...</div>;
  if (!denial) return <div className="p-6 text-muted-foreground">Denial not found.</div>;

  const linkedAppeal = (allAppeals as any[]).find((a: any) => a.denialRecordId === id);

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    matched: "bg-blue-50 text-blue-700 border-blue-200",
    appeal_generated: "bg-purple-50 text-purple-700 border-purple-200",
    faxed: "bg-green-50 text-green-700 border-green-200",
    delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/denials">
        <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Denials
        </button>
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{denial.denialRecordId}</h1>
          <p className="text-muted-foreground">{denial.drugNameRaw} · {denial.payerName}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[denial.status] || "bg-muted text-muted-foreground border-border"}`}>
            {denial.status?.replace("_", " ")}
          </span>
          {!linkedAppeal && (
            <button onClick={() => runPipeline.mutate()} disabled={runPipeline.isPending}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              <Play className="w-4 h-4" />
              {runPipeline.isPending ? "Running..." : "Run Pipeline"}
            </button>
          )}
          {linkedAppeal && (
            <Link href={`/appeals/${linkedAppeal.appealId}`}>
              <button className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                View Appeal
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* Predictive Score */}
      {scoreData && (
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Appeal Strength Score</h2>
            <ScoreBadge score={scoreData.score} />
          </div>
          <p className="text-sm text-muted-foreground mb-4">{scoreData.recommendation}</p>
          <div className="grid grid-cols-5 gap-3">
            {Object.entries(scoreData.breakdown || {}).map(([key, val]: any) => (
              <div key={key} className="text-center">
                <div className="text-lg font-bold text-foreground">{val}</div>
                <div className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Estimated win rate: <span className="font-semibold text-foreground">{scoreData.estimatedWinRate}%</span>
              {" · "}<span className="text-primary font-medium">{scoreData.appealStrengthLabel}</span>
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Denial Details */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-4">Denial Details</h2>
          <div className="space-y-3">
            {[
              { label: "Patient ID", value: denial.patientId },
              { label: "Payer", value: denial.payerName },
              { label: "Drug", value: denial.drugNameRaw },
              { label: "Denial Date", value: denial.denialDate },
              { label: "Reference #", value: denial.referenceNumber || "N/A" },
              { label: "Member ID", value: denial.memberId || "N/A" },
              { label: "ICD-10 Codes", value: denial.icd10Codes || "N/A" },
              { label: "Denial Reason", value: denial.denialReasonCode?.replace(/_/g, " ") },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between py-1.5 border-b border-border last:border-0">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-sm font-medium text-foreground text-right max-w-[60%]">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Denial Text + Outcome */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground mb-3">Denial Reason Text</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{denial.denialReasonText || "No denial text recorded."}</p>
          </div>

          {/* Outcome capture */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground">Outcome Tracking</h2>
            </div>
            {denial.outcome ? (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="font-medium text-foreground capitalize">{denial.outcome}</span>
                {denial.outcomeDate && <span className="text-sm text-muted-foreground">· {denial.outcomeDate}</span>}
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-3">Record the outcome of this appeal.</p>
                <div className="grid grid-cols-2 gap-2">
                  {OUTCOME_BUTTONS.map(({ value, label, icon: Icon, color }) => (
                    <button key={value}
                      onClick={() => { setSelectedOutcome(value); setShowOutcomeForm(true); }}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${color}`}>
                      <Icon className="w-4 h-4" /> {label}
                    </button>
                  ))}
                </div>
                {showOutcomeForm && (
                  <div className="mt-3 space-y-2">
                    <textarea value={outcomeNotes} onChange={e => setOutcomeNotes(e.target.value)}
                      placeholder="Optional notes about the outcome..."
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                    <div className="flex gap-2">
                      <button onClick={() => setOutcome.mutate(selectedOutcome)} disabled={setOutcome.isPending}
                        className="flex-1 bg-primary text-white py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                        {setOutcome.isPending ? "Saving..." : `Save: ${selectedOutcome}`}
                      </button>
                      <button onClick={() => setShowOutcomeForm(false)}
                        className="px-4 py-2 rounded-lg border border-border text-foreground text-sm hover:bg-muted transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {denial.groundTruthRowId && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">Ground Truth Match Found</span>
              </div>
              <p className="text-xs text-muted-foreground">{denial.groundTruthRowId}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
