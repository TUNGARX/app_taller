import { NextResponse } from "next/server";
import { restablecerPasswordConCodigo } from "@/lib/db/users";

// Public (no session) — POST { usuario, codigo, nuevaPassword } to reset a
// password using a one-time recovery code (see the "Self-service password
// recovery" section of src/lib/db/users.ts). Never distinguishes "usuario
// not found" from "wrong/used code" in its response, so a failed attempt
// can't be used to probe which usernames exist.
export async function POST(request: Request) {
  let body: { usuario?: string; codigo?: string; nuevaPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido." }, { status: 400 });
  }

  if (!body.usuario || !body.codigo || !body.nuevaPassword) {
    return NextResponse.json(
      { error: "Usuario, código y nueva contraseña son obligatorios." },
      { status: 400 }
    );
  }

  try {
    const exito = restablecerPasswordConCodigo(body.usuario, body.codigo, body.nuevaPassword);
    if (!exito) {
      return NextResponse.json(
        { error: "Usuario o código de recuperación inválido." },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo restablecer la contraseña.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
