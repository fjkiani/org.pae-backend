import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  title: string;
  role: "admin" | "provider" | "viewer";
  orgId: string;
  orgName: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
}

export interface RegisterData {
  email: string;
  password: string;
  fullName: string;
  title: string;
  orgName: string;
  npi: string;
  state: string;
}

// Demo accounts — swap AuthContext internals for Supabase/Auth0 in production
const DEMO_ACCOUNTS: Record<string, { password: string; user: AuthUser }> = {
  "dr.smith@mdanderson.org": {
    password: "demo",
    user: {
      id: "user0000-demo-0000-0000-000000000000",
      email: "dr.smith@mdanderson.org",
      fullName: "Dr. James Smith",
      title: "MD, Oncology",
      role: "provider",
      orgId: "00000000-demo-0000-0000-000000000000",
      orgName: "MD Anderson Cancer Center",
    },
  },
  "admin@mdanderson.org": {
    password: "demo",
    user: {
      id: "user0001-demo-0000-0000-000000000000",
      email: "admin@mdanderson.org",
      fullName: "Admin User",
      title: "System Administrator",
      role: "admin",
      orgId: "00000000-demo-0000-0000-000000000000",
      orgName: "MD Anderson Cancer Center",
    },
  },
  "dr.chen@mskcc.org": {
    password: "demo",
    user: {
      id: "user0002-demo-0000-0000-000000000000",
      email: "dr.chen@mskcc.org",
      fullName: "Dr. Lisa Chen",
      title: "MD, Hematology/Oncology",
      role: "provider",
      orgId: "00000000-demo-0000-0000-000000000000",
      orgName: "Memorial Sloan Kettering",
    },
  },
};

const SESSION_KEY = "pae_onc_session";

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  login: async () => ({ success: false }),
  logout: () => {},
  register: async () => ({ success: false }),
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const account = DEMO_ACCOUNTS[email.toLowerCase().trim()];
    if (!account) return { success: false, error: "No account found with that email." };
    if (account.password !== password) return { success: false, error: "Incorrect password." };
    localStorage.setItem(SESSION_KEY, JSON.stringify(account.user));
    setUser(account.user);
    return { success: true };
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  const register = async (data: RegisterData): Promise<{ success: boolean; error?: string }> => {
    // In production: POST to /api/auth/register → create org + user in DB
    // For now: create a session with the provided data
    const newUser: AuthUser = {
      id: `user-${Date.now()}`,
      email: data.email,
      fullName: data.fullName,
      title: data.title,
      role: "provider",
      orgId: `org-${Date.now()}`,
      orgName: data.orgName,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(newUser));
    setUser(newUser);
    return { success: true };
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
