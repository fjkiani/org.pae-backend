import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { User, Building2, Bell, Key, Check } from "lucide-react";

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "org", label: "Organization", icon: Building2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "api", label: "API Keys", icon: Key },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted"}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

const inputCls = "w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

export default function Settings() {
  const { user } = useAuth();
  const [tab, setTab] = useState("profile");
  const [saved, setSaved] = useState(false);
  const [notifs, setNotifs] = useState({
    emailOnDenial: true,
    emailOnFax: true,
    emailOnPipeline: false,
    emailOnOutcome: true,
  });

  const { data: orgData } = useQuery<any>({ queryKey: ["/api/org/profile"] });
  const org = orgData?.org;

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Manage your account and organization preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Tab sidebar */}
        <div className="w-48 flex-shrink-0">
          <nav className="space-y-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  tab === id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        <div className="flex-1 bg-card border border-border rounded-xl p-6">
          {tab === "profile" && (
            <div className="space-y-4">
              <h2 className="font-semibold text-foreground mb-4">Profile Information</h2>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xl font-bold text-primary">
                    {user?.fullName?.split(" ").map(n => n[0]).join("").slice(0, 2) || "U"}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-foreground">{user?.fullName}</p>
                  <p className="text-sm text-muted-foreground">{user?.title}</p>
                  <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">{user?.role}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
                  <input defaultValue={user?.fullName || ""} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Title</label>
                  <input defaultValue={user?.title || ""} className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                  <input defaultValue={user?.email || ""} type="email" className={inputCls} />
                </div>
              </div>
            </div>
          )}

          {tab === "org" && (
            <div className="space-y-4">
              <h2 className="font-semibold text-foreground mb-4">Organization Settings</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1.5">Organization Name</label>
                  <input defaultValue={org?.name || ""} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">NPI Number</label>
                  <input defaultValue={org?.npi || ""} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Outbound Fax</label>
                  <input defaultValue={org?.outboundFax || ""} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Signing Physician</label>
                  <input defaultValue={org?.signingPhysician || ""} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Signing Title</label>
                  <input defaultValue={org?.signingTitle || ""} className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1.5">Address</label>
                  <input defaultValue={org?.address || ""} className={inputCls} />
                </div>
              </div>
            </div>
          )}

          {tab === "notifications" && (
            <div className="space-y-4">
              <h2 className="font-semibold text-foreground mb-4">Notification Preferences</h2>
              {[
                { key: "emailOnDenial", label: "New denial received", desc: "Get notified when a new denial is added to your queue" },
                { key: "emailOnFax", label: "Fax delivery confirmation", desc: "Get notified when an appeal fax is delivered" },
                { key: "emailOnPipeline", label: "Pipeline completion", desc: "Get notified when the A→B→C pipeline finishes" },
                { key: "emailOnOutcome", label: "Outcome recorded", desc: "Get notified when an appeal outcome is recorded" },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Toggle
                    checked={notifs[key as keyof typeof notifs]}
                    onChange={v => setNotifs(n => ({ ...n, [key]: v }))}
                  />
                </div>
              ))}
            </div>
          )}

          {tab === "api" && (
            <div className="space-y-4">
              <h2 className="font-semibold text-foreground mb-4">API Keys & Integrations</h2>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Cohere API Key</label>
                <input type="password" defaultValue="lfWaRwjaOdTuZEOlP2uLFyFMTWcDfM0EtLLQZl7Q" className={inputCls} />
                <p className="text-xs text-muted-foreground mt-1">Used for appeal generation and NCCN extraction.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">FHIR Webhook URL</label>
                <input placeholder="https://your-ehr.com/fhir/claim-response" className={inputCls} />
                <p className="text-xs text-muted-foreground mt-1">Receive FHIR R4 ClaimResponse webhooks to auto-create denials.</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-4">
                <p className="text-sm font-medium text-foreground mb-1">SMART on FHIR</p>
                <p className="text-xs text-muted-foreground mb-2">Epic App Orchard registration required for production EHR integration.</p>
                <a href="/api/fhir/launch" target="_blank" className="text-xs text-primary hover:underline">Test SMART launch stub →</a>
              </div>
            </div>
          )}

          <div className="flex justify-end mt-6 pt-4 border-t border-border">
            <button onClick={handleSave}
              className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              {saved ? <><Check className="w-4 h-4" /> Saved!</> : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
