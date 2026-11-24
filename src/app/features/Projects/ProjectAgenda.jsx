import { CalendarDays, ChevronRight } from "lucide-react";
import { bySchedule, scheduleLabel, deliveryState, states, useProjects } from "./workspace";

export default function ProjectAgenda({ org, userId, team, onOpen, T }) {
  const { data, loading, error, reload } = useProjects(org);
  const projects = new Map(data?.projects.map((project) => [project.id, project.title]));
  const items = data?.deliveries.filter((item) => item.state !== "approved" &&
    ((team && data.manage) || item.assignee_id === userId || (item.reviewer_id === userId && item.state === "review")))
    .sort(bySchedule) || [];

  if (!items.length && !loading && !error) return null;
  return <section aria-label="Entregas de proyectos" style={{ margin: "16px 0", border: `1px solid ${T.border}`, borderRadius: 14, padding: "12px 16px" }}>
    <h3 style={{ fontSize: 16, margin: "0 0 8px", color: T.txt }}>Entregas de proyectos</h3>
    {loading && !data && <p role="status" style={{ color: T.txt2 }}>Cargando entregas…</p>}
    {error && <p role="alert" style={{ color: T.txt2 }}>{error} <button type="button" onClick={reload}>Reintentar</button></p>}
    {items.map((item) => <button key={item.id} type="button" onClick={() => onOpen(item.id)}
      style={{ width: "100%", minHeight: 52, display: "flex", alignItems: "center", gap: 12, padding: "8px 10px",
        color: T.txt, background: "transparent", border: 0, textAlign: "left", cursor: "pointer" }}>
      <CalendarDays size={18} color={T.accent} aria-hidden="true" />
      <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}><strong style={{ display: "block" }}>{item.title}</strong>
        <span style={{ color: T.txt2, fontSize: 13 }}>{projects.get(item.project_id)} · {scheduleLabel(item)} · {states[deliveryState(item)]}</span>
      </span>
      <ChevronRight size={17} aria-hidden="true" />
    </button>)}
  </section>;
}
