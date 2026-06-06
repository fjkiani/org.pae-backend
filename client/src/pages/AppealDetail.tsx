import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, Download, Send, Phone, CheckCircle, XCircle, Minus, FileText, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";

export default function AppealDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [showP2P, setShowP2P] = useState(false);
  const [p2pData, setP2pData] = useState<any>(null);

  const { data: appeal, isLoading } = useQuery<any>({
    queryKey: [`/api/appeals/${id}`],
  });

  const faxMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/appeals/${id}/fax`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/appeals/${id}`] }),
  });

  const p2pMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/appeals/${id}/p2p-brief`, {}),
    onSuccess: (data: any) => { setP2pData(data.brief); setShowP2P(true); },
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading appeal...</div>;
  if (!appeal) return <div className="p-6 text-muted-foreground">Appeal not found.</div>;

  const sections = (() => {
    try { return JSON.parse(appeal.generatedContent || "{}"); } catch { return {}; }
  })();

  const statusColors: Record<string, string> = {
    generated: "bg-blue-50 text-blue-700 border-blue-200",
    faxed: "bg-amber-50 text-amber-700 border-amber-200",
    delivered: "bg-green-50 text-green-700 border-green-200",
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/appeals">
        <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Appeals
        </button>
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{appeal.appealId}</h1>
          <p className="text-muted-foreground">{appeal.payerId} · {appeal.appealType?.replace("_", " ")}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[appeal.status] || "bg-muted text-muted-foreground border-border"}`}>
            {appeal.status}
          </span>
          <button onClick={() => p2pMutation.mutate()} disabled={p2pMutation.isPending}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-foreground text-sm hover:bg-muted transition-colors disabled:opacity-50">
            <Phone className="w-4 h-4" />
            {p2pMutation.isPending ? "Generating..." : "P2P Brief"}
          </button>
          {appeal.pdfPath && (
            <a href={`/api/appeals/${id}/pdf`} target="_blank" rel="noopener noreferrer">
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-foreground text-sm hover:bg-muted transition-colors">
                <Download className="w-4 h-4" /> PDF
              </button>
            </a>
          )}
          {appeal.status === "generated" && (
            <button onClick={() => faxMutation.mutate()} disabled={faxMutation.isPending}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              <Send className="w-4 h-4" />
              {faxMutation.isPending ? "Sending..." : "Send Fax"}
            </button>
          )}
        </div>
      </div>

      {/* Fax status */}
      {appeal.faxStatus && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border mb-6 ${
          appeal.faxStatus === "delivered" ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30" : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30"
        }`}>
          {appeal.faxStatus === "delivered" ? <CheckCircle className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          <span className="text-sm font-medium">Fax {appeal.faxStatus} to {appeal.payerFaxNumber}</span>
          {appeal.faxDeliveredAt && <span className="text-sm ml-auto">{new Date(appeal.faxDeliveredAt).toLocaleString()}</span>}
        </div>
      )}

      {/* Citations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { label: "NCCN Citation", value: appeal.nccnCitation },
          { label: "FDA Citation", value: appeal.fdaCitation },
          { label: "Conflict", value: appeal.conflictSummary },
        ].map(({ label, value }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
            <p className="text-sm text-foreground leading-relaxed">{value?.slice(0, 200) || "N/A"}</p>
          </div>
        ))}
      </div>

      {/* Appeal Letter */}
      {sections.executiveSummary && (
        <div className="bg-card border border-border rounded-xl">
          <div className="flex items-center gap-2 p-5 border-b border-border">
            <FileText className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground">Appeal Letter</h2>
          </div>
          <div className="p-6 space-y-6 max-h-[600px] overflow-y-auto">
            {[
              { title: "Executive Summary", content: sections.executiveSummary },
              { title: "Clinical Background", content: sections.clinicalBackground },
              { title: "NCCN & FDA Evidence", content: sections.nccnFdaSection },
              { title: "Payer Policy Contradiction", content: sections.payerContradictionSection },
              { title: "Legal Framework", content: sections.legalFrameworkSection },
              { title: "Requested Resolution", content: sections.requestedResolution },
            ].filter(s => s.content).map(({ title, content }) => (
              <div key={title}>
                <h3 className="text-sm font-semibold text-foreground mb-2 uppercase tracking-wide text-primary">{title}</h3>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* P2P Brief Modal */}
      {showP2P && p2pData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card">
              <div className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-foreground">Peer-to-Peer Brief</h2>
              </div>
              <button onClick={() => setShowP2P(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Opening Statement</h3>
                <p className="text-sm text-muted-foreground leading-relaxed italic">"{p2pData.openingStatement}"</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Key Talking Points</h3>
                <ul className="space-y-2">
                  {(p2pData.talkingPoints || []).map((pt: string, i: number) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Anticipated Objections</h3>
                <div className="space-y-3">
                  {(p2pData.anticipatedObjections || []).map((obj: any, i: number) => (
                    <div key={i} className="border border-border rounded-xl p-3">
                      <p className="text-sm font-medium text-red-600 mb-1">Objection: {obj.objection}</p>
                      <p className="text-sm text-foreground">Response: {obj.rebuttal}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Key Citations</h3>
                <ul className="space-y-1">
                  {(p2pData.keyCitations || []).map((c: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <span className="text-primary">·</span> {c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
