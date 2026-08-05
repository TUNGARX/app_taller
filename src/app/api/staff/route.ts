import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  contarCodigosDisponibles,
  crearUsuario,
  eliminarUsuario,
  generarCodigosRecuperacion,
  getUsuarioPublicoPorId,
  listarUsuarios,
  reiniciarPassword,
} from "@/lib/db/users";
import type { Rol } from "@/lib/types";

const ROLES_VALIDOS: Rol[] = ["Owner", "Secretary", "Mechanic"];

async function requerirOwner() {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "No autenticado." }, { status: 401 }) };
  }
  if (session.user.rol !== "Owner") {
    return { error: NextResponse.json({ error: "Solo el dueño puede administrar usuarios." }, { status: 403 }) };
  }
  return { session };
}

// Lets the Owner create new staff accounts in-app (no external dashboard) —
// this is how the shop adds future hires. Also used to list existing staff.
export async function GET() {
  const check = await requerirOwner();
  if (check.error) return check.error;

  const usuarios = listarUsuarios().map((u) => ({
    ...u,
    codigosDisponibles: contarCodigosDisponibles(u.id),
  }));
  return NextResponse.json(usuarios);
}

export async function POST(request: Request) {
  const check = await requerirOwner();
  if (check.error) return check.error;

  let body: { usuario?: string; password?: string; nombre?: string; rol?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido." }, { status: 400 });
  }

  if (!body.usuario || !body.password || !body.nombre || !body.rol) {
    return NextResponse.json(
      { error: "Usuario, contraseña, nombre y rol son obligatorios." },
      { status: 400 }
    );
  }
  if (!ROLES_VALIDOS.includes(body.rol as Rol)) {
    return NextResponse.json({ error: "Rol inválido." }, { status: 400 });
  }

  try {
    const usuario = crearUsuario({
      usuario: body.usuario,
      password: body.password,
      nombre: body.nombre,
      rol: body.rol as Rol,
      // A temp password set by the Owner must be changed by the new hire on
      // their first login, same as the 90-day expiry flow.
      debeCambiarPassword: true,
    });
    // Every new account starts with its own recovery-code batch, handed to
    // the Owner right away (this is the only time these codes are visible —
    // only their hashes are kept from here on).
    const codigosRecuperacion = generarCodigosRecuperacion(usuario.id);
    return NextResponse.json({ ...usuario, codigosRecuperacion }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al crear el usuario.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// Owner-triggered "forgot password" reset — sets a new temp password since
// there's no email-based reset flow (usernames, not emails, per design).
export async function PATCH(request: Request) {
  const check = await requerirOwner();
  if (check.error) return check.error;

  let body: { id?: number; passwordTemporal?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido." }, { status: 400 });
  }

  if (!body.id || !body.passwordTemporal) {
    return NextResponse.json(
      { error: "id y passwordTemporal son obligatorios." },
      { status: 400 }
    );
  }

  try {
    reiniciarPassword(body.id, body.passwordTemporal);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al reiniciar la contraseña.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// Removes a staff account — e.g. an employee who was let go or left. Past
// activity/notes attributed to them are untouched (those store the name as
// plain text, not a reference to this account), so history stays intact.
export async function DELETE(request: Request) {
  const check = await requerirOwner();
  if (check.error) return check.error;

  let body: { id?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido." }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "id es obligatorio." }, { status: 400 });
  }

  const objetivo = getUsuarioPublicoPorId(body.id);
  if (!objetivo) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }
  if (objetivo.usuario === check.session.user.usuario) {
    return NextResponse.json(
      { error: "No puede eliminar su propia cuenta mientras tiene sesión iniciada." },
      { status: 400 }
    );
  }

  try {
    eliminarUsuario(body.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al eliminar el usuario.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
