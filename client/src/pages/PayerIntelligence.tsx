import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp, Award } from "lucide-react";

function WinRateCell({ rate }: { rate: number | undefined }) {
  if (rate === undefined) return <td className="px-4 py-3 text-center text-muted-foreground text-sm">—</td>;
  const pct = Math.round(rate * 100);
  const color = pct >= 70 ? "bg-green-100 text-green-700 dark:bg-green-950/40"
    : pct >= 50 ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40"
    : pct >= 30 ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40"
    : "bg-red-100 text-red-700 dark:bg-red-950/40";
  return (
    <td className="px-4 py-3 text-center">
      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>{pct}%</span>
    </td>
  );
}

export default function PayerIntelligence() {
  const { data: winRate } = useQuery<any>({ queryKey: ["/api/analytics/win-rate"] });
  const { data: intel = [] } = useQuery<any[]>({ queryKey: ["/api/analytics/payer-intelligence"] });

  const payers = ["UHC", "Cigna", "Aetna", "Humana"];
  const drugs = [...new Set((intel as any[]).map((r: any) => r.drugId))].slice(0, 12);

  const getRate = (payerId: string, drugId: string) => {
    const row = (intel as any[]).find((r: any) => r.payerId === payerId && r.drugId === drugId);
    return row?.winRate;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Payer Intelligence</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Win rates and appeal patterns by payer and drug</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {payers.map(p => {
          const rate = winRate?.byPayer?.[p];
          const pct = rate !== undefined ? Math.round(rate * 100) : null;
          return (
            <div key={p} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">{p}</span>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold text-foreground">{pct !== null ? `${pct}%` : "—"}</div>
              <div className="text-xs text-muted-foreground mt-1">Win rate</div>
            </div>
          );
        })}
      </div>

      {/* Win rate heatmap */}
      <div className="bg-card border border-border rounded-xl mb-6">
        <div className="flex items-center gap-2 p-5 border-b border-border">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground">Win Rate Heatmap (Payer × Drug)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Drug</th>
                {payers.map(p => (
                  <th key={p} className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">{p}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {drugs.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  No outcome data yet. Record appeal outcomes to build payer intelligence.
                </td></tr>
              ) : drugs.map(drug => (
                <tr key={drug} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{drug}</td>
                  {payers.map(p => <WinRateCell key={p} rate={getRate(p, drug)} />)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top winning arguments */}
      <div className="bg-card border border-border rounded-xl">
        <div className="flex items-center gap-2 p-5 border-b border-border">
          <Award className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground">Top Winning Arguments by Payer</h2>
        </div>
        <div className="divide-y divide-border">
          {(intel as any[]).filter((r: any) => r.topWinningArgument && r.approvedOutcomes > 0).slice(0, 10).map((row: any, i: number) => (
            <div key={i} className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">{row.payerId}</span>
                <span className="text-xs text-muted-foreground">{row.drugId}</span>
                <span className="ml-auto text-xs font-medium text-green-600">{row.approvedOutcomes} wins</span>
              </div>
              <p className="text-sm text-foreground">{row.topWinningArgument}</p>
            </div>
          ))}
          {(intel as any[]).filter((r: any) => r.topWinningArgument && r.approvedOutcomes > 0).length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No winning arguments recorded yet. Record appeal outcomes to build this database.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
