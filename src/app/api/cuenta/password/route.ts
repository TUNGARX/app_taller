import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cambiarPassword, getUsuarioPorNombreUsuario, verificarPassword } from "@/lib/db/users";

// Lets the signed-in user set a new password themselves — used by the forced
// change-password screen (Owner-reset temp password, or a password older
// than 90 days). This is NOT a "forgot password" flow: it requires knowing
// the current password, same as any deliberate password change. A true
// forgot-password case is handled by the Owner resetting it from /staff.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.usuario) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  let body: { passwordActual?: string; nuevaPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido." }, { status: 400 });
  }

  if (!body.passwordActual || !body.nuevaPassword) {
    return NextResponse.json(
      { error: "La contraseña actual y la nueva son obligatorias." },
      { status: 400 }
    );
  }

  const user = getUsuarioPorNombreUsuario(session.user.usuario);
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

  if (!verificarPassword(user, body.passwordActual)) {
    return NextResponse.json({ error: "La contraseña actual es incorrecta." }, { status: 400 });
  }

  try {
    cambiarPassword(user.id, body.nuevaPassword);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al cambiar la contraseña.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
