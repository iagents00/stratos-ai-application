import { P, LP } from "../../../design-system/tokens";

// Shared by the admin editor and seller workspace. Dark surfaces deliberately
// stay neutral and nearly black; the organization accent only marks actions.
const darkRails = {
  background: "#050505",
  surface: "#0A0A0A",
  text: "#EDEDED",
  muted: "#A0A0A0",
  border: "rgba(255,255,255,0.12)",
};
export function railsTheme(T = P) {
  const light = T.bg === LP.bg || !!T.accentDark;
  return {
    "--rails-text": light ? T.txt : darkRails.text,
    "--rails-muted": light ? T.txt2 : darkRails.muted,
    "--rails-accent": light ? T.accentDark || LP.accentDark : T.accent,
    "--rails-on-accent": light ? LP.surface : darkRails.background,
    "--rails-border": light ? T.borderH || T.border : darkRails.border,
    "--rails-bg": light ? T.bg : darkRails.background,
    "--rails-surface": light ? T.surface || T.bg : darkRails.surface,
    "--rails-danger": light
      ? `color-mix(in srgb, ${T.rose} 80%, ${T.txt})`
      : T.rose,
    "--rails-shadow": light
      ? "0 8px 28px rgb(15 23 42 / 0.07)"
      : "0 8px 28px rgb(0 0 0 / 0.2)",
    colorScheme: light ? "light" : "dark",
  };
}
