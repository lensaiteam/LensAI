import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { signSession, verifySession, SESSION_MAX_AGE_SEC } from "./jwt";
import type { AuthUser } from "../types";

export const SESSION_COOKIE = "lensai_session";

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_SEC,
};

/** Attach the session cookie to a response after successful SIWE verify. */
export async function setSessionCookie(res: NextResponse, user: AuthUser): Promise<void> {
  const token = await signSession(user);
  res.cookies.set(SESSION_COOKIE, token, cookieOpts);
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", { ...cookieOpts, maxAge: 0 });
}

/** Resolve the authenticated wallet from the request cookie, or null. */
export async function getSessionUser(): Promise<AuthUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

/**
 * Guard for protected route handlers. Returns the user or a 401 response.
 * Usage: `const auth = await requireUser(); if (auth instanceof NextResponse) return auth;`
 */
export async function requireUser(): Promise<AuthUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return user;
}
