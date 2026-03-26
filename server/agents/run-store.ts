/**
 * RunStore — in-memory store for agent pipeline run state.
 * Tracks status, phase, progress, and results for each run.
 */

export type RunStatus = "pending" | "running" | "completed" | "failed";
export type RunPhase = "idle" | "agent-a" | "agent-b" | "agent-c" | "done";

export interface AgentRunState {
  runId: string;
  status: RunStatus;
  phase: RunPhase;
  denialId?: string;
  appealId?: string;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
  result?: Record<string, unknown>;
  // Per-agent step tracking
  agentA: { status: RunStatus; steps: string[]; startedAt?: string; completedAt?: string };
  agentB: { status: RunStatus; steps: string[]; startedAt?: string; completedAt?: string };
  agentC: { status: RunStatus; steps: string[]; startedAt?: string; completedAt?: string };
}

export interface EtlRunState {
  runId: string;
  type: "etl";
  status: RunStatus;
  phase: string;
  totalCancerTypes: number;
  processedCancerTypes: number;
  totalDrugs: number;
  processedDrugs: number;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

class RunStore {
  private runs: Map<string, AgentRunState> = new Map();
  private etlRuns: Map<string, EtlRunState> = new Map();

  createRun(denialId: string): AgentRunState {
    const runId = `RUN-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const state: AgentRunState = {
      runId,
      status: "pending",
      phase: "idle",
      denialId,
      startedAt: new Date().toISOString(),
      agentA: { status: "pending", steps: [] },
      agentB: { status: "pending", steps: [] },
      agentC: { status: "pending", steps: [] },
    };
    this.runs.set(runId, state);
    return state;
  }

  getRun(runId: string): AgentRunState | undefined {
    return this.runs.get(runId);
  }

  getAllRuns(): AgentRunState[] {
    return Array.from(this.runs.values()).sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }

  updateRun(runId: string, update: Partial<AgentRunState>): AgentRunState | undefined {
    const run = this.runs.get(runId);
    if (!run) return undefined;
    Object.assign(run, update);
    return run;
  }

  updateAgentPhase(
    runId: string,
    agent: "agentA" | "agentB" | "agentC",
    update: Partial<AgentRunState["agentA"]>
  ) {
    const run = this.runs.get(runId);
    if (!run) return;
    Object.assign(run[agent], update);
  }

  addAgentStep(runId: string, agent: "agentA" | "agentB" | "agentC", step: string) {
    const run = this.runs.get(runId);
    if (!run) return;
    run[agent].steps.push(step);
  }

  // ETL runs
  createEtlRun(): EtlRunState {
    const runId = `ETL-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const state: EtlRunState = {
      runId,
      type: "etl",
      status: "pending",
      phase: "starting",
      totalCancerTypes: 25,
      processedCancerTypes: 0,
      totalDrugs: 0,
      processedDrugs: 0,
      startedAt: new Date().toISOString(),
    };
    this.etlRuns.set(runId, state);
    return state;
  }

  getEtlRun(runId: string): EtlRunState | undefined {
    return this.etlRuns.get(runId);
  }

  updateEtlRun(runId: string, update: Partial<EtlRunState>) {
    const run = this.etlRuns.get(runId);
    if (!run) return;
    Object.assign(run, update);
  }

  getLatestEtlRun(): EtlRunState | undefined {
    const runs = Array.from(this.etlRuns.values());
    return runs[runs.length - 1];
  }
}

export const runStore = new RunStore();
