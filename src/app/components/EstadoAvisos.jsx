/**
 * EstadoAvisos — «¿por qué no me llegan las notificaciones?», contestado
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ EXISTE
 *
 * Todo el camino de los avisos falla en silencio. El 26-ago-2026 se comprobó que
 * la tabla de teléfonos registrados estaba VACÍA después de días de uso real en
 * un iPhone, y no había forma de saber en cuál de los cuatro pasos se caía:
 * ¿faltaba el permiso? ¿el sistema rechazó el registro? ¿se guardó y nadie
 * envía? Cada respuesta es un arreglo distinto, y sin distinguirlas solo se
 * puede adivinar — que es exactamente lo que costó seis versiones con el
 * micrófono.
 *
 * Esta tarjeta convierte esa pregunta en algo que el propio usuario puede mirar,
 * sin consola, sin cables y sin esperar a nadie.
 *
 * Solo aparece dentro de la app instalada. En el navegador no tiene sentido:
 * ahí los avisos van por otro camino, y funcionan.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, CheckCircle2, AlertCircle } from "lucide-react";
import { G } from "../SharedComponents";
import { font, fontDisp } from "../../design-system/tokens";
import { isNativeApp, nativePlugin, ensureNotifPermission } from "../../lib/native";
import { motivoPushNativo, pushNativoRegistrado } from "../../lib/push-native";
import { sincronizarRecordatorios } from "../../lib/recordatorios-locales";

/** Traduce el motivo técnico a algo que se entienda y se pueda accionar. */
function explicar(motivo, permiso) {
  if (permiso === "denied") {
    return {
      tono: "mal",
      texto: "Los avisos están apagados para Stratos en los ajustes del teléfono.",
      queHacer: "Ve a Ajustes → Stratos AI → Notificaciones y actívalas. Desde aquí no se puede: el teléfono solo permite cambiarlo desde sus propios ajustes.",
    };
  }
  if (!motivo || motivo === "todavia-no-se-intento") {
    return { tono: "regular", texto: "Todavía no se probó en este teléfono.", queHacer: "Cierra y vuelve a abrir la app." };
  }
  if (motivo === "registrado") {
    return { tono: "bien", texto: "Este teléfono está listo para recibir avisos.", queHacer: null };
  }
  if (motivo.startsWith("permiso-de-avisos-no-concedido")) {
    return {
      tono: "mal",
      texto: "Falta darle permiso a la app para avisarte.",
      queHacer: "Toca el botón de abajo. Si no aparece nada, actívalo en Ajustes → Stratos AI → Notificaciones.",
    };
  }
  if (motivo === "este-APK-se-compilo-sin-Firebase") {
    return {
      tono: "regular",
      texto: "Esta versión de Android todavía no puede recibir avisos de afuera.",
      queHacer: "Los recordatorios que pidas con antelación sí te van a sonar. Falta un trámite pendiente para el resto.",
    };
  }
  if (motivo === "esperando-que-el-sistema-de-el-numero") {
    return {
      tono: "regular",
      texto: "El teléfono aceptó, pero todavía no dio su identificación.",
      queHacer: "Suele tardar unos segundos. Si sigue así, revisa que tengas internet y vuelve a abrir la app.",
    };
  }
  if (motivo.startsWith("el-sistema-rechazo-el-registro")) {
    return { tono: "mal", texto: "El sistema del teléfono rechazó el registro.", queHacer: "Muéstrale esta pantalla a Ángel: " + motivo };
  }
  return { tono: "mal", texto: "No se pudo registrar este teléfono.", queHacer: "Muéstrale esta pantalla a Ángel: " + motivo };
}

export default function EstadoAvisos({ T, isLight = false, userId }) {
  const [permiso, setPermiso] = useState(null);
  const [agendados, setAgendados] = useState(null);
  const [pidiendo, setPidiendo] = useState(false);
  const [motivo, setMotivo] = useState(motivoPushNativo());

  const mirar = useCallback(async () => {
    const ln = nativePlugin("LocalNotifications");
    try {
      const p = await ln?.checkPermissions?.();
      setPermiso(p?.display ?? null);
    } catch { setPermiso(null); }
    try {
      const r = await ln?.getPending?.();
      setAgendados(r?.notifications?.length ?? 0);
    } catch { setAgendados(null); }
    setMotivo(pushNativoRegistrado() ? "registrado" : motivoPushNativo());
  }, []);

  useEffect(() => { if (isNativeApp()) mirar(); }, [mirar]);

  // En el navegador esta tarjeta no aplica: ahí los avisos van por otro camino.
  if (!isNativeApp()) return null;

  const activar = async () => {
    setPidiendo(true);
    try {
      await ensureNotifPermission();
      if (userId) await sincronizarRecordatorios(userId);
    } catch { /* el estado de abajo lo va a mostrar igual */ }
    await mirar();
    setPidiendo(false);
  };

  const { tono, texto, queHacer } = explicar(motivo, permiso);
  const color = tono === "bien" ? "#10B981" : tono === "mal" ? "#F87171" : "#FBBF24";
  const Icono = tono === "bien" ? CheckCircle2 : tono === "mal" ? BellOff : AlertCircle;

  return (
    <G T={T} style={{ padding: 24, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${T.accent}14`, border: `1px solid ${T.accent}2A`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Bell size={18} color={T.accent} strokeWidth={1.9} />
        </div>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: "0 0 2px", fontSize: 17, fontWeight: 400, color: T.txt, fontFamily: fontDisp }}>
            Avisos en este teléfono
          </h2>
          <div style={{ fontSize: 12.5, color: T.txt2, fontFamily: font }}>
            Si algo no te está llegando, aquí dice por qué.
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 12, background: isLight ? "rgba(15,23,42,0.03)" : "rgba(255,255,255,0.03)", border: `1px solid ${T.border}` }}>
        <Icono size={16} strokeWidth={2} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontFamily: font, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: T.txt, lineHeight: 1.5 }}>{texto}</div>
          {queHacer && (
            <div style={{ fontSize: 12.5, color: T.txt2, lineHeight: 1.55, marginTop: 4 }}>{queHacer}</div>
          )}
          {agendados !== null && (
            <div style={{ fontSize: 12.5, color: T.txt2, marginTop: 6 }}>
              {agendados === 0
                ? "No tienes recordatorios agendados en este teléfono ahora mismo."
                : `${agendados} recordatorio${agendados !== 1 ? "s" : ""} agendado${agendados !== 1 ? "s" : ""} en este teléfono — te van a sonar aunque cierres la app.`}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={activar} disabled={pidiendo}
          style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${T.border}`, background: "transparent", color: T.txt, fontFamily: font, fontSize: 13, cursor: pidiendo ? "default" : "pointer", opacity: pidiendo ? 0.6 : 1, minHeight: 40 }}>
          {pidiendo ? "Revisando…" : "Activar y revisar"}
        </button>
      </div>
    </G>
  );
}
