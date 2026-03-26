import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Database, AlertTriangle, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CONFLICT_DESCRIPTIONS: Record<string, { label: string; desc: string; color: string }> = {
  A: { label: "Experimental vs NCCN Cat 1", desc: "Payer classifies FDA-approved NCCN Cat 1 drug as experimental/investigational", color: "conflict-A" },
  B: { label: "NMN vs FDA Approved", desc: "Payer labels drug 'not medically necessary' despite FDA approval + NCCN Cat 1/2A", color: "conflict-B" },
  C: { label: "Step Therapy vs NCCN Sequence", desc: "Payer-imposed step therapy contradicts NCCN-recommended treatment sequence", color: "conflict-C" },
  D: { label: "CMS Shadow Policy", desc: "CMS Transparency data shows 0.00 allowed amounts or 100% PA rate for NCCN Cat 1 drug", color: "conflict-D" },
};

export default function GroundTruthPage() {
  const [filterCancer, setFilterCancer] = useState("all");
  const [filterPayer, setFilterPayer] = useState("all");
  const [filterConflict, setFilterConflict] = useState("all");

  const { data: rows = [] } = useQuery<any[]>({ queryKey: ["/api/ground-truth"] });

  const filtered = rows.filter(r =>
    (filterCancer === "all" || r.cancerType === filterCancer) &&
    (filterPayer === "all" || r.payerId === filterPayer) &&
    (filterConflict === "all" || r.conflictType === filterConflict)
  );

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          Ground Truth Dataset
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Authoritative mismatch table: NCCN/FDA standards vs payer policies. Used as truth table for all appeal decisions.
        </p>
      </div>

      {/* Conflict Legend */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Object.entries(CONFLICT_DESCRIPTIONS).map(([type, { label, desc, color }]) => (
          <div key={type} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${color}`}>Type {type}</span>
            </div>
            <div className="text-xs font-semibold text-foreground mb-1">{label}</div>
            <div className="text-xs text-muted-foreground">{desc}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterCancer} onValueChange={setFilterCancer}>
          <SelectTrigger className="w-40 text-xs h-8" data-testid="select-filter-cancer">
            <SelectValue placeholder="Cancer type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cancers</SelectItem>
            {["breast", "ovarian", "brain", "colon", "lung"].map(c => (
              <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterPayer} onValueChange={setFilterPayer}>
          <SelectTrigger className="w-32 text-xs h-8" data-testid="select-filter-payer">
            <SelectValue placeholder="Payer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payers</SelectItem>
            {["UHC", "Cigna", "Aetna", "Humana"].map(p => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterConflict} onValueChange={setFilterConflict}>
          <SelectTrigger className="w-36 text-xs h-8" data-testid="select-filter-conflict">
            <SelectValue placeholder="Conflict type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Conflicts</SelectItem>
            {["A", "B", "C", "D"].map(t => (
              <SelectItem key={t} value={t}>Type {t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="text-xs text-muted-foreground self-center ml-auto">
          {filtered.length} of {rows.length} rows
        </div>
      </div>

      {/* Ground Truth Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/60 border-b border-border">
                {["ID", "Drug", "Cancer", "Line", "NCCN", "Payer", "Policy", "Conflict", "Denial Reason", "Severity"].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((row: any) => (
                <tr key={row.groundTruthRowId} className="hover:bg-muted/40 transition-colors" data-testid={`row-gt-${row.groundTruthRowId}`}>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{row.groundTruthRowId.split("-").slice(-2).join("-")}</td>
                  <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{row.drugId}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full cancer-${row.cancerType}`}>{row.cancerType}</span></td>
                  <td className="px-4 py-3 text-foreground">{row.lineOfTherapy}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded font-bold ${row.nccnCategory === "1" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"}`}>
                      Cat {row.nccnCategory}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{row.payerId}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono">{row.policyId}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold conflict-${row.conflictType}`}>Type {row.conflictType}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.denialRationaleType.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${row.severity === "high" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"}`}>
                      {row.severity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">No ground truth rows match your filters.</div>
          )}
        </div>
      </div>

      {/* Detail Cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Conflict Details</h3>
        {filtered.map((row: any) => (
          <div key={row.groundTruthRowId + "-detail"} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-bold px-2 py-0.5 rounded conflict-${row.conflictType}`}>Type {row.conflictType}</span>
                <span className="font-semibold text-foreground text-sm">{row.drugId}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full cancer-${row.cancerType}`}>{row.cancerType}</span>
                <span className="text-xs text-muted-foreground">{row.payerId} · {row.policyId}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${row.severity === "high" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>{row.severity}</span>
            </div>
            <p className="text-xs text-foreground mb-2"><strong>Conflict:</strong> {row.conflictDescription}</p>
            {row.denialTextSnippet && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 mt-2">
                <div className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">Payer Denial Language:</div>
                <p className="text-xs text-red-700 dark:text-red-300 italic">"{row.denialTextSnippet}"</p>
              </div>
            )}
            {row.legalExposureTags && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {JSON.parse(row.legalExposureTags).map((tag: string) => (
                  <span key={tag} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{tag}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
