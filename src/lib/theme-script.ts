/**
 * Runs before paint (see the inline <script> in src/app/layout.tsx) so the
 * page never flashes the wrong theme on load. Kept as a plain string (not a
 * function serialized with .toString()) so minification can't rename the
 * identifiers it depends on — matches the standard Next.js dark-mode recipe.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("taller-theme");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
`;
