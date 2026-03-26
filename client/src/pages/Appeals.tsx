import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Download, Send, FileText, Zap } from "lucide-react";

export default function AppealsPage() {
  const { toast } = useToast();
  const { data: appeals = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/appeals"] });

  const faxAppeal = useMutation({
    mutationFn: (appealId: string) => apiRequest("POST", `/api/appeals/${appealId}/fax`, {}),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/appeals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fax-log"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Fax Queued", description: "Appeal packet is being delivered to payer Medical Director." });
    },
    onError: (e: any) => toast({ title: "Fax Error", description: e.message, variant: "destructive" }),
  });

  const batchFax = useMutation({
    mutationFn: () => apiRequest("POST", "/api/appeals/batch-fax", {}),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/appeals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fax-log"] });
      toast({ title: "Batch Fax Complete", description: `${data.queued} appeals queued for delivery.` });
    },
  });

  const downloadPdf = (appealId: string) => {
    window.open(`/api/appeals/${appealId}/pdf`, "_blank");
  };

  const generatedCount = appeals.filter((a: any) => a.status === "generated").length;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Appeal Packets</h1>
          <p className="text-sm text-muted-foreground mt-1">Generated appeal packets ready for delivery</p>
        </div>
        {generatedCount > 0 && (
          <button
            data-testid="button-batch-fax"
            onClick={() => batchFax.mutate()}
            disabled={batchFax.isPending}
            className="flex items-center gap-2 bg-accent text-white text-sm font-medium py-2 px-4 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-60"
          >
            <Zap className="w-4 h-4" />
            Batch Fax All ({generatedCount})
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-40 bg-muted/60 animate-pulse rounded-xl" />)}
        </div>
      ) : appeals.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="text-sm">No appeals yet. Run the pipeline on a denial to generate one.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {appeals.map((a: any) => (
            <div key={a.appealId} className="bg-card border border-border rounded-xl p-6" data-testid={`card-appeal-${a.appealId}`}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-foreground">{a.appealId}</span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium status-${a.status}`}>
                      {a.status}
                    </span>
                    <span className="text-xs text-muted-foreground">{a.appealType.replace(/_/g, " ")}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Denial: {a.denialRecordId} · Payer: {a.payerId} · Patient: {a.patientId}
                  </div>
                </div>
                <div className="flex gap-2">
                  {a.pdfPath && (
                    <button
                      data-testid={`button-download-${a.appealId}`}
                      onClick={() => downloadPdf(a.appealId)}
                      className="flex items-center gap-1.5 text-xs bg-muted hover:bg-muted/70 text-foreground px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      Download PDF
                    </button>
                  )}
                  {a.status === "generated" && (
                    <button
                      data-testid={`button-fax-${a.appealId}`}
                      onClick={() => faxAppeal.mutate(a.appealId)}
                      disabled={faxAppeal.isPending}
                      className="flex items-center gap-1.5 text-xs bg-primary text-white hover:bg-primary/90 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                    >
                      <Send className="w-3 h-3" />
                      Fax to {a.payerId}
                    </button>
                  )}
                </div>
              </div>

              {/* NCCN + FDA Citations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <div className="text-xs font-semibold text-green-800 dark:text-green-400 mb-1">NCCN Citation</div>
                  <p className="text-xs text-green-700 dark:text-green-300">{a.nccnCitation}</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <div className="text-xs font-semibold text-blue-800 dark:text-blue-400 mb-1">FDA Citation</div>
                  <p className="text-xs text-blue-700 dark:text-blue-300 line-clamp-2">{a.fdaCitation}</p>
                </div>
              </div>

              {/* Conflict Summary */}
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                <div className="text-xs font-semibold text-red-800 dark:text-red-400 mb-1">Conflict Summary</div>
                <p className="text-xs text-red-700 dark:text-red-300">{a.conflictSummary}</p>
              </div>

              {/* Fax status */}
              {a.faxJobId && (
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-3 border-t border-border">
                  <span><span className="font-medium">Fax Job:</span> {a.faxJobId}</span>
                  <span><span className="font-medium">Status:</span> {a.faxStatus}</span>
                  {a.payerFaxNumber && <span><span className="font-medium">To:</span> {a.payerFaxNumber}</span>}
                  {a.faxSentAt && <span><span className="font-medium">Sent:</span> {new Date(a.faxSentAt).toLocaleString()}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
