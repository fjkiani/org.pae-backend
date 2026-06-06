import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Users, Search, Plus, ChevronRight, Activity, Dna } from "lucide-react";

const CANCER_TYPES = [
  "all","breast","lung","colon","ovarian","brain","prostate","bladder",
  "pancreatic","liver","gastric","leukemia","lymphoma","myeloma","melanoma","renal",
];

function BiomarkerBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
      <Dna className="w-3 h-3" />
      {label}
    </span>
  );
}

export default function Patients() {
  const [search, setSearch] = useState("");
  const [cancerFilter, setCancerFilter] = useState("all");

  const { data: patients = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/patients"],
  });

  const { data: denials = [] } = useQuery<any[]>({
    queryKey: ["/api/denials"],
  });

  const denialCountByPatient = (denials as any[]).reduce((acc: Record<string, number>, d: any) => {
    acc[d.patientId] = (acc[d.patientId] || 0) + 1;
    return acc;
  }, {});

  const filtered = (patients as any[]).filter((p: any) => {
    const matchSearch = !search ||
      p.patientId?.toLowerCase().includes(search.toLowerCase()) ||
      p.cancerType?.toLowerCase().includes(search.toLowerCase()) ||
      p.stage?.toLowerCase().includes(search.toLowerCase());
    const matchCancer = cancerFilter === "all" || p.cancerType === cancerFilter;
    return matchSearch && matchCancer;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Patients</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{(patients as any[]).length} patients in your organization</p>
        </div>
        <Link href="/patients/new">
          <button className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> New Patient
          </button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search patients..."
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
        <select
          value={cancerFilter}
          onChange={e => setCancerFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        >
          {CANCER_TYPES.map(ct => (
            <option key={ct} value={ct}>{ct === "all" ? "All Cancer Types" : ct.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}</option>
          ))}
        </select>
      </div>

      {/* Patient grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-medium">No patients found</p>
          <p className="text-muted-foreground text-sm mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((patient: any) => {
            const biomarkers = (() => { try { return Object.entries(JSON.parse(patient.biomarkers || "{}")); } catch { return []; } })();
            const denialCount = denialCountByPatient[patient.patientId] || 0;
            return (
              <Link key={patient.patientId} href={`/patients/${patient.patientId}`}>
                <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer group">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Activity className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-semibold text-foreground text-sm">{patient.patientId}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>

                  <div className="mb-3">
                    <p className="text-sm font-medium text-foreground capitalize">
                      {patient.cancerType?.replace("_", " ")} Cancer
                    </p>
                    <p className="text-xs text-muted-foreground">{patient.stage}</p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {biomarkers.slice(0, 3).map(([k, v]: any) => (
                      <BiomarkerBadge key={k} label={`${k}: ${v}`} />
                    ))}
                    {biomarkers.length > 3 && (
                      <span className="text-xs text-muted-foreground">+{biomarkers.length - 3} more</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <span className="text-xs text-muted-foreground">{patient.clinicName}</span>
                    {denialCount > 0 && (
                      <span className="text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full">
                        {denialCount} denial{denialCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
