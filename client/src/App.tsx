import { Switch, Route, Link, useLocation, Redirect } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider, useTheme } from "./components/ThemeProvider";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

// Pages
import Dashboard from "./pages/Dashboard";
import DenialsPage from "./pages/Denials";
import AppealsPage from "./pages/Appeals";
import GroundTruthPage from "./pages/GroundTruth";
import NewDenialPage from "./pages/NewDenial";
import FaxLogPage from "./pages/FaxLog";
import AgentConsole from "./pages/AgentConsole";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import Patients from "./pages/Patients";
import NewPatient from "./pages/NewPatient";
import PatientDetail from "./pages/PatientDetail";
import DenialDetail from "./pages/DenialDetail";
import AppealDetail from "./pages/AppealDetail";
import PayerIntelligence from "./pages/PayerIntelligence";
import Compliance from "./pages/Compliance";
import Settings from "./pages/Settings";
import ETLAdmin from "./pages/ETLAdmin";
import NotFound from "./pages/not-found";

import {
  LayoutDashboard, FileX, FileText, Database, Send, Plus, Shield, Terminal,
  Users, BarChart3, ShieldCheck, Settings as SettingsIcon, Moon, Sun, LogOut, Cpu
} from "lucide-react";

// ─── PROTECTED ROUTE ──────────────────────────────────────────────────────────
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <Component />;
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  const navItems = [
    { href: "/", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/patients", icon: Users, label: "Patients" },
    { href: "/denials", icon: FileX, label: "Denials" },
    { href: "/appeals", icon: FileText, label: "Appeals" },
    { href: "/ground-truth", icon: Database, label: "Ground Truth" },
    { href: "/fax-log", icon: Send, label: "Fax Log" },
    { href: "/agents", icon: Terminal, label: "Agent Console" },
    { href: "/payer-intelligence", icon: BarChart3, label: "Payer Intel" },
    { href: "/compliance", icon: ShieldCheck, label: "Compliance" },
  ];

  const adminItems = [
    { href: "/etl", icon: Cpu, label: "ETL Admin" },
    { href: "/settings", icon: SettingsIcon, label: "Settings" },
  ];

  return (
    <aside className="w-64 min-h-screen bg-card border-r border-border flex flex-col transition-colors duration-150">
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
          <button className="w-full flex items-center justify-center gap-2 bg-primary text-white text-sm font-medium py-2.5 px-4 rounded-lg hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> New Denial
          </button>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href}>
            <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
              isActive(href)
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </div>
          </Link>
        ))}

        {user?.role === "admin" && (
          <>
            <div className="pt-3 pb-1 px-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Admin</p>
            </div>
            {adminItems.map(({ href, icon: Icon, label }) => (
              <Link key={href} href={href}>
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
                  isActive(href)
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {label}
                </div>
              </Link>
            ))}
          </>
        )}

        {/* Settings for non-admin */}
        {user?.role !== "admin" && (
          <Link href="/settings">
            <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
              isActive("/settings")
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}>
              <SettingsIcon className="w-4 h-4 flex-shrink-0" />
              Settings
            </div>
          </Link>
        )}
      </nav>

      {/* Theme toggle */}
      <div className="px-4 py-3 border-t border-border">
        <button onClick={toggle}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </div>

      {/* User menu */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-primary">
              {user?.fullName?.split(" ").map(n => n[0]).join("").slice(0, 2) || "U"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user?.fullName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.orgName}</p>
          </div>
          <button onClick={logout} title="Sign out"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

// ─── APP SHELL ────────────────────────────────────────────────────────────────
function AppShell() {
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();
  const publicRoutes = ["/login", "/register", "/forgot-password"];
  const isPublic = publicRoutes.includes(location);

  if (isPublic || !isAuthenticated) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route>{() => <Redirect to="/login" />}</Route>
      </Switch>
    );
  }

  return (
    <div className="flex min-h-screen bg-background transition-colors duration-150">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/patients" component={Patients} />
          <Route path="/patients/new" component={NewPatient} />
          <Route path="/patients/:id" component={PatientDetail} />
          <Route path="/denials" component={DenialsPage} />
          <Route path="/denials/new" component={NewDenialPage} />
          <Route path="/denials/:id" component={DenialDetail} />
          <Route path="/appeals" component={AppealsPage} />
          <Route path="/appeals/:id" component={AppealDetail} />
          <Route path="/ground-truth" component={GroundTruthPage} />
          <Route path="/fax-log" component={FaxLogPage} />
          <Route path="/agents" component={AgentConsole} />
          <Route path="/payer-intelligence" component={PayerIntelligence} />
          <Route path="/compliance" component={Compliance} />
          <Route path="/settings" component={Settings} />
          <Route path="/etl" component={ETLAdmin} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
import { Router } from "wouter";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Router hook={useHashLocation}>
            <AppShell />
          </Router>
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
