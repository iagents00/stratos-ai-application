import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarRange } from "lucide-react";
import { StratosAtomHex } from "../../components/Logo";
import { askProjects } from "./workspace";
import { projectTheme } from "./project-theme";
import "./projects.css";

export default function ProjectCopilot({ org, context, onBack, onPlanWeek, isLight }) {
  const [text, setText] = useState(context.id ? "¿Qué falta para entregar este trabajo?" : "");
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState(false);
  const pending = useRef(false);

  async function send(event) {
    event.preventDefault();
    const question = text.trim();
    if (pending.current || !question) return;
    pending.current = true;
    setWaiting(true);
    setError("");
    const result = await askProjects(org, context.id, question, messages.slice(-3));
    pending.current = false;
    setWaiting(false);
    if (!result?.reply) {
      setError(result?.error || "Copilot no pudo responder.");
      return;
    }
    setMessages((previous) => [...previous, { question, answer: result.reply }]);
    setText("");
  }

  return <section className="pw pw-chat" data-theme={isLight ? "light" : "dark"} style={projectTheme(isLight)}>
    <div className="pw-toolbar">
      <button className="pw-btn" type="button" onClick={onBack}><ArrowLeft size={18} /> Volver a Proyectos</button>
      {onPlanWeek && <button className="pw-btn" type="button" disabled={waiting}
        onClick={() => onPlanWeek(context.id && text === "¿Qué falta para entregar este trabajo?" ? "" : text)}>
        <CalendarRange size={18} /> Planear semana
      </button>}
    </div>
    <div className="pw-panel">
      <h1><StratosAtomHex size={26} color="var(--pw-blue)" edge="var(--pw-atom-edge)" /> Copilot de Proyectos</h1>
      <p className="pw-sub">{context.title || "Proyectos de tu organización"}</p>
      {messages.map(({ question, answer }, index) => <div className="pw-exchange" key={index}>
        <p><strong>Tú</strong> {question}</p><p className="pw-evidence">{answer}</p>
      </div>)}
      {error && <p role="alert" className="pw-alert">{error}</p>}
      <form className="pw-chat-form" onSubmit={send}>
        <label>Mensaje<textarea rows={2} maxLength={2400} value={text} onChange={(event) => setText(event.target.value)} required /></label>
        <button className="pw-btn pw-primary" type="submit" disabled={waiting || !text.trim()}>
          {waiting ? "Consultando…" : "Enviar"} <ArrowRight size={18} />
        </button>
      </form>
    </div>
  </section>;
}
