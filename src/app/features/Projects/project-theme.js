import { LP, P } from "../../../design-system/tokens";

export function projectTheme(isLight) {
  const theme = isLight ? LP : P;
  return {
    "--pw-bg": isLight ? LP.bg : P.bg3,
    "--pw-white": theme.surface,
    "--pw-ink": theme.txt,
    "--pw-muted": theme.txt2,
    "--pw-border": theme.borderH,
    "--pw-line": theme.border,
    "--pw-blue": isLight ? theme.accentDark : theme.blue,
    "--pw-atom-edge": isLight ? theme.accent : theme.accentSoft,
    "--pw-button": LP.accentDark,
    "--pw-on-button": LP.onAccent,
    "--pw-navy-depth": P.onAccent,
  };
}
