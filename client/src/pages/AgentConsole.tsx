import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Bot, Play, RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle,
  ChevronRight, Zap, Database, FileText, Send, Terminal, Loader2,
  Activity
} from "lucide-react";

interface LogEntry {
  runId: string;
  agentName: string;
  level: "info" | "success" | "warning" | "error" | "step";
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

interface AgentRunState {
  runId: string;
  status: "pending" | "running" | "completed" | "failed";
  phase: string;
  denialId?: string;
  appealId?: string;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
  agentA: { status: string; steps: string[] };
  agentB: { status: string; steps: string[] };
  agentC: { status: string; steps: string[] };
}

const LOG_COLORS: Record<string, string> = {
  info: "text-muted-foreground",
  success: "text-green-400",
  warning: "text-yellow-400",
  error: "text-red-400",
  step: "text-blue-400",
};

const LOG_PREFIXES: Record<string, string> = {
  info: "  ℹ ",
  success: "  ✓ ",
  warning: "  ⚠ ",
  error: "  ✗ ",
  step: "  ▶ ",
};

const AGENT_LABELS = [
  { key: "agentA", label: "Agent A", subtitle: "Denial Ingestion", icon: FileText },
  { key: "agentB", label: "Agent B", subtitle: "GT Matching", icon: Database },
  { key: "agentC", label: "Agent C", subtitle: "Appeal Generation", icon: Send },
];

const ETL_STAGES = [
  { key: "fda-ingest", label: "A1: FDA Drug Ingest", icon: Database },
  { key: "nccn-extract", label: "A2: NCCN Extraction", icon: FileText },
  { key: "payer-policy", label: "A3: Payer Policies", icon: Bot },
  { key: "ground-truth", label: "A4: Ground Truth Build", icon: CheckCircle2 },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    pending:   { variant: "outline", label: "Pending" },
    running:   { variant: "default", label: "Running" },
    completed: { variant: "default", label: "Complete" },
    failed:    { variant: "destructive", label: "Failed" },
    idle:      { variant: "secondary", label: "Idle" },
  };
  const cfg = map[status] || { variant: "outline", label: status };
  return (
    <Badge
      variant={cfg.variant}
      className={status === "completed" ? "bg-green-500/20 text-green-400 border-green-500/30" :
                 status === "running" ? "bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse" :
                 status === "failed" ? "bg-red-500/20 text-red-400 border-red-500/30" : ""}
    >
      {status === "running" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
      {status === "completed" && <CheckCircle2 className="w-3 h-3 mr-1" />}
      {status === "failed" && <XCircle className="w-3 h-3 mr-1" />}
      {cfg.label}
    </Badge>
  );
}

export default function AgentConsole() {
  const { toast } = useToast();
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [runState, setRunState] = useState<AgentRunState | null>(null);
  const [selectedDenialId, setSelectedDenialId] = useState<string>("auto");
  const [rawText, setRawText] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"pipeline" | "etl">("pipeline");
  const [etlStatus, setEtlStatus] = useState<any>(null);
  const sseRef = useRef<EventSource | null>(null);

  // Query: denials list
  const { data: denials = [] } = useQuery<any[]>({ queryKey: ["/api/denials"] });

  // Query: all pipeline runs
  const { data: allRuns = [] } = useQuery<AgentRunState[]>({
    queryKey: ["/api/agents/runs"],
    refetchInterval: activeRunId ? 3000 : false,
  });

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // SSE connection for active run
  useEffect(() => {
    if (!activeRunId) return;
    if (sseRef.current) {
      sseRef.current.close();
    }

    const apiBase = (window as any).__API_BASE__ || "";
    const sse = new EventSource(`${apiBase}/api/agents/stream/${activeRunId}`);
    sseRef.current = sse;

    sse.onmessage = (event) => {
      try {
        const entry: LogEntry = JSON.parse(event.data);
        setLogs(prev => [...prev, entry]);
      } catch { /* ignore parse errors */ }
    };

    sse.addEventListener("state", (event: any) => {
      try {
        const state = JSON.parse(event.data);
        setRunState(state);
      } catch { /* ignore */ }
    });

    sse.addEventListener("done", () => {
      sse.close();
      queryClient.invalidateQueries({ queryKey: ["/api/agents/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appeals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    });

    return () => sse.close();
  }, [activeRunId]);

  // Start pipeline mutation
  const startPipeline = useMutation({
    mutationFn: async () => {
      const body: any = {};
      if (selectedDenialId !== "auto" && selectedDenialId !== "raw") {
        body.denialId = selectedDenialId;
      }
      if (selectedDenialId === "raw" && rawText.trim()) {
        body.rawDenialText = rawText.trim();
      }
      const result = await apiRequest("POST", "/api/agents/run", body);
      return result.json();
    },
    onSuccess: (data) => {
      setActiveRunId(data.runId);
      setLogs([]);
      setRunState(null);
      toast({ title: "Pipeline started", description: `Run ID: ${data.runId}` });
      queryClient.invalidateQueries({ queryKey: ["/api/agents/runs"] });
    },
    onError: (err: Error) => {
      toast({ title: "Pipeline failed to start", description: err.message, variant: "destructive" });
    },
  });

  // Start ETL mutation
  const startEtl = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("POST", "/api/etl/run", {});
      return result.json();
    },
    onSuccess: (data) => {
      toast({ title: "ETL pipeline started", description: data.message });
      setActiveRunId(data.runId);
      setLogs([]);
      setRunState(null);
      pollEtlStatus();
    },
    onError: (err: Error) => {
      toast({ title: "ETL failed to start", description: err.message, variant: "destructive" });
    },
  });

  const pollEtlStatus = async () => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/etl/status");
        const data = await res.json();
        setEtlStatus(data);
        if (data.status === "completed" || data.status === "failed") {
          clearInterval(interval);
        }
      } catch { /* ignore */ }
    }, 2000);
  };

  const getAgentProgress = (state: AgentRunState | null, agentKey: "agentA" | "agentB" | "agentC") => {
    if (!state) return 0;
    const agent = state[agentKey];
    if (agent.status === "completed") return 100;
    if (agent.status === "running") return 60;
    if (agent.status === "failed") return 100;
    return 0;
  };

  const getPhaseIdx = (phase: string) => {
    const phases = ["idle", "agent-a", "agent-b", "agent-c", "done"];
    return phases.indexOf(phase);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Terminal className="w-5 h-5 text-primary" />
            Agent Console
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            End-to-end agentic pipeline: Agent A (Ingest) → Agent B (Match) → Agent C (Generate)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === "pipeline" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("pipeline")}
          >
            <Zap className="w-3.5 h-3.5 mr-1.5" />
            Appeal Pipeline
          </Button>
          <Button
            variant={activeTab === "etl" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("etl")}
          >
            <Database className="w-3.5 h-3.5 mr-1.5" />
            ETL / Data Refresh
          </Button>
        </div>
      </div>

      {/* PIPELINE TAB */}
      {activeTab === "pipeline" && (
        <div className="grid grid-cols-3 gap-6">
          {/* Left: Controls + Agent Status */}
          <div className="col-span-1 space-y-4">
            {/* Launch Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Play className="w-4 h-4 text-primary" />
                  Launch Pipeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium">Select Denial</label>
                  <Select value={selectedDenialId} onValueChange={setSelectedDenialId}>
                    <SelectTrigger data-testid="select-denial" className="text-sm">
                      <SelectValue placeholder="Choose a denial..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-select first denial</SelectItem>
                      <SelectItem value="raw">Paste raw denial text</SelectItem>
                      {denials.map((d: any) => (
                        <SelectItem key={d.denialRecordId} value={d.denialRecordId}>
                          {d.denialRecordId} — {d.drugNameRaw} / {d.payerName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedDenialId === "raw" && (
                  <Textarea
                    placeholder="Paste raw denial text here..."
                    className="text-xs font-mono h-24 resize-none"
                    value={rawText}
                    onChange={e => setRawText(e.target.value)}
                    data-testid="input-raw-denial-text"
                  />
                )}

                <Button
                  className="w-full"
                  onClick={() => startPipeline.mutate()}
                  disabled={startPipeline.isPending || runState?.status === "running"}
                  data-testid="button-start-pipeline"
                >
                  {startPipeline.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Starting...</>
                  ) : runState?.status === "running" ? (
                    <><Activity className="w-4 h-4 mr-2 animate-pulse" />Running...</>
                  ) : (
                    <><Play className="w-4 h-4 mr-2" />Run A→B→C Pipeline</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Pipeline Progress */}
            {runState && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 justify-between">
                    <span className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-primary" />
                      Run {runState.runId.slice(0, 12)}...
                    </span>
                    <StatusBadge status={runState.status} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Overall pipeline flow */}
                  <div className="flex items-center gap-1 text-xs">
                    {["A", "B", "C"].map((agent, i) => {
                      const idx = getPhaseIdx(runState.phase);
                      const agentIdx = i + 1;
                      const done = idx > agentIdx || runState.status === "completed";
                      const active = idx === agentIdx && runState.status === "running";
                      return (
                        <div key={agent} className="flex items-center gap-1">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                            done ? "bg-green-500 text-white" :
                            active ? "bg-blue-500 text-white animate-pulse" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {done ? "✓" : agent}
                          </div>
                          {i < 2 && <ChevronRight className={`w-3 h-3 ${idx > agentIdx ? "text-green-500" : "text-muted-foreground"}`} />}
                        </div>
                      );
                    })}
                    <span className="ml-auto text-muted-foreground">{runState.phase}</span>
                  </div>

                  {/* Per-agent progress */}
                  {AGENT_LABELS.map(({ key, label, subtitle }) => {
                    const agentKey = key as "agentA" | "agentB" | "agentC";
                    const agentState = runState[agentKey];
                    const progress = getAgentProgress(runState, agentKey);
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium">{label} <span className="text-muted-foreground font-normal">— {subtitle}</span></span>
                          <StatusBadge status={agentState.status} />
                        </div>
                        <Progress value={progress} className="h-1.5" />
                        {agentState.steps.length > 0 && (
                          <p className="text-xs text-muted-foreground truncate">{agentState.steps[agentState.steps.length - 1]}</p>
                        )}
                      </div>
                    );
                  })}

                  {/* Result */}
                  {runState.status === "completed" && runState.appealId && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-xs text-green-400">
                      <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5" />
                      Appeal generated: <span className="font-mono font-bold">{runState.appealId}</span>
                    </div>
                  )}

                  {runState.status === "failed" && runState.errorMessage && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-400">
                      <XCircle className="w-3.5 h-3.5 inline mr-1.5" />
                      {runState.errorMessage}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Previous Runs */}
            {allRuns.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Recent Runs
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {allRuns.slice(0, 5).map((run) => (
                    <div
                      key={run.runId}
                      className={`flex items-center justify-between p-2 rounded-md cursor-pointer text-xs transition-colors ${
                        activeRunId === run.runId ? "bg-primary/10" : "hover:bg-muted"
                      }`}
                      onClick={() => {
                        setActiveRunId(run.runId);
                        setLogs([]);
                        setRunState(run);
                      }}
                      data-testid={`run-item-${run.runId}`}
                    >
                      <span className="font-mono text-muted-foreground">{run.runId.slice(0, 14)}...</span>
                      <StatusBadge status={run.status} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Live Log Terminal */}
          <div className="col-span-2">
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-3 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-green-400" />
                    Live Agent Logs
                    {activeRunId && <span className="text-xs text-muted-foreground font-mono ml-2">{activeRunId}</span>}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {runState?.status === "running" && (
                      <div className="flex items-center gap-1.5 text-xs text-blue-400">
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                        Live
                      </div>
                    )}
                    {logs.length > 0 && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setLogs([])}>
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                <div
                  className="h-full overflow-y-auto bg-zinc-950 rounded-b-lg p-4 font-mono text-xs"
                  style={{ minHeight: "500px", maxHeight: "600px" }}
                  data-testid="agent-log-terminal"
                >
                  {logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
                      <Terminal className="w-8 h-8 opacity-30" />
                      <p>Start a pipeline run to see live agent logs</p>
                      <p className="text-xs opacity-60">Logs stream in real-time via SSE</p>
                    </div>
                  ) : (
                    logs.map((log, idx) => (
                      <div
                        key={idx}
                        className={`mb-0.5 leading-relaxed ${LOG_COLORS[log.level] || "text-muted-foreground"}`}
                        data-testid={`log-entry-${idx}`}
                      >
                        <span className="text-zinc-600 select-none">
                          {new Date(log.timestamp).toISOString().slice(11, 19)}{" "}
                        </span>
                        <span className="text-zinc-500 select-none">[{log.agentName}]</span>
                        {LOG_PREFIXES[log.level] || "  "}
                        <span>{log.message}</span>
                        {log.data && Object.keys(log.data).length > 0 && (
                          <span className="text-zinc-600 ml-2">
                            {JSON.stringify(log.data)}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ETL TAB */}
      {activeTab === "etl" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                Pan-Cancer ETL Pipeline
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                4-stage data ingestion: FDA openFDA API → NCCN extraction → Payer policy crawler → Ground truth builder.
                Covers all 25 cancer types.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 mb-6">
                {ETL_STAGES.map((stage, i) => {
                  const currentPhase = etlStatus?.phase || "";
                  const stagePhases = ["fda-ingest", "nccn-extract", "payer-policy", "ground-truth"];
                  const currentIdx = stagePhases.indexOf(currentPhase);
                  const stageCompleted = etlStatus?.status === "completed" || currentIdx > i;
                  const stageActive = currentIdx === i && etlStatus?.status === "running";

                  return (
                    <div
                      key={stage.key}
                      className={`rounded-lg border p-4 text-center transition-all ${
                        stageCompleted ? "border-green-500/30 bg-green-500/5" :
                        stageActive ? "border-blue-500/30 bg-blue-500/5" :
                        "border-border"
                      }`}
                    >
                      <stage.icon className={`w-6 h-6 mx-auto mb-2 ${
                        stageCompleted ? "text-green-400" :
                        stageActive ? "text-blue-400 animate-pulse" :
                        "text-muted-foreground"
                      }`} />
                      <div className="text-xs font-medium">{stage.label}</div>
                      <div className="mt-2">
                        {stageCompleted && <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Done</Badge>}
                        {stageActive && <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs animate-pulse">Running</Badge>}
                        {!stageCompleted && !stageActive && <Badge variant="outline" className="text-xs">Queued</Badge>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {etlStatus && (
                <div className="mb-4 p-4 bg-muted/40 rounded-lg text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <StatusBadge status={etlStatus.status} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Phase</span>
                    <span className="font-medium">{etlStatus.phase}</span>
                  </div>
                  {etlStatus.logCount != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Log entries</span>
                      <span>{etlStatus.logCount}</span>
                    </div>
                  )}
                  {etlStatus.errorMessage && (
                    <div className="text-red-400 text-xs flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      {etlStatus.errorMessage}
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={() => startEtl.mutate()}
                disabled={startEtl.isPending || etlStatus?.status === "running"}
                className="w-full"
                data-testid="button-start-etl"
              >
                {startEtl.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Starting ETL...</>
                ) : etlStatus?.status === "running" ? (
                  <><Activity className="w-4 h-4 mr-2 animate-pulse" />ETL Running...</>
                ) : (
                  <><Database className="w-4 h-4 mr-2" />Run Full ETL Pipeline (All 25 Cancer Types)</>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Note: Full ETL takes 5–15 minutes due to openFDA and Cohere rate limits (600ms / 400ms delays)
              </p>
            </CardContent>
          </Card>

          {/* Cancer Type Coverage Grid */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">25-Cancer Type Coverage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {[
                  "breast", "lung", "colon", "ovarian", "brain",
                  "prostate", "bladder", "pancreatic", "liver", "gastric",
                  "esophageal", "cervical", "endometrial", "thyroid", "melanoma",
                  "renal", "head_neck", "leukemia", "lymphoma", "myeloma",
                  "sarcoma", "mesothelioma", "bile_duct", "neuroendocrine", "myelodysplastic"
                ].map(ct => (
                  <span
                    key={ct}
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                    data-testid={`cancer-type-${ct}`}
                  >
                    {ct.replace("_", " ")}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
