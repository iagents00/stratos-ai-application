import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X, Bell, Search, UserRound, Sun, Moon, LogOut, PhoneCall, ChevronRight } from "lucide-react";
import "./MobileHeaderMenu.css";

export default function MobileHeaderMenu({ user, T, isLight, unread, pendingSync, onNotifications, onSearch, onProfile, onTheme, onLogout, supportPhoneHref, supportPhoneLabel }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);
  const panel = useRef(null);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const run = action => { close(); action(); };

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector("button")?.focus();
    const handleKey = event => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
      if (event.key === "Tab") {
        const items = panel.current?.querySelectorAll("button, a[href]");
        if (!items?.length) return;
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    const media = window.matchMedia("(min-width: 769px)");
    const onResize = () => setOpen(false);
    document.addEventListener("keydown", handleKey);
    media.addEventListener("change", onResize);
    return () => { document.removeEventListener("keydown", handleKey); media.removeEventListener("change", onResize); };
  }, [open]);

  const count = unread || pendingSync;
  const row = (Icon, label, action, detail) => (
    <button className="mobile-account-row" onClick={() => run(action)}>
      <Icon size={19} strokeWidth={1.8} /><span>{label}</span>
      {detail && <span className="mobile-account-detail">{detail}</span>}
      <ChevronRight size={15} className="mobile-account-chevron" />
    </button>
  );

  return <div className="stratos-mobile-account" style={{ "--account-accent": T.accent }}>
    <button ref={trigger} className="mobile-account-trigger" aria-label={count ? `Menú de cuenta, ${count} avisos pendientes` : "Menú de cuenta"} aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? "mobile-account-menu" : undefined} onClick={() => setOpen(o => !o)} style={{ color: T.txt, background: "transparent" }}>
      <Menu size={20} strokeWidth={1.5} />
      {count > 0 && <span className="mobile-account-dot" style={{ background: unread ? T.accent : "#F59E0B" }} />}
    </button>
    {open && createPortal(<div className="mobile-account-overlay" onClick={close}>
      <div ref={panel} id="mobile-account-menu" className="mobile-account-panel" role="dialog" aria-modal="true" aria-labelledby="mobile-account-title" onClick={e => e.stopPropagation()} style={{ "--account-accent": T.accent, color: T.txt, background: isLight ? "#FFFFFF" : "#090F18", colorScheme: isLight ? "light" : "dark" }}>
        <div className="mobile-account-heading">
          <div className="mobile-account-avatar" aria-hidden="true">{user?.name?.charAt(0).toUpperCase() || "U"}</div>
          <div className="mobile-account-identity"><strong id="mobile-account-title">{user?.name || "Mi cuenta"}</strong><span>{user?.isDemo ? "Demo" : "Mi cuenta"}</span></div>
          <button className="mobile-account-close" aria-label="Cerrar menú" onClick={close}><X size={19} /></button>
        </div>
        {row(Bell, "Notificaciones", onNotifications, count > 0 ? (count > 99 ? "99+" : count) : undefined)}
        {row(Search, "Buscar", onSearch)}
        {row(UserRound, "Mi perfil", onProfile)}
        {row(isLight ? Moon : Sun, isLight ? "Cambiar a modo oscuro" : "Cambiar a modo claro", onTheme)}
        {supportPhoneHref && <a className="mobile-account-row" href={supportPhoneHref} onClick={close}><PhoneCall size={19} strokeWidth={1.8} /><span>Soporte {supportPhoneLabel}</span><ChevronRight size={15} className="mobile-account-chevron" /></a>}
        <div className="mobile-account-separator" />
        <button className="mobile-account-row mobile-account-logout" onClick={() => run(onLogout)}><LogOut size={19} strokeWidth={1.8} /><span>Cerrar sesión</span></button>
      </div>
    </div>, document.body)}
  </div>;
}
