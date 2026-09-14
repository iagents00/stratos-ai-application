import { P, LP } from "../../../design-system/tokens";

// Shared by the admin editor and seller workspace. Keep organization colors;
// use the darker brand variant for readable light-mode primary controls.
export function railsTheme(T = P) {
  const light = T.bg === LP.bg || !!T.accentDark;
  return {
    "--rails-text": T.txt,
    "--rails-muted": T.txt2,
    "--rails-accent": light ? T.accentDark || LP.accentDark : T.accent,
    "--rails-on-accent": light ? LP.surface : P.bg,
    "--rails-border": T.borderH || T.border,
    "--rails-bg": T.bg,
    "--rails-surface": T.surface || T.bg,
    "--rails-danger": light
      ? `color-mix(in srgb, ${T.rose} 80%, ${T.txt})`
      : T.rose,
    "--rails-shadow": light
      ? "0 8px 28px rgb(15 23 42 / 0.07)"
      : "0 8px 28px rgb(0 0 0 / 0.2)",
    colorScheme: light ? "light" : "dark",
  };
}
