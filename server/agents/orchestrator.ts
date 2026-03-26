/**
 * PAE-Onc Pipeline Orchestrator
 * Coordinates Agent A → Agent B → Agent C as a full agentic pipeline.
 *
 * Each run:
 *   1. Creates a RunState record (accessible via /api/agents/status/:runId)
 *   2. Logs every step to AgentLogger (streamed via SSE at /api/agents/stream/:runId)
 *   3. Chains A→B→C, passing enriched outputs at each stage
 *   4. On success: returns appealId + PDF path + fax confirmation
 *   5. On failure: logs error, marks run failed, preserves partial state
 */

import { agentLogger } from "./logger";
import { runStore } from "./run-store";
import { runAgentA, AgentAInput, AgentAOutput } from "./agent-a";
import { runAgentB, AgentBOutput } from "./agent-b";
import { runAgentC, AgentCOutput } from "./agent-c";

export interface PipelineInput {
  denialId?: string;          // Process existing denial
  rawDenialText?: string;     // Process raw denial text (upload/OCR)
  patientId?: string;         // Override patient lookup
}

export interface PipelineResult {
  runId: string;
  success: boolean;
  appealId?: string;
  pdfPath?: string;
  faxNumber?: string;
  faxLogId?: number;
  agentA?: AgentAOutput;
  agentB?: AgentBOutput;
  agentC?: AgentCOutput;
  error?: string;
  duration: number;           // ms
  logCount: number;
}

export async function runPipeline(input: PipelineInput & { runId?: string }): Promise<PipelineResult> {
  // Create or reuse run record
  const run = input.runId ? (runStore.getRun(input.runId) || runStore.createRun(input.denialId || "unspecified")) : runStore.createRun(input.denialId || "unspecified");
  const { runId } = run;
  const startTime = Date.now();

  agentLogger.log(runId, "Orchestrator", "═══════════════════════════════════════════════", "info");
  agentLogger.log(runId, "Orchestrator", "PAE-Onc Agentic Pipeline v2 — Starting Run", "info");
  agentLogger.log(runId, "Orchestrator", `Run ID: ${runId}`, "info");
  agentLogger.log(runId, "Orchestrator", `Input: ${input.denialId ? `Denial ${input.denialId}` : "Raw text extraction"}`, "info");
  agentLogger.log(runId, "Orchestrator", "Pipeline: Agent A (Ingest) → Agent B (Match) → Agent C (Generate)", "info");
  agentLogger.log(runId, "Orchestrator", "═══════════════════════════════════════════════", "info");

  runStore.updateRun(runId, { status: "running" });

  let agentAOutput: AgentAOutput | undefined;
  let agentBOutput: AgentBOutput | undefined;
  let agentCOutput: AgentCOutput | undefined;

  // ── AGENT A ──────────────────────────────────────────────────────────────────
  try {
    agentLogger.log(runId, "Orchestrator", "┌─ Handoff → Agent A: Denial Ingestion", "step");
    agentAOutput = await runAgentA({
      runId,
      denialId: input.denialId,
      rawDenialText: input.rawDenialText,
      patientId: input.patientId,
    } as AgentAInput);
    agentLogger.log(runId, "Orchestrator", `└─ Agent A complete ✓ (${agentAOutput.denial.denialRecordId})`, "success");
  } catch (err: unknown) {
    const msg = (err as Error).message;
    agentLogger.error(runId, "Orchestrator", `✗ Agent A failed: ${msg}`);
    runStore.updateRun(runId, {
      status: "failed",
      phase: "idle",
      errorMessage: `Agent A: ${msg}`,
      completedAt: new Date().toISOString(),
    });
    return {
      runId,
      success: false,
      error: `Agent A failed: ${msg}`,
      duration: Date.now() - startTime,
      logCount: agentLogger.getLogs(runId).length,
    };
  }

  // ── AGENT B ──────────────────────────────────────────────────────────────────
  try {
    agentLogger.log(runId, "Orchestrator", "┌─ Handoff → Agent B: GT Matching & Assessment", "step");
    agentBOutput = await runAgentB({
      runId,
      denial: agentAOutput.denial,
      patient: agentAOutput.patient,
    });
    agentLogger.log(
      runId,
      "Orchestrator",
      `└─ Agent B complete ✓ (Conflict ${agentBOutput.conflictType}, Strength ${agentBOutput.appealStrength}/5)`,
      "success"
    );
  } catch (err: unknown) {
    const msg = (err as Error).message;
    agentLogger.error(runId, "Orchestrator", `✗ Agent B failed: ${msg}`);
    runStore.updateRun(runId, {
      status: "failed",
      errorMessage: `Agent B: ${msg}`,
      completedAt: new Date().toISOString(),
    });
    return {
      runId,
      success: false,
      agentA: agentAOutput,
      error: `Agent B failed: ${msg}`,
      duration: Date.now() - startTime,
      logCount: agentLogger.getLogs(runId).length,
    };
  }

  // ── AGENT C ──────────────────────────────────────────────────────────────────
  try {
    agentLogger.log(runId, "Orchestrator", "┌─ Handoff → Agent C: Appeal Generation & Delivery", "step");
    agentCOutput = await runAgentC({
      runId,
      denial: agentAOutput.denial,
      patient: agentAOutput.patient,
      groundTruth: agentBOutput.groundTruth,
      conflictType: agentBOutput.conflictType,
      appealStrength: agentBOutput.appealStrength,
      legalTags: agentBOutput.legalTags,
      strategy: agentBOutput.strategy,
    });
    agentLogger.log(
      runId,
      "Orchestrator",
      `└─ Agent C complete ✓ (${agentCOutput.appealId}, PDF ${agentCOutput.pdfPath})`,
      "success"
    );
  } catch (err: unknown) {
    const msg = (err as Error).message;
    agentLogger.error(runId, "Orchestrator", `✗ Agent C failed: ${msg}`);
    runStore.updateRun(runId, {
      status: "failed",
      errorMessage: `Agent C: ${msg}`,
      completedAt: new Date().toISOString(),
    });
    return {
      runId,
      success: false,
      agentA: agentAOutput,
      agentB: agentBOutput,
      error: `Agent C failed: ${msg}`,
      duration: Date.now() - startTime,
      logCount: agentLogger.getLogs(runId).length,
    };
  }

  // ── PIPELINE COMPLETE ────────────────────────────────────────────────────────
  const duration = Date.now() - startTime;
  runStore.updateRun(runId, {
    status: "completed",
    phase: "done",
    appealId: agentCOutput.appealId,
    completedAt: new Date().toISOString(),
    result: {
      appealId: agentCOutput.appealId,
      conflictType: agentBOutput.conflictType,
      appealStrength: agentBOutput.appealStrength,
      totalWords: Object.values(agentCOutput.sectionsSummary).reduce((a, b) => a + b, 0),
    },
  });

  agentLogger.log(runId, "Orchestrator", "═══════════════════════════════════════════════", "info");
  agentLogger.success(
    runId,
    "Orchestrator",
    `✅ Pipeline complete in ${(duration / 1000).toFixed(1)}s — Appeal ${agentCOutput.appealId} ready for delivery`
  );
  agentLogger.log(
    runId,
    "Orchestrator",
    `Summary: Conflict ${agentBOutput.conflictType} | Strength ${agentBOutput.appealStrength}/5 | Fax → ${agentCOutput.faxNumber}`,
    "info"
  );
  agentLogger.log(runId, "Orchestrator", "═══════════════════════════════════════════════", "info");

  return {
    runId,
    success: true,
    appealId: agentCOutput.appealId,
    pdfPath: agentCOutput.pdfPath,
    faxNumber: agentCOutput.faxNumber,
    faxLogId: agentCOutput.faxLogId,
    agentA: agentAOutput,
    agentB: agentBOutput,
    agentC: agentCOutput,
    duration,
    logCount: agentLogger.getLogs(runId).length,
  };
}
