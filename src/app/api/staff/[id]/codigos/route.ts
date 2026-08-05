import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { generarCodigosRecuperacion, getUsuarioPublicoPorId } from "@/lib/db/users";

// Owner-only: regenerates a user's recovery-code batch (invalidating any
// previous one) — e.g. because they were lost, or none were ever generated
// (accounts created before this feature existed). Returns the plaintext
// codes once; only their hashes are stored afterward.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (session.user.rol !== "Owner") {
    return NextResponse.json(
      { error: "Solo el dueño puede administrar usuarios." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId)) {
    return NextResponse.json({ error: "id inválido." }, { status: 400 });
  }

  const usuario = getUsuarioPublicoPorId(userId);
  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

  const codigosRecuperacion = generarCodigosRecuperacion(userId);
  return NextResponse.json({ codigosRecuperacion });
}
