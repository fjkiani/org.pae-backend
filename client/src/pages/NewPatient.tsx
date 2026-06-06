import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const CANCER_TYPES = ["breast","lung_nsclc","colon","ovarian","glioblastoma","prostate","bladder","pancreatic","liver","gastric","esophageal","cervical","endometrial","thyroid","melanoma","renal","head_neck","leukemia_aml","lymphoma","myeloma","sarcoma","mesothelioma","bile_duct","neuroendocrine","myelodysplastic"];
const STAGES = ["Stage I","Stage II","Stage III","Stage IV","Stage IVA","Stage IVB","Relapsed/Refractory","Grade 2","Grade 3","Grade 4 GBM","mCRPC","mHSPC"];
const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
const ECOG = ["ECOG 0","ECOG 1","ECOG 2","ECOG 3","ECOG 4"];

interface Biomarker { key: string; value: string; }
interface PriorTherapy { drug: string; start: string; end: string; response: string; }

export default function NewPatient() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [patientId, setPatientId] = useState(`PT-${new Date().getFullYear()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`);
  const [cancerType, setCancerType] = useState("breast");
  const [stage, setStage] = useState("Stage IV");
  const [state, setState] = useState("TX");
  const [clinicName, setClinicName] = useState("");
  const [performanceStatus, setPerformanceStatus] = useState("ECOG 1");
  const [biomarkers, setBiomarkers] = useState<Biomarker[]>([{ key: "", value: "" }]);
  const [priorTherapies, setPriorTherapies] = useState<PriorTherapy[]>([]);

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/patients", data),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/patients"] });
      setLocation(`/patients/${data.patientId}`);
    },
  });

  const handleSubmit = () => {
    const biomarkerObj = biomarkers.reduce((acc, b) => {
      if (b.key.trim()) acc[b.key.trim()] = b.value.trim();
      return acc;
    }, {} as Record<string, string>);
    mutation.mutate({
      patientId, cancerType, stage, state, clinicName, performanceStatus,
      biomarkers: JSON.stringify(biomarkerObj),
      priorTherapies: JSON.stringify(priorTherapies.filter(t => t.drug.trim())),
    });
  };

  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={() => setLocation("/patients")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Patients
      </button>

      <h1 className="text-2xl font-bold text-foreground mb-1">New Patient</h1>
      <p className="text-muted-foreground text-sm mb-6">Add a patient to your organization's registry.</p>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {["Patient Info", "Biomarkers", "Prior Therapies"].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
              i + 1 < step ? "bg-primary text-white" : i + 1 === step ? "bg-primary text-white" : "bg-muted text-muted-foreground"
            }`}>
              {i + 1 < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span className={`text-sm ${i + 1 === step ? "text-foreground font-medium" : "text-muted-foreground"}`}>{label}</span>
            {i < 2 && <div className="w-6 h-px bg-border mx-1" />}
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Patient ID</label>
                <input value={patientId} onChange={e => setPatientId(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">State</label>
                <select value={state} onChange={e => setState(e.target.value)} className={inputCls}>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Cancer Type</label>
                <select value={cancerType} onChange={e => setCancerType(e.target.value)} className={inputCls}>
                  {CANCER_TYPES.map(ct => <option key={ct} value={ct}>{ct.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Stage</label>
                <select value={stage} onChange={e => setStage(e.target.value)} className={inputCls}>
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Clinic / Hospital</label>
                <input value={clinicName} onChange={e => setClinicName(e.target.value)} placeholder="MD Anderson Cancer Center" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Performance Status</label>
                <select value={performanceStatus} onChange={e => setPerformanceStatus(e.target.value)} className={inputCls}>
                  {ECOG.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">Add biomarker results (e.g. HER2: low, EGFR: L858R, PDL1: 40%)</p>
            {biomarkers.map((b, i) => (
              <div key={i} className="flex gap-2">
                <input value={b.key} onChange={e => setBiomarkers(bm => bm.map((x, j) => j === i ? { ...x, key: e.target.value } : x))}
                  placeholder="Biomarker (e.g. HER2)" className={`${inputCls} flex-1`} />
                <input value={b.value} onChange={e => setBiomarkers(bm => bm.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                  placeholder="Value (e.g. low)" className={`${inputCls} flex-1`} />
                <button onClick={() => setBiomarkers(bm => bm.filter((_, j) => j !== i))}
                  className="p-2.5 rounded-lg border border-border hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button onClick={() => setBiomarkers(bm => [...bm, { key: "", value: "" }])}
              className="flex items-center gap-1.5 text-sm text-primary hover:underline">
              <Plus className="w-4 h-4" /> Add biomarker
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">Document prior therapy history for step therapy appeals.</p>
            {priorTherapies.map((t, i) => (
              <div key={i} className="grid grid-cols-4 gap-2">
                <input value={t.drug} onChange={e => setPriorTherapies(pt => pt.map((x, j) => j === i ? { ...x, drug: e.target.value } : x))}
                  placeholder="Drug name" className={inputCls} />
                <input type="date" value={t.start} onChange={e => setPriorTherapies(pt => pt.map((x, j) => j === i ? { ...x, start: e.target.value } : x))}
                  className={inputCls} />
                <input type="date" value={t.end} onChange={e => setPriorTherapies(pt => pt.map((x, j) => j === i ? { ...x, end: e.target.value } : x))}
                  className={inputCls} />
                <div className="flex gap-2">
                  <select value={t.response} onChange={e => setPriorTherapies(pt => pt.map((x, j) => j === i ? { ...x, response: e.target.value } : x))}
                    className={`${inputCls} flex-1`}>
                    {["progression","partial response","complete response","intolerance","completion"].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button onClick={() => setPriorTherapies(pt => pt.filter((_, j) => j !== i))}
                    className="p-2.5 rounded-lg border border-border hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            <button onClick={() => setPriorTherapies(pt => [...pt, { drug: "", start: "", end: "", response: "progression" }])}
              className="flex items-center gap-1.5 text-sm text-primary hover:underline">
              <Plus className="w-4 h-4" /> Add prior therapy
            </button>
          </div>
        )}

        <div className="flex justify-between mt-6 pt-4 border-t border-border">
          <button onClick={() => step > 1 ? setStep(s => s - 1) : setLocation("/patients")}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-border text-foreground text-sm hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" /> {step === 1 ? "Cancel" : "Back"}
          </button>
          {step < 3 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!patientId || !cancerType}
              className="flex items-center gap-1.5 bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={mutation.isPending}
              className="bg-primary text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {mutation.isPending ? "Creating..." : "Create Patient"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
