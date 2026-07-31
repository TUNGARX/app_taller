// One-off bootstrap: creates the very first Owner account. There is no public
// sign-up (invite-only), so this is how the first login gets created before
// the in-app /staff admin screen exists to make any more.
//
// Usage: npx tsx scripts/seed-owner.ts <usuario> <password> <nombre>
import { crearUsuario, getUsuarioPorNombreUsuario } from "../src/lib/db/users";

const [usuario, password, ...nombreParts] = process.argv.slice(2);
const nombre = nombreParts.join(" ");

if (!usuario || !password || !nombre) {
  console.error("Uso: npx tsx scripts/seed-owner.ts <usuario> <password> <nombre completo>");
  process.exit(1);
}

if (getUsuarioPorNombreUsuario(usuario)) {
  console.error(`Ya existe un usuario con el nombre de usuario "${usuario}".`);
  process.exit(1);
}

const creado = crearUsuario({ usuario, password, nombre, rol: "Owner" });
console.log(`Cuenta Owner creada: ${creado.usuario} (${creado.nombre}), id=${creado.id}`);
