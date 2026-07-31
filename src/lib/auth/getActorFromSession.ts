import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { Actor } from "@/lib/db/negocio";

export class NoAutenticadoError extends Error {}
export class SinRolAsignadoError extends Error {}

/**
 * The server-verified replacement for trusting a client-supplied
 * `{ autor, rol }` body: derives who's actually making the request from the
 * signed-in Auth.js session, so the "who did what" audit trail can't be
 * spoofed by editing a request body.
 */
export async function getActorFromSession(): Promise<Actor> {
  const session = await auth();
  if (!session?.user) {
    throw new NoAutenticadoError("No autenticado.");
  }
  if (!session.user.rol) {
    throw new SinRolAsignadoError("Esta cuenta no tiene un rol asignado todavía.");
  }
  return { autor: session.user.name ?? session.user.usuario, rol: session.user.rol };
}

/** Route-handler-friendly wrapper: an `error` response is ready to `return` as-is. */
export async function requireActor(): Promise<{ actor: Actor } | { error: NextResponse }> {
  try {
    return { actor: await getActorFromSession() };
  } catch (error) {
    if (error instanceof NoAutenticadoError) {
      return { error: NextResponse.json({ error: error.message }, { status: 401 }) };
    }
    if (error instanceof SinRolAsignadoError) {
      return { error: NextResponse.json({ error: error.message }, { status: 403 }) };
    }
    throw error;
  }
}
