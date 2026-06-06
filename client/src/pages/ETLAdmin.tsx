import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Database, Play, RefreshCw, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const ALL_CANCER_TYPES = [
  "breast","lung","colon","ovarian","brain","prostate","bladder","pancreatic",
  "liver","gastric","esophageal","cervical","endometrial","thyroid","melanoma",
  "renal","head_neck","leukemia","lymphoma","myeloma","sarcoma","mesothelioma",
  "bile_duct","neuroendocrine","myelodysplastic"
];

const AGENTS = [
  { id: "fda", label: "FDA Drug Ingest", desc: "Pull oncology drugs from openFDA label API across all 25 cancer types" },
  { id: "nccn", label: "NCCN Extraction", desc: "Extract NCCN guideline categories via Cohere for all drugs" },
  { id: "payer", label: "Payer Policy Generation", desc: "Generate realistic payer policies for UHC, Cigna, Aetna, Humana" },
  { id: "gt", label: "Ground Truth Builder", desc: "Cross-join NCCN × payer policies to classify conflict types A/B/C/D" },
];

export default function ETLAdmin() {
  const [selectedAgents, setSelectedAgents] = useState<string[]>(["fda", "nccn", "payer", "gt"]);
  const [selectedCancerTypes, setSelectedCancerTypes] = useState<string[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [runStatus, setRunStatus] = useState<string>("");
  const logRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: status, refetch: refetchStatus } = useQuery<any>({
    queryKey: ["/api/etl/status"],
    refetchInterval: runId ? 5000 : false,
  });

  const { data: cancerTypes = [] } = useQuery<any[]>({
    queryKey: ["/api/etl/cancer-types"],
  });

  const runMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/etl/run", {
      agents: selectedAgents,
      cancerTypes: selectedCancerTypes.length > 0 ? selectedCancerTypes : undefined,
    }),
    onSuccess: (data: any) => {
      setRunId(data.runId);
      setLogs([`[${new Date().toLocaleTimeString()}] ETL pipeline started: ${data.runId}`]);
      setRunStatus("running");
    },
  });

  // Poll for logs when running
  useEffect(() => {
    if (!runId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/etl/run/${runId}`);
        const data = await res.json();
        if (data.logs) {
          setLogs(data.logs.map((l: any) => `[${new Date(l.timestamp || Date.now()).toLocaleTimeString()}] ${l.agent || "etl"}: ${l.message}`));
        }
        if (data.status === "completed" || data.status === "failed") {
          setRunStatus(data.status);
          if (pollRef.current) clearInterval(pollRef.current);
          refetchStatus();
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [runId]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const toggleAgent = (id: string) => {
    setSelectedAgents(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  };

  const toggleCancerType = (ct: string) => {
    setSelectedCancerTypes(prev => prev.includes(ct) ? prev.filter(c => c !== ct) : [...prev, ct]);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">ETL Admin</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Expand the oncology knowledge base across all 25 cancer types</p>
      </div>

      {/* KB Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Drugs", value: status?.drugs || 0, icon: "💊" },
          { label: "NCCN Rules", value: status?.nccn || 0, icon: "📋" },
          { label: "Payer Policies", value: status?.policies || 0, icon: "🏥" },
          { label: "Ground Truth Rows", value: status?.groundTruth || 0, icon: "🎯" },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-5">
            <div className="text-2xl mb-1">{icon}</div>
            <div className="text-3xl font-bold text-foreground">{value}</div>
            <div className="text-sm text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Run panel */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground">Select ETL Agents</h2>
            </div>
            <div className="space-y-3">
              {AGENTS.map(({ id, label, desc }) => (
                <label key={id} className="flex items-start gap-3 cursor-pointer group">
                  <input type="checkbox" checked={selectedAgents.includes(id)} onChange={() => toggleAgent(id)}
                    className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary/30" />
                  <div>
                    <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground mb-3 text-sm">Filter by Cancer Type (optional)</h2>
            <p className="text-xs text-muted-foreground mb-3">Leave empty to run across all 25 cancer types.</p>
            <div className="flex flex-wrap gap-2">
              {ALL_CANCER_TYPES.map(ct => (
                <button key={ct} onClick={() => toggleCancerType(ct)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    selectedCancerTypes.includes(ct)
                      ? "bg-primary text-white border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50"
                  }`}>
                  {ct.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => runMutation.mutate()} disabled={runMutation.isPending || runStatus === "running" || selectedAgents.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            {runStatus === "running" ? <><RefreshCw className="w-4 h-4 animate-spin" /> Running ETL...</>
              : <><Play className="w-4 h-4" /> Run Selected Agents</>}
          </button>

          {runStatus === "completed" && (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-950/30 px-4 py-3 rounded-xl border border-green-200">
              <CheckCircle className="w-4 h-4" /> ETL pipeline completed successfully
            </div>
          )}
          {runStatus === "failed" && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-950/30 px-4 py-3 rounded-xl border border-red-200">
              <AlertCircle className="w-4 h-4" /> ETL pipeline failed — check logs
            </div>
          )}
        </div>

        {/* Log terminal */}
        <div className="bg-card border border-border rounded-xl">
          <div className="flex items-center gap-2 p-4 border-b border-border">
            <Clock className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground text-sm">Live Log</h2>
            {runStatus === "running" && <span className="ml-auto flex items-center gap-1.5 text-xs text-amber-600"><RefreshCw className="w-3 h-3 animate-spin" /> Running</span>}
          </div>
          <div ref={logRef} className="h-96 overflow-y-auto p-4 font-mono text-xs bg-slate-950 rounded-b-xl">
            {logs.length === 0 ? (
              <p className="text-slate-500">No logs yet. Run an ETL agent to see output here.</p>
            ) : logs.map((log, i) => (
              <div key={i} className={`mb-1 ${log.includes("✓") || log.includes("complete") ? "text-green-400" : log.includes("Error") || log.includes("failed") ? "text-red-400" : "text-slate-300"}`}>
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cancer type coverage table */}
      <div className="mt-6 bg-card border border-border rounded-xl">
        <div className="p-5 border-b border-border">
          <h2 className="font-semibold text-foreground">Coverage by Cancer Type</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["Cancer Type", "Drugs", "NCCN Rules", "Payer Policies", "GT Rows", "Coverage"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(cancerTypes as any[]).map((ct: any) => {
                const total = ct.drugCount + ct.nccnCount + ct.policyCount + ct.gtCount;
                const pct = total > 0 ? Math.min(100, Math.round((ct.gtCount / Math.max(1, ct.drugCount)) * 100)) : 0;
                return (
                  <tr key={ct.cancerType} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-foreground capitalize">{ct.cancerType.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{ct.drugCount}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{ct.nccnCount}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{ct.policyCount}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{ct.gtCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
