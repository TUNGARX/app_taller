import { google } from "googleapis";

// Single service account, impersonating the taller's own Google Workspace
// account (contacto@fonsfideishop.com) via domain-wide delegation — this is
// what lets the app create Drive folders/files and Calendar events that show
// up directly in that account, without a per-user OAuth consent flow.
//
// Required env vars (see .env.production.example):
//   GOOGLE_SERVICE_ACCOUNT_JSON  — the full service-account key JSON, as a
//                                  single-line string (not a file path).
//   GOOGLE_IMPERSONATE_EMAIL     — the Workspace mailbox to act as, e.g.
//                                  contacto@fonsfideishop.com.
const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/calendar",
];

declare global {
  var __tallerGoogleAuth: import("googleapis").Auth.GoogleAuth | undefined;
}

function credencialesServiceAccount(): { client_email: string; private_key: string } {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON no está configurado — la integración con Google Drive/Calendar no está disponible."
    );
  }
  const parsed = JSON.parse(raw);
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON no contiene una clave de cuenta de servicio válida.");
  }
  return parsed;
}

function obtenerAuth(): import("googleapis").Auth.GoogleAuth {
  if (globalThis.__tallerGoogleAuth) return globalThis.__tallerGoogleAuth;

  const impersonar = process.env.GOOGLE_IMPERSONATE_EMAIL;
  if (!impersonar) {
    throw new Error("GOOGLE_IMPERSONATE_EMAIL no está configurado.");
  }
  const { client_email, private_key } = credencialesServiceAccount();

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email, private_key },
    scopes: SCOPES,
    clientOptions: { subject: impersonar },
  });

  globalThis.__tallerGoogleAuth = auth;
  return auth;
}

/** True once the required env vars are present — lets callers degrade
 *  gracefully (e.g. keep accepting photo uploads without Drive configured)
 *  instead of throwing on every request while the client hasn't set this up. */
export function googleConfigurado(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_IMPERSONATE_EMAIL);
}

export function getDriveClient() {
  return google.drive({ version: "v3", auth: obtenerAuth() });
}

export function getCalendarClient() {
  return google.calendar({ version: "v3", auth: obtenerAuth() });
}
