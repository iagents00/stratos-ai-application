import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { P, font } from "../../../design-system/tokens";
import { G } from "../../../design-system/primitives";

/* WriterSection: Rich message composer for client personalization */
const WriterSection = ({ value, onChange, clientName }) => {
  const [showPreview, setShowPreview] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("formal");
  const charLimit = 500;
  const charCount = value.length;

  const templates = {
    formal: {
      label: "Formal",
      text: `Estimado ${clientName || "cliente"}, fue un placer hablar contigo. Aquí te presento una selección curada de las mejores oportunidades de inversión en la Riviera Maya, elegidas específicamente para tus objetivos financieros.`
    },
    warm: {
      label: "Cálido",
      text: `Hola ${clientName || "cliente"}, basándome en nuestra conversación, seleccioné estas propiedades que creo que se adaptan perfectamente a lo que buscas. Cada una ofrece excelentes rendimientos y ubicación estratégica en la Riviera Maya.`
    },
    exclusive: {
      label: "Exclusivo",
      text: `${clientName || "Cliente"}, te presentamos acceso exclusivo a nuestras propiedades premium seleccionadas. Estas oportunidades limitadas combinan ubicación de ensueño, diseño arquitectónico de clase mundial y rendimientos superiores.`
    },
    investment: {
      label: "Inversión",
      text: `${clientName || "Cliente"}, esta cartera de propiedades representa el mejor análisis de rentabilidad en el mercado actual. Proyecciones de ROI 8-13% anual con plusvalía garantizada en la Riviera Maya.`
    }
  };

  const applyTemplate = (templateKey) => {
    setSelectedTemplate(templateKey);
    onChange(templates[templateKey].text);
  };

  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ fontSize: 11, color: P.txt2, display: "block", marginBottom: 10, fontWeight: 600, letterSpacing: "0.03em", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>Mensaje personalizado</span>
        <span style={{ fontSize: 10, color: P.txt3, fontWeight: 400 }}>{charCount}/{charLimit}</span>
      </label>

      {/* Templates */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
        {Object.entries(templates).map(([key, template]) => (
          <button
            key={key}
            onClick={() => applyTemplate(key)}
            style={{
              padding: "8px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600,
              border: `1px solid ${selectedTemplate === key ? P.accent + "60" : P.border}`,
              background: selectedTemplate === key ? P.accentS : P.glass,
              color: selectedTemplate === key ? P.accent : P.txt2,
              cursor: "pointer", fontFamily: font, transition: "all 0.2s",
            }}
          >
            {template.label}
          </button>
        ))}
      </div>

      {/* Editor */}
      <div style={{ position: "relative", marginBottom: 8 }}>
        <textarea
          value={value}
          onChange={(e) => {
            if (e.target.value.length <= charLimit) onChange(e.target.value);
          }}
          placeholder="Escribe un mensaje personalizado o elige una plantilla arriba..."
          rows={4}
          style={{
            width: "100%", padding: "12px 16px", borderRadius: 10, fontSize: 13,
            background: P.glass, border: `1px solid ${P.border}`, color: P.txt,
            fontFamily: font, outline: "none", resize: "vertical", lineHeight: 1.5,
            transition: "border-color 0.2s",
          }}
          onFocus={e => e.target.style.borderColor = P.accent + "60"}
          onBlur={e => e.target.style.borderColor = P.border}
          maxLength={charLimit}
        />
        <div style={{ position: "absolute", bottom: 10, right: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: charCount > charLimit * 0.8 ? P.rose : P.txt3 }}>
            {charCount}/{charLimit}
          </span>
        </div>
      </div>

      {/* Preview toggle */}
      <button
        onClick={() => setShowPreview(!showPreview)}
        style={{
          fontSize: 11, fontWeight: 600, color: P.accent, background: "transparent",
          border: "none", cursor: "pointer", padding: 0, marginBottom: 12,
          display: "flex", alignItems: "center", gap: 4,
        }}
      >
        {showPreview ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        Vista previa en landing page
      </button>

      {/* Preview */}
      {showPreview && value && (
        <G style={{ padding: 16, background: "rgba(110,231,194,0.05)", border: `1px solid ${P.accent}1A` }}>
          <p style={{ fontSize: 10, color: P.accent, fontWeight: 600, letterSpacing: "0.03em", marginBottom: 10, textTransform: "uppercase" }}>Cómo verá el cliente</p>
          <p style={{ fontSize: 14, color: P.txt, lineHeight: 1.7, fontFamily: font, fontStyle: "italic" }}>
            "{value}"
          </p>
        </G>
      )}
    </div>
  );
};

export default WriterSection;
