import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Zap, Target, ChevronRight } from "lucide-react";
import { useState } from "react";

export default function DenialsPage() {
  const { toast } = useToast();
  const [runningId, setRunningId] = useState<string | null>(null);

  const { data: denials = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/denials"] });

  const runPipeline = useMutation({
    mutationFn: (denialRecordId: string) =>
      apiRequest("POST", "/api/pipeline/run", { denialRecordId }),
    onSuccess: (_, id) => {
      setRunningId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/denials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appeals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Appeal Generated", description: "Appeal packet created and ready for fax delivery." });
    },
    onError: (e: any) => {
      setRunningId(null);
      toast({ title: "Pipeline Error", description: e.message, variant: "destructive" });
    },
  });

  const matchDenial = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/denials/${id}/match`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/denials"] });
      toast({ title: "Matched", description: "Denial matched to ground truth dataset." });
    },
  });

  const statusOrder = ["pending", "matched", "appeal_generated", "faxed", "delivered"];
  const sorted = [...denials].sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status));

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Denial Records</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage and process denial notices</p>
        </div>
        <Link href="/denials/new">
          <button
            data-testid="button-add-denial"
            className="flex items-center gap-2 bg-primary text-white text-sm font-medium py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Denial
          </button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted/60 animate-pulse rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((d: any) => (
            <div key={d.denialRecordId} className="bg-card border border-border rounded-xl p-5" data-testid={`card-denial-${d.denialRecordId}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-sm font-semibold text-foreground">{d.drugNameRaw}</span>
                    <span className="text-xs text-muted-foreground">— {d.payerName}</span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium status-${d.status}`}>
                      {d.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">
                    <span className="font-medium">ID:</span> {d.denialRecordId} ·
                    <span className="font-medium ml-1">Ref:</span> {d.referenceNumber} ·
                    <span className="font-medium ml-1">Date:</span> {d.denialDate}
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    <span className="font-medium">Reason:</span> {d.denialReasonCode.replace(/_/g, " ")}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 italic">"{d.denialReasonText.slice(0, 200)}..."</p>
                  {d.groundTruthRowId && (
                    <div className="mt-2 text-xs text-primary font-medium flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      Matched: {d.groundTruthRowId}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {d.status === "pending" && (
                    <button
                      data-testid={`button-match-${d.denialRecordId}`}
                      onClick={() => matchDenial.mutate(d.denialRecordId)}
                      className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-200 px-3 py-1.5 rounded-lg font-medium transition-colors"
                    >
                      Match GT
                    </button>
                  )}
                  {(d.status === "pending" || d.status === "matched") && (
                    <button
                      data-testid={`button-pipeline-${d.denialRecordId}`}
                      onClick={() => { setRunningId(d.denialRecordId); runPipeline.mutate(d.denialRecordId); }}
                      disabled={runningId === d.denialRecordId}
                      className="text-xs bg-primary text-white hover:bg-primary/90 px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1 disabled:opacity-60"
                    >
                      {runningId === d.denialRecordId ? (
                        <><span className="animate-spin">⏳</span> Generating...</>
                      ) : (
                        <><Zap className="w-3 h-3" /> Run Pipeline</>
                      )}
                    </button>
                  )}
                  {d.status === "appeal_generated" && (
                    <Link href="/appeals">
                      <button className="text-xs bg-indigo-100 text-indigo-800 hover:bg-indigo-200 px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1">
                        View Appeal <ChevronRight className="w-3 h-3" />
                      </button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
          {denials.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <FileX className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-sm">No denial records yet.</p>
              <Link href="/denials/new">
                <button className="mt-3 text-sm text-primary hover:underline">Add your first denial →</button>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FileX({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
  );
}
