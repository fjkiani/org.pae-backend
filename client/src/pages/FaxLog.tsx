import { useQuery } from "@tanstack/react-query";
import { Send, CheckCircle, Clock, XCircle } from "lucide-react";

export default function FaxLogPage() {
  const { data: logs = [] } = useQuery<any[]>({ queryKey: ["/api/fax-log"] });

  const total = logs.length;
  const delivered = logs.filter((l: any) => l.status === "delivered").length;
  const pending = logs.filter((l: any) => l.status === "queued" || l.status === "sending").length;
  const failed = logs.filter((l: any) => l.status === "failed").length;
  const totalCost = logs.reduce((sum: number, l: any) => sum + (l.costCents || 0), 0);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Send className="w-5 h-5 text-primary" />
          Fax Delivery Log
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Track all appeal packet deliveries to payer Medical Director queues</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Sent", value: total, icon: Send, color: "text-primary" },
          { label: "Delivered", value: delivered, icon: CheckCircle, color: "text-green-500" },
          { label: "Pending", value: pending, icon: Clock, color: "text-amber-500" },
          { label: "Total Cost", value: `$${(totalCost / 100).toFixed(2)}`, icon: XCircle, color: "text-muted-foreground" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-5 flex items-center gap-3">
            <Icon className={`w-8 h-8 ${color} opacity-80`} />
            <div>
              <div className="text-xl font-bold text-foreground">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Delivery Records</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/60 border-b border-border">
                {["Appeal ID", "Payer", "Fax Number", "Job ID", "Status", "Pages", "Cost", "Sent At", "Delivered At"].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log: any) => (
                <tr key={log.id} className="hover:bg-muted/40" data-testid={`row-fax-${log.id}`}>
                  <td className="px-4 py-3 font-medium text-foreground">{log.appealId}</td>
                  <td className="px-4 py-3 text-foreground">{log.payerId}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{log.faxNumber}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground text-xs">{log.jobId}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      log.status === "delivered" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" :
                      log.status === "queued" || log.status === "sending" ? "bg-amber-100 text-amber-800" :
                      "bg-red-100 text-red-800"
                    }`}>{log.status}</span>
                  </td>
                  <td className="px-4 py-3 text-foreground">{log.pageCount}</td>
                  <td className="px-4 py-3 text-muted-foreground">${((log.costCents || 0) / 100).toFixed(2)}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {log.sentAt ? new Date(log.sentAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {log.deliveredAt ? new Date(log.deliveredAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">No fax records yet.</div>
          )}
        </div>
      </div>

      {/* Payer fax directory */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Medical Director Fax Directory</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { payer: "UHC", name: "UnitedHealthcare", fax: "+1-866-252-0566" },
            { payer: "Cigna", name: "Cigna Health", fax: "+1-800-337-0255" },
            { payer: "Aetna", name: "Aetna", fax: "+1-860-754-3604" },
            { payer: "Humana", name: "Humana", fax: "+1-800-457-4708" },
          ].map(({ payer, name, fax }) => (
            <div key={payer} className="border border-border rounded-lg p-3">
              <div className="text-sm font-semibold text-foreground mb-1">{payer}</div>
              <div className="text-xs text-muted-foreground mb-1">{name}</div>
              <div className="text-xs font-mono text-primary">{fax}</div>
              <div className="text-xs text-muted-foreground mt-1">Medical Director Appeals</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
