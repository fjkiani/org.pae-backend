/**
 * AgentLogger — shared logging substrate for all PAE-Onc agents.
 * Stores structured log entries in memory keyed by runId.
 * Supports SSE streaming via EventEmitter.
 */

import { EventEmitter } from "events";

export type LogLevel = "info" | "success" | "warning" | "error" | "step";

export interface LogEntry {
  runId: string;
  agentName: string;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

class AgentLogger extends EventEmitter {
  private logs: Map<string, LogEntry[]> = new Map();

  log(
    runId: string,
    agentName: string,
    message: string,
    level: LogLevel = "info",
    data?: Record<string, unknown>,
  ): LogEntry {
    const entry: LogEntry = {
      runId,
      agentName,
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
    };

    if (!this.logs.has(runId)) {
      this.logs.set(runId, []);
    }
    this.logs.get(runId)!.push(entry);

    // Emit for SSE subscribers
    this.emit(`log:${runId}`, entry);
    this.emit("log:*", entry);

    return entry;
  }

  step(runId: string, agentName: string, message: string, data?: Record<string, unknown>) {
    return this.log(runId, agentName, message, "step", data);
  }

  success(runId: string, agentName: string, message: string, data?: Record<string, unknown>) {
    return this.log(runId, agentName, message, "success", data);
  }

  warn(runId: string, agentName: string, message: string, data?: Record<string, unknown>) {
    return this.log(runId, agentName, message, "warning", data);
  }

  error(runId: string, agentName: string, message: string, data?: Record<string, unknown>) {
    return this.log(runId, agentName, message, "error", data);
  }

  getLogs(runId: string): LogEntry[] {
    return this.logs.get(runId) ?? [];
  }

  getAllLogs(): LogEntry[] {
    const all: LogEntry[] = [];
    for (const entries of this.logs.values()) {
      all.push(...entries);
    }
    return all.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  clearLogs(runId: string) {
    this.logs.delete(runId);
  }

  getAllRunIds(): string[] {
    return Array.from(this.logs.keys());
  }
}

export const agentLogger = new AgentLogger();
agentLogger.setMaxListeners(100); // Support many SSE connections
