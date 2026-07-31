import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import {
  getUsuarioPorNombreUsuario,
  verificarPassword,
  passwordExpirada,
} from "@/lib/db/users";
import { authConfig } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        usuario: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      authorize: async (credentials) => {
        const usuario = credentials?.usuario;
        const password = credentials?.password;
        if (typeof usuario !== "string" || typeof password !== "string") {
          return null;
        }

        const user = getUsuarioPorNombreUsuario(usuario);
        if (!user || !verificarPassword(user, password)) return null;

        return {
          id: String(user.id),
          name: user.nombre,
          usuario: user.usuario,
          rol: user.rol,
          // Either an Owner-forced reset or a password older than 90 days
          // trips the same "you must change your password" flow.
          debeCambiarPassword: Boolean(user.debeCambiarPassword) || passwordExpirada(user),
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.usuario = user.usuario;
        token.rol = user.rol;
        token.debeCambiarPassword = user.debeCambiarPassword;
      }
      return token;
    },
    session({ session, token }) {
      session.user.usuario = token.usuario;
      session.user.rol = token.rol;
      session.user.debeCambiarPassword = token.debeCambiarPassword;
      return session;
    },
  },
});
