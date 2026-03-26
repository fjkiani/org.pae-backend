import { createClient } from "@supabase/supabase-js";
import type { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
}

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export interface AuthenticatedUser {
  id: string;
  organizationId: string;
  role: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Express middleware — validates Supabase JWT and attaches req.user with organizationId.
 * All tenant-scoped API routes must go through this.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }

  const token = authHeader.split("Bearer ")[1];
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // Look up the user's org membership in our users table
  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  });

  if (!profile) {
    return res.status(403).json({
      error: "User is not associated with any organization. Complete onboarding first.",
      code: "ONBOARDING_REQUIRED",
    });
  }

  req.user = {
    id: user.id,
    organizationId: profile.organizationId,
    role: profile.role,
    email: profile.email,
  };

  next();
}

/**
 * Admin-only middleware — must be called after requireAuth.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

/**
 * Create a new user profile in the users table after Supabase signup.
 * Called from the onboarding route.
 */
export async function createUserProfile(params: {
  id: string;
  organizationId: string;
  role: string;
  fullName?: string;
  title?: string;
  email: string;
}) {
  const now = new Date().toISOString();
  return db.insert(users).values({
    id: params.id,
    organizationId: params.organizationId,
    role: params.role,
    fullName: params.fullName,
    title: params.title,
    email: params.email,
    createdAt: now,
  }).returning();
}
