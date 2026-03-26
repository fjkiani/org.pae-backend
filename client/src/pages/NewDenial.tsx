import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, Save, User, FileText } from "lucide-react";

type Step = "patient" | "denial";

export default function NewDenialPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("patient");
  const [patientId, setPatientId] = useState<string | null>(null);

  // Patient form
  const patientForm = useForm({
    defaultValues: {
      patientId: `PT-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      cancerType: "",
      stage: "",
      biomarkers: "",
      priorTherapies: "",
      performanceStatus: "",
      clinicName: "",
      state: "NY",
    },
  });

  const createPatient = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/patients", {
      ...data,
      biomarkers: data.biomarkers || "{}",
      priorTherapies: data.priorTherapies || "[]",
    }),
    onSuccess: (patient: any) => {
      setPatientId(patient.patientId);
      setStep("denial");
      toast({ title: "Patient Created", description: `Patient ${patient.patientId} saved.` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Denial form
  const denialForm = useForm({
    defaultValues: {
      payerId: "",
      payerName: "",
      drugNameRaw: "",
      drugId: "",
      icd10Codes: "",
      denialReasonCode: "",
      denialReasonText: "",
      denialDate: new Date().toISOString().split("T")[0],
      referenceNumber: "",
      memberId: "",
    },
  });

  const { data: drugs = [] } = useQuery<any[]>({ queryKey: ["/api/drugs"] });

  const createDenial = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/denials", { ...data, patientId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/denials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Denial Created", description: "Denial record created. Run the pipeline to generate an appeal." });
      navigate("/denials");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const PAYER_NAMES: Record<string, string> = {
    UHC: "UnitedHealthcare",
    Cigna: "Cigna Health",
    Aetna: "Aetna",
    Humana: "Humana",
  };

  return (
    <div className="p-8 max-w-2xl">
      <button onClick={() => navigate("/denials")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Denials
      </button>

      <h1 className="text-xl font-bold text-foreground mb-2">New Denial Record</h1>
      <p className="text-sm text-muted-foreground mb-6">Enter patient profile then denial details to begin the appeal pipeline.</p>

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-8">
        {[{ id: "patient", label: "Patient Profile", icon: User }, { id: "denial", label: "Denial Details", icon: FileText }].map(({ id, label, icon: Icon }, i) => (
          <div key={id} className="flex items-center gap-2">
            {i > 0 && <div className={`w-8 h-px ${step === "denial" ? "bg-primary" : "bg-border"}`} />}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${step === id ? "bg-primary text-white" : step === "denial" && id === "patient" ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}`}>
              <Icon className="w-3 h-3" />
              {label}
            </div>
          </div>
        ))}
      </div>

      {step === "patient" && (
        <Form {...patientForm}>
          <form onSubmit={patientForm.handleSubmit(d => createPatient.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={patientForm.control} name="patientId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Patient ID</FormLabel>
                  <FormControl><Input data-testid="input-patient-id" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={patientForm.control} name="state" render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger data-testid="select-state"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["NY", "NJ", "CA", "TX", "FL", "PA", "IL", "MA"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={patientForm.control} name="cancerType" rules={{ required: "Required" }} render={({ field }) => (
                <FormItem>
                  <FormLabel>Cancer Type *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger data-testid="select-cancer-type"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {["breast", "ovarian", "brain", "colon", "lung"].map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={patientForm.control} name="stage" rules={{ required: "Required" }} render={({ field }) => (
                <FormItem>
                  <FormLabel>Stage *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger data-testid="select-stage"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {["Stage I", "Stage II", "Stage III", "Stage IV", "Grade 2", "Grade 3", "Grade 4 GBM"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={patientForm.control} name="biomarkers" render={({ field }) => (
              <FormItem>
                <FormLabel>Biomarkers (JSON or description)</FormLabel>
                <FormControl><Input data-testid="input-biomarkers" placeholder='{"HER2": "low", "HR": "positive"}' {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={patientForm.control} name="priorTherapies" render={({ field }) => (
              <FormItem>
                <FormLabel>Prior Therapies</FormLabel>
                <FormControl><Textarea data-testid="input-prior-therapies" placeholder="e.g. anastrozole (2024-01 to 2024-08, progression)" {...field} className="h-20" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={patientForm.control} name="performanceStatus" render={({ field }) => (
                <FormItem>
                  <FormLabel>ECOG Performance Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger data-testid="select-ecog"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {["ECOG 0", "ECOG 1", "ECOG 2", "ECOG 3"].map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={patientForm.control} name="clinicName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Clinic Name</FormLabel>
                  <FormControl><Input data-testid="input-clinic" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <button
              type="submit"
              data-testid="button-save-patient"
              disabled={createPatient.isPending}
              className="w-full flex items-center justify-center gap-2 bg-primary text-white text-sm font-medium py-2.5 px-4 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {createPatient.isPending ? "Saving..." : "Save Patient & Continue"}
            </button>
          </form>
        </Form>
      )}

      {step === "denial" && (
        <Form {...denialForm}>
          <form onSubmit={denialForm.handleSubmit(d => createDenial.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={denialForm.control} name="payerId" rules={{ required: "Required" }} render={({ field }) => (
                <FormItem>
                  <FormLabel>Payer *</FormLabel>
                  <Select value={field.value} onValueChange={(v) => { field.onChange(v); denialForm.setValue("payerName", PAYER_NAMES[v] || v); }}>
                    <SelectTrigger data-testid="select-payer"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {["UHC", "Cigna", "Aetna", "Humana"].map(p => <SelectItem key={p} value={p}>{PAYER_NAMES[p]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={denialForm.control} name="denialDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Denial Date</FormLabel>
                  <FormControl><Input type="date" data-testid="input-denial-date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={denialForm.control} name="drugId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Drug (from database)</FormLabel>
                  <Select value={field.value} onValueChange={(v) => { field.onChange(v); const d = drugs.find((x: any) => x.id === v); if (d) denialForm.setValue("drugNameRaw", `${d.brandName} (${d.genericName})`); }}>
                    <SelectTrigger data-testid="select-drug"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {drugs.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.brandName} ({d.cancerType})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={denialForm.control} name="drugNameRaw" rules={{ required: "Required" }} render={({ field }) => (
                <FormItem>
                  <FormLabel>Drug Name (as written) *</FormLabel>
                  <FormControl><Input data-testid="input-drug-name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={denialForm.control} name="denialReasonCode" rules={{ required: "Required" }} render={({ field }) => (
                <FormItem>
                  <FormLabel>Denial Reason Code *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger data-testid="select-reason-code"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="step_therapy">Step Therapy Not Met</SelectItem>
                      <SelectItem value="experimental">Experimental / Investigational</SelectItem>
                      <SelectItem value="not_medically_necessary">Not Medically Necessary</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={denialForm.control} name="referenceNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>PA Reference Number</FormLabel>
                  <FormControl><Input data-testid="input-reference" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={denialForm.control} name="icd10Codes" render={({ field }) => (
              <FormItem>
                <FormLabel>ICD-10 Codes</FormLabel>
                <FormControl><Input data-testid="input-icd10" placeholder="e.g. C50.912, Z17.0" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={denialForm.control} name="denialReasonText" rules={{ required: "Required" }} render={({ field }) => (
              <FormItem>
                <FormLabel>Full Denial Reason Text *</FormLabel>
                <FormControl><Textarea data-testid="input-denial-text" placeholder="Paste the full denial reason paragraph from the denial notice..." {...field} className="h-28" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep("patient")} className="flex-1 text-sm border border-border text-foreground py-2.5 px-4 rounded-lg hover:bg-muted transition-colors">
                Back
              </button>
              <button
                type="submit"
                data-testid="button-save-denial"
                disabled={createDenial.isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-white text-sm font-medium py-2.5 px-4 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {createDenial.isPending ? "Saving..." : "Create Denial Record"}
              </button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}
