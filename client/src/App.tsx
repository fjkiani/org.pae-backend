import { Switch, Route, Link, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "./components/ThemeProvider";
import Dashboard from "./pages/Dashboard";
import DenialsPage from "./pages/Denials";
import AppealsPage from "./pages/Appeals";
import GroundTruthPage from "./pages/GroundTruth";
import NewDenialPage from "./pages/NewDenial";
import FaxLogPage from "./pages/FaxLog";
import AgentConsole from "./pages/AgentConsole";
import { PerplexityAttribution } from "./components/PerplexityAttribution";

import {
  LayoutDashboard, FileX, FileText, Database, Send, Plus, Shield, Terminal
} from "lucide-react";

function Sidebar() {
  const [location] = useLocation();

  const nav = [
    { href: "/", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/denials", icon: FileX, label: "Denials" },
    { href: "/appeals", icon: FileText, label: "Appeals" },
    { href: "/ground-truth", icon: Database, label: "Ground Truth" },
    { href: "/fax-log", icon: Send, label: "Fax Log" },
    { href: "/agents", icon: Terminal, label: "Agent Console" },
  ];

  return (
    <aside className="w-64 min-h-screen bg-card border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground leading-tight">PAE-Onc</div>
            <div className="text-xs text-muted-foreground leading-tight">Appeal Engine</div>
          </div>
        </div>
      </div>

      {/* New Denial CTA */}
      <div className="p-4 border-b border-border">
        <Link href="/denials/new">
          <button
            data-testid="button-new-denial"
            className="w-full flex items-center justify-center gap-2 bg-primary text-white text-sm font-medium py-2.5 px-4 rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Denial
          </button>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        {nav.map(({ href, icon: Icon, label }) => {
          const active = location === href;
          return (
            <Link key={href} href={href}>
              <div
                data-testid={`nav-${label.toLowerCase().replace(" ", "-")}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Cancer types legend */}
      <div className="p-4 border-t border-border">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Coverage — 25 Cancer Types</div>
        <div className="flex flex-wrap gap-1">
          {[
            "breast","lung","colon","ovarian","brain",
            "prostate","bladder","pancreatic","liver","melanoma",
            "leukemia","lymphoma","myeloma","renal","thyroid",
            "cervical","endometrial","gastric","sarcoma","mesothelioma",
            "esophageal","head_neck","bile_duct","neuroendocrine","myelodysplastic"
          ].map((ct) => (
            <span key={ct} className="inline-flex px-1.5 py-0.5 rounded text-xs bg-primary/10 text-primary/80 border border-primary/10">
              {ct.replace("_"," ")}
            </span>
          ))}
        </div>
      </div>

      <PerplexityAttribution />
    </aside>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <Router hook={useHashLocation}>
          <Layout>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/denials" component={DenialsPage} />
              <Route path="/denials/new" component={NewDenialPage} />
              <Route path="/appeals" component={AppealsPage} />
              <Route path="/ground-truth" component={GroundTruthPage} />
              <Route path="/fax-log" component={FaxLogPage} />
              <Route path="/agents" component={AgentConsole} />
            </Switch>
          </Layout>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

// Router re-export (wouter's Router isn't default-exported here)
import { Router } from "wouter";
