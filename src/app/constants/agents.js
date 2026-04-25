/**
 * app/constants/agents.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Registro de agentes IA y sus íconos.
 * Extraído de App.jsx y CRM.jsx para eliminar duplicación.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { RefreshCw, MessageCircle, Phone, Target, Crosshair, Waypoints, Radar } from "lucide-react";

export const AgentIcons = {
  gerente: Crosshair,
  asistente: Waypoints,
  analista: Radar,
};

export const AI_AGENTS = {
  reactivar: {
    key: "reactivar",
    name: "Reactivador",
    short: "Reactivador",
    role: "Recupera leads fríos",
    icon: RefreshCw,
    color: "#6EE7C2",
    bestFor: "Clientes con 5+ días sin contacto",
    how: "Envía mensajes personalizados por WhatsApp y email para reabrir la conversación sin sonar forzado.",
  },
  seguimiento: {
    key: "seguimiento",
    name: "Seguimiento",
    short: "Seguimiento",
    role: "Mantiene la relación activa",
    icon: MessageCircle,
    color: "#6EE7C2",
    bestFor: "Clientes activos en primer contacto o seguimiento",
    how: "Prepara next-steps, recordatorios y micro-compromisos para evitar que el lead se enfríe.",
  },
  callcenter: {
    key: "callcenter",
    name: "Callcenter IA",
    short: "Callcenter",
    role: "Prepara y asiste llamadas",
    icon: Phone,
    color: "#72A9F5",
    bestFor: "Leads HOT o Zooms agendados",
    how: "Genera briefing pre-llamada con objeciones esperadas, argumentos y tono del cliente.",
  },
  calificar: {
    key: "calificar",
    name: "Calificador",
    short: "Calificador",
    role: "Evalúa y prioriza leads nuevos",
    icon: Target,
    color: "#C9B1F8",
    bestFor: "Clientes recién registrados",
    how: "Analiza perfil, intención y fit del proyecto para darte un score y recomendación accionable.",
  },
};

export const AI_AGENT_LIST = Object.values(AI_AGENTS);
