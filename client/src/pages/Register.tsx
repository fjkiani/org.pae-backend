import { useState } from "react";
import { useLocation } from "wouter";
import { Shield, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useAuth, RegisterData } from "@/contexts/AuthContext";

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

export default function Register() {
  const { register } = useAuth();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<RegisterData>({
    email: "", password: "", fullName: "", title: "", orgName: "", npi: "", state: "TX",
  });

  const update = (k: keyof RegisterData, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    const result = await register(form);
    setLoading(false);
    if (result.success) setLocation("/");
    else setError(result.error || "Registration failed.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <Shield className="w-6 h-6 text-primary" />
          <span className="font-bold text-lg">PAE-Onc</span>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                s < step ? "bg-primary text-white" : s === step ? "bg-primary text-white" : "bg-muted text-muted-foreground"
              }`}>
                {s < step ? <Check className="w-4 h-4" /> : s}
              </div>
              <span className={`text-sm ${s === step ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {s === 1 ? "Your account" : "Organization"}
              </span>
              {s < 2 && <div className="w-8 h-px bg-border mx-1" />}
            </div>
          ))}
        </div>

        <h2 className="text-2xl font-bold text-foreground mb-1">
          {step === 1 ? "Create your account" : "Your organization"}
        </h2>
        <p className="text-muted-foreground mb-6">
          {step === 1 ? "Enter your credentials to get started." : "Tell us about your clinic or hospital."}
        </p>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
              <input value={form.fullName} onChange={e => update("fullName", e.target.value)}
                placeholder="Dr. Jane Smith" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Title</label>
              <input value={form.title} onChange={e => update("title", e.target.value)}
                placeholder="MD, Oncology" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Work Email</label>
              <input type="email" value={form.email} onChange={e => update("email", e.target.value)}
                placeholder="you@hospital.org" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
              <input type="password" value={form.password} onChange={e => update("password", e.target.value)}
                placeholder="Min 8 characters" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <button onClick={() => setStep(2)} disabled={!form.fullName || !form.email || !form.password}
              className="w-full flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Organization Name</label>
              <input value={form.orgName} onChange={e => update("orgName", e.target.value)}
                placeholder="MD Anderson Cancer Center" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">NPI Number</label>
              <input value={form.npi} onChange={e => update("npi", e.target.value)}
                placeholder="1234567890" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">State</label>
              <select value={form.state} onChange={e => update("state", e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setStep(1)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-foreground text-sm hover:bg-muted transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={handleSubmit} disabled={loading || !form.orgName}
                className="flex-1 bg-primary text-white py-2.5 rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
                {loading ? "Creating account..." : "Create Account"}
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <a href="#/login" className="text-primary hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  );
}
