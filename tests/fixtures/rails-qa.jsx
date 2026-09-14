// Development-only fixture. No real users, destinations, database writes or production routes.
import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { AuthContext } from "../../src/contexts/AuthContext";
import RailsSettings from "../../src/app/features/Admin/RailsSettings";
import MiDia from "../../src/app/views/MiDia";
import { fusionarRails } from "../../src/lib/rails-config";
import { P, LP } from "../../src/design-system/tokens";
function QA() {
  const [role, setRole] = useState("seller"),
    [light, setLight] = useState(false),
    [fail, setFail] = useState(false),
    [open, setOpen] = useState(""),
    [scenario, setScenario] = useState("normal");
  const [leads, setLeads] = useState(
    Array.from({ length: 11 }, (_, i) => ({
      id: `fixture-${i}`,
      n: `Cliente de ejemplo ${i + 1}`,
      st: "Contáctame Ya",
      nextAction: "Conversar sobre necesidades",
      phone: null,
    })),
  );
  const [saved, setSaved] = useState({});
  const T = light ? LP : P;
  const user =
    role === "admin"
      ? { id: "demo-user-local", role: "admin", isDemo: true }
      : { id: "fixture-seller", role: "asesor" };
  const persistence = useMemo(
    () => ({
      read: async () => {
        if (scenario === "error") throw new Error("Read failure fixture");
        if (scenario === "loading") return new Promise(() => {});
        return saved;
      },
      write: async (a, state) => {
        if (fail) return false;
        setSaved((s) => ({ ...s, [a.leadId]: state }));
        return true;
      },
    }),
    [fail, saved, scenario],
  );
  const config = useMemo(
    () => fusionarRails({ activo: true, maxTarjetas: 3 }),
    [],
  );
  const btn = {
    minHeight: 44,
    padding: 10,
    background: T.surface,
    color: T.txt,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
  };
  return (
    <AuthContext.Provider value={{ user }}>
      <main
        style={{
          minHeight: "100vh",
          background: T.bg,
          color: T.txt,
          fontFamily: "system-ui",
          padding: 16,
        }}
      >
        <nav
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <button style={btn} onClick={() => setRole("admin")}>
            Probar administrador
          </button>
          <button style={btn} onClick={() => setRole("seller")}>
            Probar vendedor
          </button>
          <button style={btn} onClick={() => setLight(!light)}>
            Cambiar tema
          </button>
          <label style={btn}>
            <input
              type="checkbox"
              checked={fail}
              onChange={(e) => setFail(e.target.checked)}
            />{" "}
            Simular fallo de guardado
          </label>
          <label style={btn}>
            Escenario{" "}
            <select
              aria-label="Escenario"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
            >
              <option value="normal">Normal</option>
              <option value="long">Texto largo</option>
              <option value="empty">Sin pendientes</option>
              <option value="error">Fallo al leer</option>
              <option value="loading">Cargando</option>
            </select>
          </label>
        </nav>
        <p>
          PRUEBA AISLADA · datos ficticios · sin llamadas ni escrituras reales
        </p>
        {role === "admin" ? (
          <RailsSettings T={T} />
        ) : (
          <MiDia
            key={scenario}
            leads={
              scenario === "empty"
                ? []
                : scenario === "long"
                  ? leads.map((l) => ({
                      ...l,
                      n: "María Fernanda del Carmen Rodríguez y Asociados · Consultoría Internacional de Inversiones",
                      phone: "+12025550123",
                    }))
                  : leads
            }
            T={T}
            config={config}
            persistence={persistence}
            onAbrirCliente={(id) => setOpen(`Ficha: ${id}`)}
            onVerCRM={() => setOpen("Todos los clientes")}
            onNuevoCliente={() => setOpen("Alta de cliente")}
            onMover={async (a, days) => {
              if (fail) return { ok: false, error: "Fallo simulado" };
              const d = new Date();
              d.setDate(d.getDate() + days);
              d.setHours(9, 0, 0, 0);
              setLeads((ls) =>
                ls.map((l) =>
                  l.id === a.leadId
                    ? { ...l, next_action_at: d.toISOString() }
                    : l,
                ),
              );
              return { ok: true, fecha: d.toISOString() };
            }}
          />
        )}
        {open && <p role="status">{open}</p>}
      </main>
    </AuthContext.Provider>
  );
}
createRoot(document.getElementById("root")).render(<QA />);
