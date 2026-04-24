import { useState, useEffect, useMemo } from "react";
import {
  TrendingUp, Target, Plus, Heart, Users, Crown, Building2,
  Globe, Palmtree, Waves, Wand2, Image, Download, ExternalLink,
  Copy, Check, Trash2, ChevronDown, ChevronRight, Eye, Share2,
  DollarSign, Shield, MapPin, FileText, X, Phone, CalendarDays, User
} from "lucide-react";
import { P, font, fontDisp } from "../../design-system/tokens";
import { G, KPI, Pill, Ico } from "../SharedComponents";

const team = [
  { n: "Oscar Gálvez",      r: "CEO Ejecutivo",           wa: "+52 998 000 0001", cal: "" },
  { n: "Emmanuel Ortiz",    r: "Director de Ventas",      wa: "+52 998 000 0002", cal: "" },
  { n: "Alexia Santillán",  r: "Directora Administrativa",wa: "+52 998 000 0003", cal: "" },
  { n: "Alex Velázquez",    r: "Director de Marketing",   wa: "+52 998 000 0004", cal: "" },
  { n: "Ken Lugo Ríos",     r: "Asesor Senior",           wa: "+52 998 000 0005", cal: "" },
  { n: "Araceli Oneto",     r: "Asesora Especialista",    wa: "+52 998 000 0006", cal: "" },
  { n: "Cecilia Mendoza",   r: "Asesora Premium",         wa: "+52 998 000 0007", cal: "" },
  { n: "Estefanía Valdes",  r: "Asesora Premium",         wa: "+52 998 000 0008", cal: "" },
];

const WriterSection = ({ value, onChange, clientName, T = P }) => {
  const isLight = T !== P;
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
      <label style={{ fontSize: 11, color: T.txt2, display: "block", marginBottom: 10, fontWeight: 600, letterSpacing: "0.03em", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>Mensaje personalizado</span>
        <span style={{ fontSize: 10, color: T.txt3, fontWeight: 400 }}>{charCount}/{charLimit}</span>
      </label>

      {/* Templates */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
        {Object.entries(templates).map(([key, template]) => (
          <button
            key={key}
            onClick={() => applyTemplate(key)}
            style={{
              padding: "8px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600,
              border: `1px solid ${selectedTemplate === key ? T.accent + "60" : T.border}`,
              background: selectedTemplate === key ? T.accentS : T.glass,
              color: selectedTemplate === key ? T.accent : T.txt2,
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
            background: T.glass, border: `1px solid ${T.border}`, color: T.txt,
            fontFamily: font, outline: "none", resize: "vertical", lineHeight: 1.5,
            transition: "border-color 0.2s",
          }}
          onFocus={e => e.target.style.borderColor = T.accent + "60"}
          onBlur={e => e.target.style.borderColor = T.border}
          maxLength={charLimit}
        />
        <div style={{ position: "absolute", bottom: 10, right: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: charCount > charLimit * 0.8 ? T.rose : T.txt3 }}>
            {charCount}/{charLimit}
          </span>
        </div>
      </div>

      {/* Preview toggle */}
      <button
        onClick={() => setShowPreview(!showPreview)}
        style={{
          fontSize: 11, fontWeight: 600, color: T.accent, background: "transparent",
          border: "none", cursor: "pointer", padding: 0, marginBottom: 12,
          display: "flex", alignItems: "center", gap: 4,
        }}
      >
        {showPreview ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        Vista previa en landing page
      </button>

      {/* Preview */}
      {showPreview && value && (
        <G T={T} style={{ padding: 16, background: `${T.accent}08`, border: `1px solid ${T.accent}1A` }}>
          <p style={{ fontSize: 10, color: T.accent, fontWeight: 600, letterSpacing: "0.03em", marginBottom: 10, textTransform: "uppercase" }}>Cómo verá el cliente</p>
          <p style={{ fontSize: 14, color: T.txt, lineHeight: 1.7, fontFamily: font, fontStyle: "italic" }}>
            "{value}"
          </p>
        </G>
      )}
    </div>
  );
};

/* SVG art para cada propiedad — simula fotografía arquitectónica premium */
const PropArt = ({ prop, height = 220 }) => {
  const arts = {
    1: ( // Mayakaan — selva + cenote + resort
      <svg width="100%" height={height} viewBox="0 0 400 220" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="mg1" cx="50%" cy="60%"><stop offset="0%" stopColor="#2d9b6e"/><stop offset="100%" stopColor="#061a10"/></radialGradient>
          <radialGradient id="mc1" cx="50%" cy="50%"><stop offset="0%" stopColor="#4dd8a0" stopOpacity="0.9"/><stop offset="100%" stopColor="#1a7a5a" stopOpacity="0.2"/></radialGradient>
        </defs>
        <rect width="400" height={height} fill="url(#mg1)"/>
        {/* Sky */}
        <rect width="400" height="90" fill="url(#mg1)" opacity="0.6"/>
        {/* Jungle trees */}
        {[20,60,100,140,260,300,340,380].map((x,i)=><ellipse key={i} cx={x} cy={40+i%3*12} rx={18+i%2*8} ry={35+i%3*10} fill={i%2?"#1a5a35":"#2d7a4e"} opacity="0.8"/>)}
        {/* Building silhouette */}
        <rect x="120" y="70" width="160" height="100" rx="4" fill="#0a3d22" opacity="0.9"/>
        <rect x="140" y="85" width="40" height="35" rx="2" fill="#1a7a5a" opacity="0.7"/>
        <rect x="195" y="85" width="40" height="35" rx="2" fill="#1a7a5a" opacity="0.7"/>
        <rect x="140" y="130" width="40" height="40" rx="2" fill="#2d9b6e" opacity="0.5"/>
        {/* Infinity pool */}
        <ellipse cx="200" cy="185" rx="90" ry="22" fill="#4dd8a0" opacity="0.35"/>
        <ellipse cx="200" cy="183" rx="80" ry="16" fill="#6EEDC2" opacity="0.25"/>
        {/* Cenote */}
        <ellipse cx="320" cy="170" rx="45" ry="28" fill="#1a5a8a" opacity="0.7"/>
        <ellipse cx="320" cy="170" rx="35" ry="20" fill="#4da8d8" opacity="0.5"/>
        <ellipse cx="318" cy="168" rx="18" ry="10" fill="#7DD4F0" opacity="0.6"/>
        {/* Light rays */}
        <line x1="200" y1="0" x2="200" y2="220" stroke="#6EE7C2" strokeWidth="0.5" opacity="0.1"/>
        <circle cx="80" cy="25" r="15" fill="#FFE08A" opacity="0.2"/>
        <text x="200" y="210" textAnchor="middle" fill="white" fontSize="8" opacity="0.5" fontFamily="sans-serif">PUERTO MORELOS · RIVIERA MAYA</text>
      </svg>
    ),
    2: ( // Hoxul — ocean view, Playa del Carmen
      <svg width="100%" height={height} viewBox="0 0 400 220" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="hg1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#0a1f3d"/><stop offset="50%" stopColor="#1a4a7a"/><stop offset="100%" stopColor="#0d2a4e"/></linearGradient>
          <linearGradient id="hw1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#1a6aaa" stopOpacity="0.6"/><stop offset="50%" stopColor="#4a9fd4" stopOpacity="0.8"/><stop offset="100%" stopColor="#1a6aaa" stopOpacity="0.6"/></linearGradient>
        </defs>
        <rect width="400" height={height} fill="url(#hg1)"/>
        {/* Ocean */}
        <rect x="0" y="140" width="400" height="80" fill="url(#hw1)"/>
        {/* Wave lines */}
        {[145,158,170,182].map((y,i)=><path key={i} d={`M0 ${y} Q100 ${y-6} 200 ${y} Q300 ${y+6} 400 ${y}`} stroke="#7EB8F0" strokeWidth="1" fill="none" opacity={0.3-i*0.06}/>)}
        {/* Modern building */}
        <rect x="80" y="40" width="240" height="120" rx="6" fill="#0d2a4e" opacity="0.95"/>
        {/* Building facade grid */}
        {[0,1,2,3,4].map(col=>[0,1,2].map(row=><rect key={`${col}-${row}`} x={100+col*42} y={58+row*30} width="30" height="20" rx="2" fill="#1a5a9a" opacity="0.7"/>))}
        {/* Penthouse level */}
        <rect x="110" y="25" width="180" height="25" rx="4" fill="#0f3366" opacity="0.9"/>
        <rect x="150" y="18" width="100" height="12" rx="2" fill="#142d55" opacity="0.8"/>
        {/* Rooftop pool */}
        <ellipse cx="200" cy="35" rx="50" ry="10" fill="#4a9fd4" opacity="0.4"/>
        {/* Ocean glow */}
        <ellipse cx="200" cy="200" rx="180" ry="30" fill="#7EB8F0" opacity="0.1"/>
        <text x="200" y="212" textAnchor="middle" fill="white" fontSize="8" opacity="0.5" fontFamily="sans-serif">PLAYA DEL CARMEN · FRENTE AL CARIBE</text>
      </svg>
    ),
    3: ( // Zenesis — Tulum ecológico
      <svg width="100%" height={height} viewBox="0 0 400 220" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="zg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#1a3308"/><stop offset="60%" stopColor="#2d5a14"/><stop offset="100%" stopColor="#1a3a0d"/></linearGradient>
        </defs>
        <rect width="400" height={height} fill="url(#zg1)"/>
        {/* Sky with golden hour */}
        <rect width="400" height="80" fill="#1a2e05" opacity="0.8"/>
        <ellipse cx="350" cy="30" r="25" fill="#FFB74D" opacity="0.3"/>
        {/* Dense jungle */}
        {[0,30,70,110,160,210,260,310,360,400].map((x,i)=><ellipse key={i} cx={x} cy={20+i%4*8} rx={25+i%3*10} ry={45+i%4*15} fill={["#2d5a14","#3d7a1e","#1a4a0a","#4a8a28"][i%4]} opacity="0.85"/>)}
        {/* Low-density units — eco architecture */}
        <rect x="60" y="100" width="80" height="80" rx="8" fill="#1a3a0d" opacity="0.92"/>
        <rect x="160" y="110" width="80" height="70" rx="8" fill="#1a3a0d" opacity="0.92"/>
        <rect x="260" y="95" width="80" height="85" rx="8" fill="#1a3a0d" opacity="0.92"/>
        {/* Rooftop gardens */}
        <ellipse cx="100" cy="98" rx="32" ry="8" fill="#4a8a28" opacity="0.7"/>
        <ellipse cx="200" cy="108" rx="32" ry="8" fill="#4a8a28" opacity="0.7"/>
        <ellipse cx="300" cy="93" rx="32" ry="8" fill="#4a8a28" opacity="0.7"/>
        {/* Plunge pools on rooftop */}
        <ellipse cx="100" cy="97" rx="12" ry="4" fill="#4dd8a0" opacity="0.6"/>
        <ellipse cx="300" cy="92" rx="12" ry="4" fill="#4dd8a0" opacity="0.6"/>
        {/* Communal pool */}
        <ellipse cx="200" cy="198" rx="100" ry="18" fill="#4dd8a0" opacity="0.3"/>
        <text x="200" y="212" textAnchor="middle" fill="white" fontSize="8" opacity="0.5" fontFamily="sans-serif">TULUM · ECO-LUXURY</text>
      </svg>
    ),
    4: ( // Oniric — boutique, cenote floral
      <svg width="100%" height={height} viewBox="0 0 400 220" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="og1" cx="40%" cy="40%"><stop offset="0%" stopColor="#6a2d9a"/><stop offset="100%" stopColor="#1a082a"/></radialGradient>
          <radialGradient id="oc1" cx="50%" cy="50%"><stop offset="0%" stopColor="#c084fc" stopOpacity="0.9"/><stop offset="40%" stopColor="#7c3aed" stopOpacity="0.6"/><stop offset="100%" stopColor="#1a082a" stopOpacity="0"/></radialGradient>
        </defs>
        <rect width="400" height={height} fill="url(#og1)"/>
        {/* Stars */}
        {[40,80,130,170,220,260,320,360,50,150,250,350,100,200,300].map((x,i)=><circle key={i} cx={x} cy={15+i%5*8} r="1" fill="white" opacity={0.4+i%3*0.2}/>)}
        {/* Boutique building */}
        <rect x="130" y="50" width="140" height="130" rx="10" fill="#2d0d4d" opacity="0.95"/>
        {/* Floating staircases */}
        {[0,1,2].map(i=><rect key={i} x={155+i*20} y={80+i*22} width="35" height="8" rx="4" fill="#9f7aea" opacity="0.5"/>)}
        {/* CENOTE FLORAL — el centerpiece */}
        <circle cx="200" cy="175" r="38" fill="#4a1575" opacity="0.5"/>
        {/* Flower petals */}
        {[0,60,120,180,240,300].map((angle,i)=>{
          const rad = angle * Math.PI / 180;
          return <ellipse key={i} cx={200+Math.cos(rad)*22} cy={175+Math.sin(rad)*22} rx="16" ry="10" transform={`rotate(${angle},${200+Math.cos(rad)*22},${175+Math.sin(rad)*22})`} fill="#7c3aed" opacity="0.7"/>;
        })}
        <circle cx="200" cy="175" r="18" fill="#a78bfa" opacity="0.6"/>
        <circle cx="200" cy="175" r="10" fill="#c4b5fd" opacity="0.8"/>
        <circle cx="200" cy="175" r="4" fill="white" opacity="0.9"/>
        {/* Glow */}
        <circle cx="200" cy="175" r="45" fill="url(#oc1)"/>
        <text x="200" y="215" textAnchor="middle" fill="white" fontSize="8" opacity="0.5" fontFamily="sans-serif">TULUM REGIÓN 8 · 27 UNIDADES EXCLUSIVAS</text>
      </svg>
    ),
    5: ( // Kokoon — pueblo yucateco
      <svg width="100%" height={height} viewBox="0 0 400 220" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="kg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#7a5a2d"/><stop offset="50%" stopColor="#9a7a3d"/><stop offset="100%" stopColor="#4d3a1a"/></linearGradient>
        </defs>
        <rect width="400" height={height} fill="url(#kg1)"/>
        {/* Sky with warm tones */}
        <rect width="400" height="70" fill="#3d2510" opacity="0.7"/>
        <ellipse cx="320" cy="25" r="20" fill="#FFB74D" opacity="0.4"/>
        {/* Pueblo-style villas */}
        {[30,130,230,330].map((x,i)=>(
          <g key={i}>
            <rect x={x} y={90+i%2*5} width="75" height="90" rx="4" fill={["#5a3d1a","#6a4d2a","#4d3010","#5d4020"][i]} opacity="0.95"/>
            {/* Arch entrance */}
            <path d={`M${x+20} ${160} Q${x+37.5} ${140} ${x+55} ${160}`} fill={["#7a5a2d","#8a6a3d"][i%2]} opacity="0.9"/>
            {/* Rooftop wall (pretil) */}
            <rect x={x-2} y={87+i%2*5} width="79" height="12" rx="2" fill={["#9a7a4d","#7a5a30"][i%2]} opacity="0.9"/>
            {/* Rooftop plunge pool */}
            <ellipse cx={x+37} cy={93+i%2*5} rx="18" ry="6" fill="#4dd8a0" opacity="0.5"/>
            {/* Windows */}
            <rect x={x+8} y={108+i%2*5} width="20" height="20" rx="2" fill="#e8b84d" opacity="0.3"/>
            <rect x={x+47} y={108+i%2*5} width="20" height="20" rx="2" fill="#e8b84d" opacity="0.3"/>
          </g>
        ))}
        {/* Communal pool */}
        <ellipse cx="200" cy="195" rx="120" ry="20" fill="#4dd8a0" opacity="0.3"/>
        <text x="200" y="212" textAnchor="middle" fill="white" fontSize="8" opacity="0.5" fontFamily="sans-serif">TULUM · 10 VILLAS BOUTIQUE</text>
      </svg>
    ),
    6: ( // Gran Tulum — Aldea Zama
      <svg width="100%" height={height} viewBox="0 0 400 220" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gg1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#082030"/><stop offset="50%" stopColor="#0d3d5a"/><stop offset="100%" stopColor="#0a2a40"/></linearGradient>
        </defs>
        <rect width="400" height={height} fill="url(#gg1)"/>
        {/* Night sky */}
        {[30,80,140,200,260,320,370,50,150,250,350].map((x,i)=><circle key={i} cx={x} cy={5+i%4*10} r="1.2" fill="white" opacity={0.3+i%3*0.2}/>)}
        {/* Aldea Zama master plan - multiple buildings */}
        {[20,100,180,260,340].map((x,i)=>(
          <g key={i}>
            <rect x={x} y={60+i%3*12} width="65" height={100-i%3*8} rx="5" fill={["#0f3a5c","#0d2a45","#132f52"][i%3]} opacity="0.95"/>
            {/* Lit windows */}
            {[0,1,2].map(row=>[0,1].map(col=><rect key={`${i}-${row}-${col}`} x={x+8+col*28} y={75+i%3*12+row*22} width="18" height="14" rx="2" fill="#5DC8D9" opacity={0.2+Math.random()*0.4}/>))}
          </g>
        ))}
        {/* Rooftop bar highlight */}
        <rect x="0" y="55" width="400" height="12" fill="#5DC8D9" opacity="0.05"/>
        {/* Pool level */}
        <ellipse cx="200" cy="195" rx="140" ry="20" fill="#5DC8D9" opacity="0.2"/>
        {/* Airbnb badge glow */}
        <rect x="145" y="38" width="110" height="20" rx="10" fill="#FF5A5F" opacity="0.2"/>
        <text x="200" y="51" textAnchor="middle" fill="#FF5A5F" fontSize="8" opacity="0.7" fontFamily="sans-serif">★ ZONA #1 AIRBNB TULUM</text>
        <text x="200" y="212" textAnchor="middle" fill="white" fontSize="8" opacity="0.5" fontFamily="sans-serif">ALDEA ZAMA · TULUM</text>
      </svg>
    ),
    7: ( // Senzik — golf, luxury
      <svg width="100%" height={height} viewBox="0 0 400 220" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="sg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#041208"/><stop offset="60%" stopColor="#0d3318"/><stop offset="100%" stopColor="#061a0c"/></linearGradient>
        </defs>
        <rect width="400" height={height} fill="url(#sg1)"/>
        {/* Golf course */}
        <ellipse cx="200" cy="160" rx="200" ry="60" fill="#1a4d22" opacity="0.8"/>
        <ellipse cx="200" cy="160" rx="150" ry="40" fill="#206b2a" opacity="0.7"/>
        <ellipse cx="200" cy="160" rx="100" ry="25" fill="#2d8a38" opacity="0.6"/>
        {/* Golf flag */}
        <line x1="320" y1="110" x2="320" y2="145" stroke="white" strokeWidth="1.5" opacity="0.7"/>
        <polygon points="320,110 340,118 320,126" fill="#FF5252" opacity="0.8"/>
        {/* Three luxury towers */}
        {[70,185,300].map((x,i)=>(
          <g key={i}>
            <rect x={x} y={35+i%2*10} width="55" height={110-i%2*10} rx="6" fill={["#0a1e0d","#0d2912","#091808"][i]} opacity="0.97"/>
            {/* Tower windows */}
            {[0,1,2,3].map(row=>[0,1].map(col=><rect key={`${i}-${row}-${col}`} x={x+8+col*24} y={48+i%2*10+row*20} width="16" height="12" rx="2" fill="#4CAF50" opacity={0.15+row*0.08}/>))}
            {/* Rooftop pool */}
            <ellipse cx={x+27} cy={38+i%2*10} rx="20" ry="6" fill="#4dd8a0" opacity="0.4"/>
            {/* Tower name */}
            <text x={x+27} y={155-i%2*10} textAnchor="middle" fill="white" fontSize="6" opacity="0.4" fontFamily="sans-serif">{["JUNGLE","POOLSIDE","CENOTE"][i]}</text>
          </g>
        ))}
        {/* PGA badge */}
        <rect x="150" y="15" width="100" height="18" rx="9" fill="#4CAF50" opacity="0.2"/>
        <text x="200" y="27" textAnchor="middle" fill="#4CAF50" fontSize="8" opacity="0.8" fontFamily="sans-serif">⛳ CAMPO GOLF PGA</text>
        <text x="200" y="212" textAnchor="middle" fill="white" fontSize="8" opacity="0.5" fontFamily="sans-serif">TULUM COUNTRY CLUB · 14 UNIDADES</text>
      </svg>
    ),
    8: ( // Blue House Marina
      <svg width="100%" height={height} viewBox="0 0 400 220" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bw1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#1a3a6a"/><stop offset="100%" stopColor="#0a1a40"/></linearGradient>
        </defs>
        <rect width="400" height={height} fill="#0d1f3d"/>
        {/* Ocean/marina water */}
        <rect x="0" y="150" width="400" height="70" fill="url(#bw1)" opacity="0.9"/>
        {/* Water ripples */}
        {[155,165,175,185].map((y,i)=><path key={i} d={`M0 ${y} Q100 ${y-4} 200 ${y} Q300 ${y+4} 400 ${y}`} stroke="#64B5F6" strokeWidth="0.8" fill="none" opacity={0.2-i*0.04}/>)}
        {/* European-style building */}
        <rect x="80" y="45" width="240" height="115" rx="4" fill="#0d2550" opacity="0.95"/>
        {/* Arched windows — European style */}
        {[0,1,2,3,4].map(col=>[0,1,2].map(row=>(
          <g key={`${col}-${row}`}>
            <rect x={95+col*42} y={65+row*28} width="26" height="18" rx="1" fill="#1a4a8a" opacity="0.6"/>
            <path d={`M${95+col*42} ${65+row*28} Q${108+col*42} ${58+row*28} ${121+col*42} ${65+row*28}`} fill="#1a5a9a" opacity="0.4"/>
          </g>
        )))}
        {/* Marina dock */}
        <rect x="60" y="148" width="280" height="6" rx="3" fill="#8B6914" opacity="0.7"/>
        {[80,140,200,260,320].map((x,i)=><rect key={i} x={x} y={154} width="5" height="30" rx="2" fill="#8B6914" opacity="0.5"/>)}
        {/* Boats */}
        <ellipse cx="110" cy="180" rx="25" ry="8" fill="#E8D5A3" opacity="0.6"/>
        <ellipse cx="290" cy="183" rx="30" ry="8" fill="#E8D5A3" opacity="0.5"/>
        {/* Marina flag */}
        <line x1="200" y1="20" x2="200" y2="45" stroke="white" strokeWidth="1" opacity="0.5"/>
        <rect x="200" y="20" width="20" height="12" fill="#64B5F6" opacity="0.7"/>
        <text x="200" y="212" textAnchor="middle" fill="white" fontSize="8" opacity="0.5" fontFamily="sans-serif">PUERTO AVENTURAS · MARINA EXCLUSIVA</text>
      </svg>
    ),
  };
  return arts[prop.id] || arts[1];
};

/* Gallery art — 6 frames per property */
const GalleryArt = ({ prop, index }) => {
  const frames = [
    { label: "Piscina", grad: `linear-gradient(135deg, ${prop.accent}30, ${prop.accent}08)` },
    { label: "Vista aérea", grad: "linear-gradient(180deg, #0a1520 0%, #1a3a5a 100%)" },
    { label: "Lobby", grad: "linear-gradient(135deg, #1a1a2a, #2a2a4a)" },
    { label: "Terraza", grad: `linear-gradient(180deg, ${prop.accent}20, #050810)` },
    { label: "Amenidades", grad: "linear-gradient(135deg, #1a2a1a, #2a4a2a)" },
    { label: "Recámara", grad: "linear-gradient(135deg, #1a1510, #2a2515)" },
  ];
  const f = frames[index % 6];
  return (
    <div style={{ height: 90, borderRadius: 8, background: f.grad, border: "1px solid rgba(255,255,255,0.06)", position: "relative", overflow: "hidden", display: "flex", alignItems: "flex-end", padding: "8px 10px" }}>
      <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(45deg, rgba(255,255,255,0.01) 0px, rgba(255,255,255,0.01) 1px, transparent 1px, transparent 8px)" }} />
      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: font, letterSpacing: "0.05em", textTransform: "uppercase", position: "relative" }}>{f.label}</span>
    </div>
  );
};

const rivieraProperties = [
  {
    id: 1, name: "Mayakaan Residences", brand: "by Wyndham Grand",
    location: "Puerto Morelos", zone: "15 min del Aeropuerto de Cancún",
    type: "Condominios", sizes: ["77 m²", "84 m²", "122 m²", "143 m²"],
    bedrooms: "1-3 recámaras", priceFrom: 183340, priceTo: 515000,
    roi: "8-10%", roiNum: 9, delivery: "2026", badge: "PREVENTA",
    unitsAvailable: 48, totalUnits: 300, featured: true,
    amenities: ["5,000 m² de piscinas", "8 Skypools elevados", "Cenote natural", "Zipline de 300m", "Spa con cenote", "Cine al aire libre", "Canchas de tenis y pádel", "Parque acuático", "Gimnasio", "Co-working", "Restaurantes temáticos", "Seguridad 24/7", "Domótica"],
    highlights: ["Marca hotelera Wyndham Grand", "Programa de renta administrada", "300 unidades en ambiente de selva", "Beach club exclusivo"],
    description: "Complejo residencial-vacacional de 300 unidades en un entorno de selva con beach club propio, administrado bajo la marca hotelera Wyndham Grand. El programa de renta hotelera lo hace ideal para inversionistas que buscan retorno sin complicaciones.",
    img: "linear-gradient(135deg, #0a4d3c 0%, #1a7a5a 30%, #2d9b6e 60%, #0d3d2e 100%)",
    accent: "#6DD4A8",
  },
  {
    id: 2, name: "Hoxul Residences", brand: "at Corasol",
    location: "Playa del Carmen", zone: "Comunidad Corasol, 450m del Mar Caribe",
    type: "Condominios y Penthouses", sizes: ["92 m²", "186 m²", "416 m²"],
    bedrooms: "2-5 recámaras", priceFrom: 345731, priceTo: 1578298,
    roi: "8-12%", roiNum: 10, delivery: "2026", badge: "EXCLUSIVO",
    unitsAvailable: 12, totalUnits: 40, featured: true,
    amenities: ["Terraza con vista al mar", "Rooftop pool con vista al océano", "Cenote artificial", "Pool bar", "Restaurant bar", "Sports bar", "Gimnasio premium", "Jacuzzis", "Alberca infantil", "Acceso a playa", "Seguridad 24/7"],
    highlights: ["Diseño Sordo Madaleno & Cuaik", "Dentro de Corasol master plan", "5,000 m² de paisajismo tropical", "Segmento ultra-premium"],
    description: "Diseñado por los reconocidos arquitectos Sordo Madaleno & Cuaik, Hoxul se encuentra dentro de la prestigiosa comunidad Corasol con 5,000 m² de paisajismo tropical. Posicionamiento oceanview para el segmento de lujo de Playa del Carmen.",
    img: "linear-gradient(135deg, #1a3a5c 0%, #2a5a8c 30%, #3a7ab0 60%, #0d2a4e 100%)",
    accent: "#7EB8F0",
  },
  {
    id: 3, name: "Zenesis", brand: "Tulum",
    location: "Tulum", zone: "10 min de la playa, 5 min del centro",
    type: "Condominios y Villas", sizes: ["65 m²", "85 m²", "120 m²", "180 m²"],
    bedrooms: "1-3 recámaras", priceFrom: 155000, priceTo: 400000,
    roi: "8-10%", roiNum: 9, delivery: "2025-2027", badge: "NUEVO",
    unitsAvailable: 38, totalUnits: 72, featured: false,
    amenities: ["Rooftop con plunge pool", "Corredores verdes", "Cancha de pickleball", "Club palapa", "Piscina", "Área BBQ", "Co-working", "Gimnasio", "Área infantil", "Seguridad 24/7", "Paneles solares"],
    highlights: ["60 condominios + 12 villas", "9 prototipos diferentes", "Plunge pools privados opcionales", "Precios de preventa"],
    description: "Comunidad de 60 condominios y 12 villas con 9 prototipos diferentes. Las unidades incluyen opciones de plunge pool privado y jardines en rooftop. Posicionado en una zona de alta plusvalía cerca del centro de Tulum.",
    img: "linear-gradient(135deg, #2d4a1a 0%, #4a7a2d 30%, #5d9a3a 60%, #1a3a0d 100%)",
    accent: "#8BC34A",
  },
  {
    id: 4, name: "Oniric", brand: "Tulum",
    location: "Tulum", zone: "Región 8 — La más cercana a la playa",
    type: "Condominios y Penthouses", sizes: ["106 m²", "150 m²", "200 m²", "250 m²"],
    bedrooms: "1-3 recámaras", priceFrom: 190000, priceTo: 500000,
    roi: "8-12%", roiNum: 10, delivery: "2026", badge: "ÚLTIMAS UNIDADES",
    unitsAvailable: 5, totalUnits: 27, featured: true,
    amenities: ["Cenote floral de 20m de diámetro", "Speakeasy bar", "Temazcal tradicional", "Rooftop pool", "Escaleras flotantes", "Diseño de baja densidad"],
    highlights: ["Solo 27 unidades exclusivas", "Cenote en forma de flor como pieza central", "Región 8 — mayor plusvalía de Tulum", "Arquitectura boutique única"],
    description: "Desarrollo exclusivo de baja densidad con solo 27 apartamentos privados en la Región 8 de Tulum. La pieza arquitectónica central es un dramático cenote en forma de flor con escaleras flotantes. Para compradores que buscan propiedades boutique únicas.",
    img: "linear-gradient(135deg, #0d2a4d 0%, #1a4a7a 30%, #2a6a9a 60%, #0a1e3e 100%)",
    accent: "#60A5FA",
  },
  {
    id: 5, name: "Kokoon Pueblo", brand: "",
    location: "Tulum", zone: "Región 15",
    type: "Villas y Departamentos", sizes: ["180 m²", "220 m²", "298 m²"],
    bedrooms: "2-3 recámaras", priceFrom: 257698, priceTo: 389850,
    roi: "8-10%", roiNum: 9, delivery: "2025-2026", badge: "EXCLUSIVO",
    unitsAvailable: 3, totalUnits: 10, featured: false,
    amenities: ["Jardín privado por unidad", "Rooftop privado con plunge pool", "Piscina comunal grande", "Lounge y sundeck", "Almacenamiento", "Estacionamiento", "Paneles solares", "Seguridad 24/7"],
    highlights: ["Solo 10 unidades totales", "Inspirado en pueblos yucatecos", "Jardín + rooftop + plunge pool privados", "Máxima privacidad"],
    description: "Desarrollo boutique inspirado en pueblos tradicionales yucatecos, con solo 10 unidades. Cada villa incluye jardín privado, rooftop y plunge pool, combinando la comodidad de una casa con la seguridad de un condominio.",
    img: "linear-gradient(135deg, #0d3d2e 0%, #1a6d4d 30%, #2d9a6e 60%, #082a1e 100%)",
    accent: "#34D399",
  },
  {
    id: 6, name: "Gran Tulum", brand: "at Selvazama",
    location: "Tulum", zone: "Aldea Zama / Selva Zama — Zona #1 Airbnb",
    type: "Estudios y Condominios", sizes: ["77 m²", "110 m²", "155 m²"],
    bedrooms: "Estudio, 2-3 recámaras", priceFrom: 251400, priceTo: 528000,
    roi: "10-13%", roiNum: 11.5, delivery: "2025-2027", badge: "MAYOR ROI",
    unitsAvailable: 22, totalUnits: 60, featured: true,
    amenities: ["Piscina", "Rooftop bar", "Spa", "Temazcal", "Área de yoga", "Anfiteatro", "Restaurante", "Estacionamiento bici", "Sistema Lock Off"],
    highlights: ["Aldea Zama: zona #1 de Airbnb en Tulum", "Sistema Lock Off para maximizar rentas", "ROI proyectado 10-13%", "Entrega escalonada 2025-2027"],
    description: "En la codiciada zona de Aldea Zama, la comunidad más establecida de Tulum para inversión vacacional. El sistema Lock Off permite dividir unidades en secciones rentables independientes, maximizando ocupación e ingresos.",
    img: "linear-gradient(135deg, #1a3d4d 0%, #2d5a7a 30%, #3d7a9a 60%, #0d2a3e 100%)",
    accent: "#5DC8D9",
  },
  {
    id: 7, name: "Senzik", brand: "Tulum Country Club",
    location: "Tulum", zone: "Corredor Akumal — Tulum Country Club",
    type: "Condominios de Lujo", sizes: ["180 m²", "220 m²", "280 m²"],
    bedrooms: "2-4 recámaras", priceFrom: 475000, priceTo: 561610,
    roi: "7-9%", roiNum: 8, delivery: "2026-2027", badge: "ULTRA PREMIUM",
    unitsAvailable: 6, totalUnits: 14, featured: false,
    amenities: ["Campo de golf PGA", "Beach club", "Parque central", "Áreas comerciales", "3 torres temáticas (Jungle, Pool Side, Cenote)", "Rooftop y piscinas privadas"],
    highlights: ["Solo 14 unidades de lujo", "Campo de golf certificado PGA", "Beach club dedicado", "Unidades de dos niveles con rooftop"],
    description: "Desarrollo exclusivo de solo 14 unidades de lujo distribuidas en tres torres temáticas: Jungle, Pool Side y Cenote. Ubicado dentro de Tulum Country Club con acceso a campo de golf PGA y beach club dedicado.",
    img: "linear-gradient(135deg, #0d2e1a 0%, #1a4d2d 30%, #2d6e3d 60%, #0a1e12 100%)",
    accent: "#4CAF50",
  },
  {
    id: 8, name: "Blue House Marina", brand: "Residences",
    location: "Puerto Aventuras", zone: "Comunidad de marina con muelle",
    type: "Condominios frente a Marina", sizes: ["120 m²", "165 m²", "210 m²"],
    bedrooms: "2-3 recámaras", priceFrom: 300000, priceTo: 600000,
    roi: "7-9%", roiNum: 8, delivery: "2026", badge: "NUEVO",
    unitsAvailable: 9, totalUnits: 19, featured: false,
    amenities: ["Acceso a marina y muelles", "Arquitectura europea", "Acceso a playa", "Campo de golf", "Comunidad cerrada 24/7", "Restaurantes y tiendas"],
    highlights: ["Única marina de servicio completo en Riviera Maya", "Arquitectura europea del siglo XIX", "Acceso directo a botes", "Popular con retirados americanos y canadienses"],
    description: "Arquitectura europea del siglo XIX fusionada con diseño caribeño moderno, en el distrito marina de Puerto Aventuras. La única comunidad de marina de servicio completo en la costa de la Riviera Maya.",
    img: "linear-gradient(135deg, #1a2a4d 0%, #2d4a7a 30%, #4a6a9a 60%, #0d1a3e 100%)",
    accent: "#64B5F6",
  },
];

const marketData = {
  avgPriceM2: "$3,600 USD/m²",
  yearGrowth: "14%",
  realGrowth: "8%",
  rentalROI: "8-15%",
  capitalAppreciation: "8-12%",
  occupancy: "75-90%",
  foreignOwnership: "Fideicomiso bancario (100% legal para extranjeros)",
  propertyTax: "Mínimo comparado con EE.UU./Canadá",
  infrastructure: ["Aeropuerto Internacional de Tulum (nuevo)", "Tren Maya conectando la región", "Carretera federal renovada"],
};

/* ─── Modal: Agregar Nueva Propiedad ─── */
const NewPropertyModal = ({ onClose, onSave, initialData = null, T = P }) => {
  const isLight = T !== P;
  const editing = !!initialData;
  const EMPTY = {
    name: "", brand: "", location: "Tulum", zone: "", type: "Condominios",
    priceFrom: "", priceTo: "", roi: "8-10%", delivery: "2026",
    bedrooms: "1-2 recámaras", sizes: "", badge: "NUEVO",
    description: "", highlights: "", amenities: "",
    accent: "#4ADE80", driveLink: "", unitsAvailable: "", totalUnits: "",
  };
  const [form, setForm] = useState(initialData ? {
    ...EMPTY,
    ...initialData,
    priceFrom: String(initialData.priceFrom || ""),
    priceTo: String(initialData.priceTo || ""),
    sizes: Array.isArray(initialData.sizes) ? initialData.sizes.join(", ") : (initialData.sizes || ""),
    highlights: Array.isArray(initialData.highlights) ? initialData.highlights.join(", ") : (initialData.highlights || ""),
    amenities: Array.isArray(initialData.amenities) ? initialData.amenities.join(", ") : (initialData.amenities || ""),
    unitsAvailable: String(initialData.unitsAvailable || ""),
    totalUnits: String(initialData.totalUnits || ""),
  } : EMPTY);
  const [errors, setErrors] = useState({});
  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(e => ({ ...e, [k]: false })); };
  const accentOptions = ["#4ADE80","#22D3EE","#6DD4A8","#34D399","#38BDF8","#7EB8F0","#2DD4BF","#86EFAC"];
  const badgeOptions = ["NUEVO","EXCLUSIVO","PREVENTA","ÚLTIMAS UNIDADES","MAYOR ROI","ULTRA PREMIUM"];
  const locationOptions = ["Tulum","Playa del Carmen","Puerto Morelos","Puerto Aventuras","Cancún","Bacalar","Akumal","Holbox"];
  const typeOptions = ["Condominios","Villas","Penthouses","Condominios y Penthouses","Villas y Departamentos","Estudios y Condominios","Condominios de Lujo","Casas"];

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = true;
    if (!form.priceFrom || isNaN(parseInt(form.priceFrom))) e.priceFrom = true;
    if (!form.priceTo || isNaN(parseInt(form.priceTo))) e.priceTo = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const prop = {
      id: initialData?.id || Date.now(),
      name: form.name.trim(), brand: form.brand.trim(),
      location: form.location, zone: form.zone.trim() || form.location,
      type: form.type,
      sizes: form.sizes ? form.sizes.split(",").map(s => s.trim()).filter(Boolean) : ["—"],
      bedrooms: form.bedrooms.trim() || "—",
      priceFrom: parseInt(form.priceFrom) || 0,
      priceTo: parseInt(form.priceTo) || 0,
      roi: form.roi.trim() || "8-10%",
      roiNum: parseFloat(form.roi) || 8,
      delivery: form.delivery.trim() || "2026",
      badge: form.badge,
      unitsAvailable: parseInt(form.unitsAvailable) || 10,
      totalUnits: parseInt(form.totalUnits) || 10,
      featured: initialData?.featured || false,
      accent: form.accent,
      amenities: form.amenities ? form.amenities.split(",").map(s => s.trim()).filter(Boolean) : [],
      highlights: form.highlights ? form.highlights.split(",").map(s => s.trim()).filter(Boolean) : [],
      description: form.description.trim(),
      img: `linear-gradient(135deg, ${form.accent}25 0%, ${form.accent}08 40%, #020406 100%)`,
      custom: true,
      driveLink: form.driveLink.trim(),
      createdAt: initialData?.createdAt || new Date().toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }),
      updatedAt: new Date().toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }),
    };
    onSave(prop);
    onClose();
  };

  const canSave = form.name.trim() && form.priceFrom && form.priceTo;

  const inputStyle = (key) => ({
    width: "100%", padding: "10px 14px", borderRadius: 8,
    background: T.glass, border: `1px solid ${errors[key] ? T.rose + "80" : T.border}`,
    color: T.txt, fontSize: 13, fontFamily: font, outline: "none",
    transition: "border-color 0.2s", boxSizing: "border-box",
  });
  const labelStyle = { fontSize: 10, color: T.txt2, display: "block", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: font };
  const sectionTitle = (accent) => ({ fontSize: 11, color: accent, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12, fontFamily: font });

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)", zIndex: 200000 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 200001,
        width: 680, maxHeight: "92vh", overflowY: "auto",
        background: isLight ? "#FFFFFF" : "#111318", border: `1px solid ${T.border}`, borderRadius: 22,
        boxShadow: isLight ? T.shadow3 || "0 40px 100px rgba(15,23,42,0.15)" : "0 40px 100px rgba(0,0,0,0.7)",
      }}>
        {/* Header with accent preview */}
        <div style={{
          padding: "22px 28px", borderBottom: `1px solid ${T.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: `linear-gradient(135deg, ${form.accent}10 0%, transparent 60%)`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: isLight ? `${form.accent}18` : `linear-gradient(135deg, ${form.accent}25 0%, #020406 100%)`,
              border: `1px solid ${form.accent}40`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Building2 size={20} color={form.accent} />
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>
                {editing ? "Editar Propiedad" : "Registrar Propiedad"}
              </p>
              <p style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>
                {editing ? `Editando: ${initialData.name}` : "Agrega un nuevo desarrollo al catálogo permanente"}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.border}`, background: T.glass, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} color={T.txt2} />
          </button>
        </div>

        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* SECCIÓN 1 — Identidad */}
          <div>
            <p style={sectionTitle(form.accent)}>Identidad del desarrollo</p>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Nombre del desarrollo *</label>
                <input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Ej: Almara Residences" style={inputStyle("name")}
                  onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=errors.name?P.rose+"80":P.border} />
                {errors.name && <p style={{fontSize:10,color:T.rose,marginTop:3}}>Campo requerido</p>}
              </div>
              <div>
                <label style={labelStyle}>Marca / Sub-nombre</label>
                <input value={form.brand} onChange={e=>set("brand",e.target.value)} placeholder="Ej: by Four Seasons" style={inputStyle("brand")}
                  onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=T.border} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Ubicación</label>
                <select value={form.location} onChange={e=>set("location",e.target.value)} style={{ ...inputStyle("location"), background: T.surface || T.glass, cursor: "pointer" }}>
                  {locationOptions.map(l=><option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Zona / Referencia</label>
                <input value={form.zone} onChange={e=>set("zone",e.target.value)} placeholder="Ej: Aldea Zama, frente al mar" style={inputStyle("zone")}
                  onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=T.border} />
              </div>
              <div>
                <label style={labelStyle}>Badge</label>
                <select value={form.badge} onChange={e=>set("badge",e.target.value)} style={{ ...inputStyle("badge"), background: T.surface || T.glass, cursor: "pointer" }}>
                  {badgeOptions.map(b=><option key={b}>{b}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2 — Precios y financiero */}
          <div style={{ paddingTop: 4, borderTop: `1px solid ${T.border}` }}>
            <p style={{ ...sectionTitle(form.accent), marginTop: 14 }}>Precios y financiero</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
              {[
                {k:"priceFrom",label:"Precio desde (USD) *",ph:"155000"},
                {k:"priceTo",label:"Precio hasta (USD) *",ph:"500000"},
                {k:"roi",label:"ROI anual",ph:"8-12%"},
                {k:"delivery",label:"Entrega estimada",ph:"2026"},
              ].map(f=>(
                <div key={f.k}>
                  <label style={labelStyle}>{f.label}</label>
                  <input value={form[f.k]} onChange={e=>set(f.k,e.target.value)} placeholder={f.ph} style={inputStyle(f.k)}
                    onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=errors[f.k]?T.rose+"80":T.border} />
                  {errors[f.k] && <p style={{fontSize:10,color:T.rose,marginTop:3}}>Requerido</p>}
                </div>
              ))}
            </div>
            {/* Preview pricing */}
            {form.priceFrom && form.priceTo && (
              <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                <div style={{ padding: "8px 14px", borderRadius: 8, background: `${form.accent}0A`, border: `1px solid ${form.accent}20`, fontSize: 12, color: form.accent, fontFamily: fontDisp }}>
                  Desde ${(parseInt(form.priceFrom)/1000).toFixed(0)}K USD
                </div>
                <div style={{ padding: "8px 14px", borderRadius: 8, background: T.glass, border: `1px solid ${T.border}`, fontSize: 12, color: T.txt2, fontFamily: fontDisp }}>
                  Hasta ${(parseInt(form.priceTo)/1000).toFixed(0)}K USD
                </div>
                {form.roi && <div style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", fontSize: 12, color: "#4ADE80", fontFamily: fontDisp }}>ROI {form.roi}</div>}
              </div>
            )}
          </div>

          {/* SECCIÓN 3 — Características */}
          <div style={{ paddingTop: 4, borderTop: `1px solid ${T.border}` }}>
            <p style={{ ...sectionTitle(form.accent), marginTop: 14 }}>Características</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Tipo</label>
                <select value={form.type} onChange={e=>set("type",e.target.value)} style={{ ...inputStyle("type"), background: T.surface || T.glass, cursor: "pointer" }}>
                  {typeOptions.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Recámaras</label>
                <input value={form.bedrooms} onChange={e=>set("bedrooms",e.target.value)} placeholder="1-3 recámaras" style={inputStyle("bedrooms")}
                  onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=T.border} />
              </div>
              <div>
                <label style={labelStyle}>Unidades disp.</label>
                <input value={form.unitsAvailable} onChange={e=>set("unitsAvailable",e.target.value)} placeholder="10" type="number" min="0" style={inputStyle("unitsAvailable")}
                  onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=T.border} />
              </div>
              <div>
                <label style={labelStyle}>Total unidades</label>
                <input value={form.totalUnits} onChange={e=>set("totalUnits",e.target.value)} placeholder="40" type="number" min="0" style={inputStyle("totalUnits")}
                  onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=T.border} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Tamaños disponibles (separados por coma)</label>
              <input value={form.sizes} onChange={e=>set("sizes",e.target.value)} placeholder="65 m², 85 m², 120 m², 180 m²" style={inputStyle("sizes")}
                onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=T.border} />
            </div>
          </div>

          {/* SECCIÓN 4 — Descripción y detalles */}
          <div style={{ paddingTop: 4, borderTop: `1px solid ${T.border}` }}>
            <p style={{ ...sectionTitle(form.accent), marginTop: 14 }}>Descripción y detalles</p>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Descripción del desarrollo</label>
              <textarea value={form.description} onChange={e=>set("description",e.target.value)} rows={3}
                placeholder="Describe el proyecto, su concepto, entorno y propuesta de valor..."
                style={{ ...inputStyle("description"), resize: "vertical", lineHeight: 1.6 }}
                onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=T.border} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Puntos clave — highlights (separados por coma)</label>
              <input value={form.highlights} onChange={e=>set("highlights",e.target.value)}
                placeholder="Rooftop con piscina, Cenote natural, Solo 14 unidades exclusivas"
                style={inputStyle("highlights")}
                onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=T.border} />
              {form.highlights && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                  {form.highlights.split(",").filter(h=>h.trim()).map((h,i)=>(
                    <span key={i} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, background: `${form.accent}10`, border: `1px solid ${form.accent}20`, color: form.accent }}>{h.trim()}</span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label style={labelStyle}>Amenidades (separadas por coma)</label>
              <input value={form.amenities} onChange={e=>set("amenities",e.target.value)}
                placeholder="Piscina, Rooftop, Gimnasio, Spa, Seguridad 24/7, Estacionamiento"
                style={inputStyle("amenities")}
                onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=T.border} />
              {form.amenities && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                  {form.amenities.split(",").filter(a=>a.trim()).map((a,i)=>(
                    <span key={i} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, background: T.glass, border: `1px solid ${T.border}`, color: T.txt2 }}>{a.trim()}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SECCIÓN 5 — Media y visual */}
          <div style={{ paddingTop: 4, borderTop: `1px solid ${T.border}` }}>
            <p style={{ ...sectionTitle(form.accent), marginTop: 14 }}>Media y visual</p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}>
                <ExternalLink size={10} color={T.accent} /> Link de galería de imágenes
                <span style={{ color: T.txt3, fontWeight: 400, textTransform: "none", marginLeft: 4 }}>— Google Drive, Dropbox o cualquier carpeta compartida</span>
              </label>
              <div style={{ position: "relative" }}>
                <ExternalLink size={13} color={form.driveLink ? form.accent : T.txt3} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", flexShrink: 0 }} />
                <input
                  value={form.driveLink} onChange={e => set("driveLink", e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  style={{ ...inputStyle("driveLink"), paddingLeft: 34, borderColor: form.driveLink ? form.accent + "50" : T.border }}
                  onFocus={e=>e.target.style.borderColor=form.accent+"80"} onBlur={e=>e.target.style.borderColor=form.driveLink?form.accent+"50":T.border}
                />
              </div>
              {form.driveLink && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                  <span style={{ fontSize: 10, color: "#4ADE80" }}>✓ Link configurado</span>
                  <a href={form.driveLink} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: form.accent, display: "flex", alignItems: "center", gap: 3 }}>
                    Verificar ↗
                  </a>
                </div>
              )}
            </div>
            <div>
              <label style={labelStyle}>Color de acento para la tarjeta</label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {accentOptions.map(c=>(
                  <button key={c} onClick={()=>set("accent",c)} title={c} style={{
                    width: 32, height: 32, borderRadius: 8, background: c,
                    border: form.accent===c ? `3px solid white` : "3px solid transparent",
                    cursor: "pointer", transition: "all 0.2s",
                    boxShadow: form.accent===c ? `0 0 12px ${c}80` : "none",
                  }} />
                ))}
                {/* Custom color */}
                <div style={{ position: "relative" }}>
                  <input type="color" value={form.accent} onChange={e=>set("accent",e.target.value)}
                    style={{ width: 32, height: 32, borderRadius: 8, border: "none", cursor: "pointer", padding: 2, background: "transparent" }} title="Color personalizado" />
                </div>
              </div>
              {/* Preview card */}
              <div style={{
                marginTop: 12, padding: "14px 18px", borderRadius: 12,
                background: `linear-gradient(135deg, ${form.accent}15 0%, #020406 100%)`,
                border: `1px solid ${form.accent}30`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: fontDisp }}>{form.name || "Nombre del desarrollo"}</p>
                  {form.brand && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{form.brand}</p>}
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    {form.badge && <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: `${form.accent}20`, border: `1px solid ${form.accent}30`, color: form.accent, fontWeight: 700, letterSpacing: "0.05em" }}>{form.badge}</span>}
                    {form.type && <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: P.glass, border: `1px solid ${P.border}`, color: P.txt2 }}>{form.type}</span>}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {form.priceFrom && <p style={{ fontSize: 18, fontWeight: 700, color: form.accent, fontFamily: fontDisp }}>${(parseInt(form.priceFrom)/1000).toFixed(0)}K</p>}
                  {form.roi && <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>ROI {form.roi}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, paddingTop: 8, borderTop: `1px solid ${T.border}`, marginTop: 4 }}>
            <button onClick={onClose} style={{ padding: "13px 20px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.glass, color: T.txt2, fontSize: 13, cursor: "pointer", fontFamily: font, whiteSpace: "nowrap" }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={!canSave} style={{
              flex: 1, padding: "13px", borderRadius: 10, border: "none",
              background: canSave ? `linear-gradient(135deg, ${form.accent} 0%, ${form.accent}CC 100%)` : T.glass,
              color: canSave ? "#060A11" : T.txt3,
              fontSize: 13, fontWeight: 700, cursor: canSave ? "pointer" : "not-allowed", fontFamily: fontDisp,
              transition: "all 0.2s",
              boxShadow: canSave ? `0 4px 20px ${form.accent}40` : "none",
            }}>
              {editing ? "Guardar cambios" : "Registrar en catálogo"} {canSave && "→"}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

/* ─── ROI Calculator ─── */
const ROICalc = ({ prop }) => {
  const [inv, setInv] = useState(prop.priceFrom);
  const roiPct = prop.roiNum / 100;
  const appPct = 0.10; // 10% annual appreciation
  const yearlyRental = inv * roiPct;
  const projections = [1,3,5,10].map(y => ({
    y, rental: yearlyRental * y,
    appreciation: inv * Math.pow(1 + appPct, y) - inv,
    total: yearlyRental * y + (inv * Math.pow(1 + appPct, y) - inv),
    propValue: inv * Math.pow(1 + appPct, y),
  }));
  const fmt = n => n >= 1000000 ? `$${(n/1000000).toFixed(2)}M` : `$${Math.round(n/1000)}K`;

  return (
    <div style={{ padding: "40px", background: "#030508", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <p style={{ fontSize: 11, color: prop.accent, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>CALCULADORA DE RETORNO</p>
        <h3 style={{ fontSize: 26, fontWeight: 300, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em", marginBottom: 8 }}>Proyección de Tu Inversión</h3>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 28 }}>Basado en ROI {prop.roi} + plusvalía histórica del 10% anual en la Riviera Maya</p>
        {/* Slider */}
        <div style={{ marginBottom: 28, padding: "20px 24px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Inversión inicial</span>
            <span style={{ fontSize: 28, fontWeight: 300, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.03em" }}>{fmt(inv)} USD</span>
          </div>
          <input type="range" min={prop.priceFrom} max={prop.priceTo} value={inv} onChange={e=>setInv(parseInt(e.target.value))} step={10000}
            style={{ width: "100%", accentColor: prop.accent, cursor: "pointer" }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{fmt(prop.priceFrom)}</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{fmt(prop.priceTo)}</span>
          </div>
        </div>
        {/* Projections */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {projections.map(pr=>(
            <div key={pr.y} style={{ padding: "18px 16px", borderRadius: 14, background: `${prop.accent}06`, border: `1px solid ${prop.accent}15` }}>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>{pr.y} {pr.y===1?"AÑO":"AÑOS"}</p>
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>Rentas acumuladas</p>
                <p style={{ fontSize: 16, fontWeight: 600, color: prop.accent, fontFamily: fontDisp }}>{fmt(pr.rental)}</p>
              </div>
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>Plusvalía</p>
                <p style={{ fontSize: 14, fontWeight: 500, color: P.emerald, fontFamily: fontDisp }}>+{fmt(pr.appreciation)}</p>
              </div>
              <div style={{ paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>Retorno total</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp }}>{fmt(pr.total)}</p>
              </div>
              <div style={{ marginTop: 8, padding: "6px 8px", borderRadius: 6, background: `${prop.accent}12` }}>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginBottom: 1 }}>Valor propiedad</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: prop.accent, fontFamily: fontDisp }}>{fmt(pr.propValue)}</p>
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 14, textAlign: "center" }}>* Proyecciones basadas en datos históricos del mercado. No garantizadas. Sujeto a condiciones del mercado.</p>
      </div>
    </div>
  );
};

/* ─── Map/Location visual ─── */
const RivieraMayaMap = ({ properties }) => {
  // Positions on simplified coastline map
  const locations = {
    "Cancún": { x: 82, y: 8 },
    "Puerto Morelos": { x: 76, y: 28 },
    "Playa del Carmen": { x: 68, y: 50 },
    "Puerto Aventuras": { x: 62, y: 62 },
    "Tulum": { x: 52, y: 78 },
    "Bacalar": { x: 38, y: 92 },
    "Akumal": { x: 58, y: 68 },
    "Holbox": { x: 30, y: 5 },
  };
  const propLocations = [...new Set(properties.map(p => p.location))];

  return (
    <div style={{ padding: "60px 40px", background: "#020406" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 40, alignItems: "center" }}>
        <div>
          <p style={{ fontSize: 11, color: P.accent, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>UBICACIÓN</p>
          <h3 style={{ fontSize: 26, fontWeight: 300, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em", marginBottom: 16 }}>Riviera Maya, México</h3>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: 20 }}>
            La Riviera Maya se extiende a lo largo de 120 km de costa caribeña. Con el nuevo Aeropuerto Internacional de Tulum y el Tren Maya, el acceso nunca ha sido mejor.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {propLocations.map(loc => (
              <div key={loc} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: properties.find(p=>p.location===loc)?.accent || P.accent, boxShadow: `0 0 8px ${properties.find(p=>p.location===loc)?.accent || P.accent}` }} />
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontFamily: font }}>{loc}</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>— {properties.filter(p=>p.location===loc).length} propiedad{properties.filter(p=>p.location===loc).length>1?"es":""}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, display: "flex", gap: 16 }}>
            {[{l:"Cancún →",d:"15-45 min"},{l:"Playa del Carmen →",d:"5-90 min"},{l:"Aeropuerto Tulum →",d:"Nuevo 2025"}].map(r=>(
              <div key={r.l} style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{r.l}</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#FFFFFF", fontFamily: fontDisp }}>{r.d}</p>
              </div>
            ))}
          </div>
        </div>
        {/* SVG Map */}
        <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", background: "#020408" }}>
          <svg width="100%" viewBox="0 0 120 110" xmlns="http://www.w3.org/2000/svg">
            {/* Caribbean Sea */}
            <rect width="120" height="110" fill="#030d1a"/>
            {/* Coastline */}
            <path d="M90 0 Q88 10 85 20 Q82 30 78 38 Q72 48 68 55 Q62 65 58 72 Q54 80 50 90 Q45 100 42 110 L120 110 L120 0 Z" fill="#0a2040" opacity="0.8"/>
            {/* Land */}
            <path d="M90 0 Q88 10 85 20 Q82 30 78 38 Q72 48 68 55 Q62 65 58 72 Q54 80 50 90 Q45 100 42 110 L0 110 L0 0 Z" fill="#0f1f0a" opacity="0.9"/>
            {/* Caribbean text */}
            <text x="100" y="55" fill="#1a4a7a" fontSize="5" opacity="0.6" fontFamily="sans-serif" transform="rotate(-70 100 55)">Mar Caribe</text>
            {/* Road/highway */}
            <path d="M85 18 Q82 28 78 36 Q72 46 68 53 Q62 63 58 70 Q54 78 50 88" stroke="#2a3a1a" strokeWidth="1.5" fill="none" strokeDasharray="2,1"/>
            {/* City dots */}
            {Object.entries(locations).map(([city, pos]) => {
              const isProp = propLocations.includes(city);
              const propAccent = isProp ? (properties.find(p=>p.location===city)?.accent || P.accent) : null;
              return (
                <g key={city}>
                  {isProp && <circle cx={pos.x} cy={pos.y} r="5" fill={propAccent} opacity="0.15"/>}
                  <circle cx={pos.x} cy={pos.y} r={isProp?"3":"1.5"} fill={isProp ? propAccent : "rgba(255,255,255,0.3)"} opacity={isProp?0.9:0.5}/>
                  <text x={pos.x+4} y={pos.y+1} fill="white" fontSize="3.5" opacity={isProp?0.8:0.4} fontFamily="sans-serif">{city}</text>
                </g>
              );
            })}
            {/* Airport icon */}
            <text x="73" y="79" fill="#FFD700" fontSize="5" opacity="0.5">✈</text>
            <text x="73" y="83" fill="#FFD700" fontSize="2.5" opacity="0.4" fontFamily="sans-serif">TULUM</text>
          </svg>
        </div>
      </div>
    </div>
  );
};

const LandingPages = ({ T = P }) => {
  const isLight = T !== P;
  const [step, setStep] = useState(0);
  const [clientName, setClientName] = useState("");
  const [clientBudgetMin, setClientBudgetMin] = useState(120000);
  const [clientBudgetMax, setClientBudgetMax] = useState(600000);
  const [clientPrefs, setClientPrefs] = useState({ beach: false, golf: false, marina: false, jungle: false, investment: false, retirement: false, family: false, boutique: false });
  const [selectedProps, setSelectedProps] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [customProperties, setCustomProperties] = useState(() => {
    try { return JSON.parse(localStorage.getItem("stratos_custom_props") || "[]"); } catch { return []; }
  });
  const [showNewPropModal, setShowNewPropModal] = useState(false);
  const [editingProp, setEditingProp] = useState(null);
  const [showCatalogSection, setShowCatalogSection] = useState(false);
  const [savedPages, setSavedPages] = useState([
    { id: 1, client: "Fam. Rodríguez", date: "3 Abr 2026", props: 3, status: "Enviada", budget: "$280K-$1.2M", opens: 4, asesor: "Ken Lugo Ríos" },
    { id: 2, client: "James Mitchell", date: "2 Abr 2026", props: 4, status: "Vista", budget: "$180K-$650K", opens: 2, asesor: "Emmanuel Ortiz" },
    { id: 3, client: "Sarah Williams", date: "1 Abr 2026", props: 2, status: "Generada", budget: "$300K-$600K", opens: 0, asesor: "Cecilia Mendoza" },
  ]);
  const [asesor, setAsesor] = useState("Emmanuel Ortiz");
  const [asesorWA, setAsesorWA] = useState("+52 998 000 0002");
  const [asesorCal, setAsesorCal] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [lpTheme, setLpTheme] = useState("dark");
  const [generatedId, setGeneratedId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  // Drive links per property (id → url), persisted in localStorage
  const [driveLinks, setDriveLinks] = useState(() => {
    try { return JSON.parse(localStorage.getItem("stratos_drive_links") || "{}"); } catch { return {}; }
  });
  const [editingLinkId, setEditingLinkId] = useState(null);
  const [editLinkValue, setEditLinkValue] = useState("");
  const [agencyName, setAgencyName] = useState(() => localStorage.getItem("stratos_agency_name") || "STRATOS REALTY");

  // Persist drive links to localStorage whenever they change
  useEffect(() => {
    try { localStorage.setItem("stratos_drive_links", JSON.stringify(driveLinks)); } catch {}
  }, [driveLinks]);

  // Persist custom properties to localStorage whenever they change
  useEffect(() => {
    try { localStorage.setItem("stratos_custom_props", JSON.stringify(customProperties)); } catch {}
  }, [customProperties]);

  const saveCustomProp = (prop) => {
    setCustomProperties(prev => {
      const exists = prev.find(p => p.id === prop.id);
      return exists ? prev.map(p => p.id === prop.id ? prop : p) : [prop, ...prev];
    });
    // Also update driveLinks if the prop has one
    if (prop.driveLink) {
      setDriveLinks(prev => ({ ...prev, [prop.id]: prop.driveLink }));
    }
  };

  const deleteCustomProp = (id) => {
    setCustomProperties(prev => prev.filter(p => p.id !== id));
    setDriveLinks(prev => { const n = { ...prev }; delete n[id]; return n; });
    setSelectedProps(prev => prev.filter(x => x !== id));
  };

  // When asesor changes, auto-fill contact info from team data
  useEffect(() => {
    const member = team.find(t => t.n === asesor);
    if (member) { setAsesorWA(member.wa || ""); setAsesorCal(member.cal || ""); }
  }, [asesor]);

  const budgetOptions = [
    { label: "$120K", value: 120000 },
    { label: "$200K", value: 200000 },
    { label: "$300K", value: 300000 },
    { label: "$400K", value: 400000 },
    { label: "$500K", value: 500000 },
    { label: "$750K", value: 750000 },
    { label: "$1M+", value: 1000000 },
    { label: "$1.5M+", value: 1500000 },
  ];

  const prefOptions = [
    { key: "beach", label: "Cerca de playa", icon: Waves },
    { key: "golf", label: "Campo de golf", icon: Palmtree },
    { key: "marina", label: "Marina/Náutico", icon: Waves },
    { key: "jungle", label: "Entorno de selva", icon: Palmtree },
    { key: "investment", label: "Alta rentabilidad", icon: TrendingUp },
    { key: "retirement", label: "Retiro/Lifestyle", icon: Heart },
    { key: "family", label: "Familiar", icon: Users },
    { key: "boutique", label: "Boutique/Exclusivo", icon: Crown },
  ];

  const allProperties = useMemo(() => [...rivieraProperties, ...customProperties], [customProperties]);

  const inBudget = (p) => p.priceFrom <= clientBudgetMax && p.priceTo >= clientBudgetMin;
  const filteredProperties = useMemo(() => {
    const inB = allProperties.filter(p => inBudget(p));
    const outB = allProperties.filter(p => !inBudget(p));
    return [...inB, ...outB];
  }, [allProperties, clientBudgetMin, clientBudgetMax]);

  const saveDriveLink = (propId) => {
    setDriveLinks(prev => ({ ...prev, [propId]: editLinkValue }));
    // Also persist link inside the custom property object itself
    setCustomProperties(prev => prev.map(p => p.id === propId ? { ...p, driveLink: editLinkValue } : p));
    setEditingLinkId(null);
    setEditLinkValue("");
  };

  const startEditLink = (propId, currentLink, e) => {
    e.stopPropagation();
    setEditingLinkId(propId);
    setEditLinkValue(currentLink || "");
  };

  const toggleProp = (id) => {
    setSelectedProps(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleGenerate = () => {
    const newId = Date.now();
    setGeneratedId(newId);
    setSavedPages(prev => [{
      id: newId,
      client: clientName || "Cliente",
      date: new Date().toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }),
      propIds: [...selectedProps],
      props: selectedProps.length,
      status: "Generada",
      budget: `$${(clientBudgetMin / 1000).toFixed(0)}K-$${(clientBudgetMax / 1000).toFixed(0)}K`,
      asesor,
    }, ...prev]);
    setPreviewOpen(true);
  };

  const handleCopyLink = () => {
    const demoUrl = `${window.location.origin}${window.location.pathname}?lp=${generatedId || "preview"}&c=${encodeURIComponent(clientName || "cliente")}`;
    navigator.clipboard.writeText(demoUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const resetForm = () => {
    setStep(0);
    setClientName("");
    setClientBudgetMin(120000);
    setClientBudgetMax(500000);
    setClientPrefs({ beach: false, golf: false, marina: false, jungle: false, investment: false, retirement: false, family: false, boutique: false });
    setSelectedProps([]);
    setMensaje("");
    setGeneratedId(null);
    setShowShareModal(false);
  };

  const statusColors = { Generada: T.blue, Enviada: T.emerald, Vista: T.accent, Expirada: T.rose };

  // ─── Step 0: Lista de Landing Pages ───
  if (step === 0) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <p style={{ fontSize: 21, fontWeight: 400, color: isLight ? T.txt : "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em" }}>
            Marketing <span style={{ fontWeight: 300, color: isLight ? T.txt3 : "rgba(255,255,255,0.4)" }}>Studio</span>
          </p>
          <p style={{ fontSize: 12, color: T.txt3, fontFamily: font, marginTop: 4 }}>Crea campañas y presentaciones de propiedades con IA en un clic</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setShowNewPropModal(true)} style={{
            display: "flex", alignItems: "center", gap: 7, padding: "11px 18px",
            borderRadius: 11, border: `1px solid ${T.accent}40`, background: T.accentS,
            cursor: "pointer", color: T.accent, fontSize: 13, fontWeight: 600, fontFamily: fontDisp,
            transition: "all 0.22s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = T.accentB; e.currentTarget.style.borderColor = T.accent + "70"; }}
            onMouseLeave={e => { e.currentTarget.style.background = T.accentS; e.currentTarget.style.borderColor = T.accent + "40"; }}
          >
            <Plus size={15} /> Registrar propiedad
          </button>
          <button onClick={() => setStep(1)} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "11px 22px",
            borderRadius: 11, border: isLight ? "none" : "none", cursor: "pointer",
            background: isLight ? T.accent : "rgba(255,255,255,0.95)",
            color: isLight ? "#FFFFFF" : "#0A0F18",
            fontSize: 13, fontWeight: 700, fontFamily: fontDisp,
            boxShadow: isLight ? T.shadowMint || "0 4px 16px rgba(13,154,118,0.25)" : "0 4px 20px rgba(255,255,255,0.15)",
            transition: "all 0.25s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = isLight ? (T.accentDark || T.accent) : "#FFFFFF"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = isLight ? T.accent : "rgba(255,255,255,0.95)"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            <Wand2 size={15} /> Nueva Landing Page
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <KPI label="Pages Generadas" value={savedPages.length} sub="total" icon={Globe} color={T.blue} T={T} />
        <KPI label="Propiedades en catálogo" value={rivieraProperties.length + customProperties.length} sub={`${customProperties.length} registradas`} icon={Building2} color={T.emerald} T={T} />
        <KPI label="Tasa de Apertura" value="87%" sub="+12%" icon={Eye} color={T.accent} T={T} />
        <KPI label="Conversión a Zoom" value="34%" sub="+8pp" icon={Target} color={T.violet} T={T} />
      </div>

      {/* Landing Pages Recientes */}
      <G np T={T}>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${T.border}` }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Campañas Recientes</p>
          <Pill color={T.accent} s isLight={isLight}>{savedPages.length} páginas</Pill>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.8fr 0.8fr 1fr 0.8fr 0.8fr", gap: 10, padding: "10px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 10, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>
          <span>Cliente</span><span>Fecha</span><span>Props.</span><span>Presupuesto</span><span>Status</span><span>Asesor</span><span>Acciones</span>
        </div>
        {savedPages.map(pg => (
          <div key={pg.id} style={{
            display: "grid", gridTemplateColumns: "2fr 1fr 0.8fr 0.8fr 1fr 0.8fr 0.8fr",
            gap: 10, alignItems: "center", padding: "13px 20px", borderBottom: `1px solid ${T.border}`,
            transition: "background 0.2s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.02)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Ico icon={User} sz={30} is={13} c={T.accent} />
              <span style={{ fontSize: 13, color: T.txt, fontWeight: 600, fontFamily: fontDisp }}>{pg.client}</span>
            </div>
            <span style={{ fontSize: 11, color: T.txt2, fontFamily: font }}>{pg.date}</span>
            <span style={{ fontSize: 12, color: T.txt, fontWeight: 500, fontFamily: fontDisp }}>{pg.props}</span>
            <span style={{ fontSize: 11, color: T.emerald, fontWeight: 600, fontFamily: fontDisp }}>{pg.budget}</span>
            <Pill color={statusColors[pg.status] || T.txt3} s isLight={isLight}>{pg.status}</Pill>
            <span style={{ fontSize: 11, color: T.txt2, fontFamily: font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pg.asesor?.split(" ")[0] || "—"}</span>
            <div style={{ display: "flex", gap: 5 }}>
              <button onClick={() => { setClientName(pg.client); setSelectedProps(pg.propIds || allProperties.slice(0, pg.props).map(p => p.id)); setPreviewOpen(true); }} style={{ padding: "5px 7px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.glass, cursor: "pointer", display: "flex", alignItems: "center" }}><Eye size={11} color={T.txt2} /></button>
              <button onClick={handleCopyLink} style={{ padding: "5px 7px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.glass, cursor: "pointer", display: "flex", alignItems: "center" }}>{copied ? <Check size={11} color={T.accent} /> : <Copy size={11} color={T.txt2} />}</button>
              <button style={{ padding: "5px 7px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.glass, cursor: "pointer", display: "flex", alignItems: "center" }}><Share2 size={11} color={T.txt2} /></button>
            </div>
          </div>
        ))}
      </G>

      {/* Catálogo de Propiedades */}
      <G np T={T}>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: showCatalogSection ? `1px solid ${T.border}` : "none", cursor: "pointer" }}
          onClick={() => setShowCatalogSection(s => !s)}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Ico icon={Building2} sz={30} is={14} c={T.emerald} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Catálogo de Propiedades</p>
              <p style={{ fontSize: 11, color: T.txt3, marginTop: 1 }}>
                {rivieraProperties.length} predeterminadas · <span style={{ color: customProperties.length > 0 ? T.accent : T.txt3 }}>{customProperties.length} registradas por el equipo</span>
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={e => { e.stopPropagation(); setShowNewPropModal(true); }} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
              borderRadius: 8, border: `1px solid ${T.accent}40`, background: T.accentS,
              cursor: "pointer", color: T.accent, fontSize: 12, fontWeight: 700, fontFamily: fontDisp,
              transition: "all 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = T.accentB; }}
              onMouseLeave={e => { e.currentTarget.style.background = T.accentS; }}
            >
              <Plus size={13} /> Registrar nueva
            </button>
            <div style={{ color: T.txt3, transition: "transform 0.2s", transform: showCatalogSection ? "rotate(180deg)" : "none" }}>
              <ChevronDown size={16} />
            </div>
          </div>
        </div>

        {showCatalogSection && (
          <div style={{ padding: "16px 20px" }}>
            {/* Custom properties */}
            {customProperties.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, color: T.accent, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
                  Registradas por el equipo ({customProperties.length})
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                  {customProperties.map(prop => (
                    <div key={prop.id} style={{
                      borderRadius: 12, overflow: "hidden",
                      background: isLight ? `${prop.accent}08` : `linear-gradient(135deg, ${prop.accent}12 0%, #020406 100%)`,
                      border: `1px solid ${prop.accent}25`,
                    }}>
                      {/* Card header */}
                      <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: `${prop.accent}20`, border: `1px solid ${prop.accent}30`, color: prop.accent, fontWeight: 700, letterSpacing: "0.05em" }}>{prop.badge}</span>
                            <span style={{ fontSize: 9, color: T.txt3, fontFamily: font }}>{prop.location}</span>
                          </div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.01em" }}>{prop.name}</p>
                          {prop.brand && <p style={{ fontSize: 11, color: T.txt3 }}>{prop.brand}</p>}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: prop.accent, fontFamily: fontDisp }}>${(prop.priceFrom / 1000).toFixed(0)}K</p>
                          <p style={{ fontSize: 10, color: T.txt3 }}>ROI {prop.roi}</p>
                        </div>
                      </div>
                      {/* Drive link status */}
                      <div style={{ padding: "8px 16px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <ExternalLink size={11} color={driveLinks[prop.id] || prop.driveLink ? prop.accent : T.txt3} />
                          <span style={{ fontSize: 10, color: driveLinks[prop.id] || prop.driveLink ? prop.accent : T.txt3 }}>
                            {driveLinks[prop.id] || prop.driveLink ? "Galería configurada" : "Sin galería"}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 5 }}>
                          <button onClick={() => { setEditingProp(prop); setShowNewPropModal(true); }} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.glass, cursor: "pointer", color: T.txt2, fontSize: 10, fontFamily: font, transition: "all 0.2s" }}
                            onMouseEnter={e => { e.currentTarget.style.color = T.txt; e.currentTarget.style.borderColor = T.borderH; }}
                            onMouseLeave={e => { e.currentTarget.style.color = T.txt2; e.currentTarget.style.borderColor = T.border; }}
                          >
                            <FileText size={10} /> Editar
                          </button>
                          <button onClick={() => { if (window.confirm(`¿Eliminar "${prop.name}" del catálogo?`)) deleteCustomProp(prop.id); }} style={{ display: "flex", alignItems: "center", padding: "4px 8px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.glass, cursor: "pointer", color: T.rose, fontSize: 10, transition: "all 0.2s" }}
                            onMouseEnter={e => { e.currentTarget.style.background = `${T.rose}18`; e.currentTarget.style.borderColor = T.rose + "40"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = T.glass; e.currentTarget.style.borderColor = T.border; }}
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                      {prop.createdAt && (
                        <div style={{ padding: "4px 16px 8px", fontSize: 9, color: T.txt3, fontFamily: font }}>
                          Registrada: {prop.createdAt}{prop.updatedAt && prop.updatedAt !== prop.createdAt ? ` · Editada: ${prop.updatedAt}` : ""}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Default properties summary */}
            <div>
              <p style={{ fontSize: 11, color: T.txt2, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
                Propiedades Riviera Maya ({rivieraProperties.length})
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
                {rivieraProperties.map(prop => {
                  const dl = driveLinks[prop.id] || prop.driveLink || "";
                  return (
                    <div key={prop.id} style={{
                      padding: "12px 14px", borderRadius: 10,
                      background: `${prop.accent}06`, border: `1px solid ${prop.accent}18`,
                      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: T.txt, fontFamily: fontDisp, letterSpacing: "-0.01em" }}>{prop.name}</p>
                        <p style={{ fontSize: 10, color: T.txt3 }}>{prop.location} · ${(prop.priceFrom/1000).toFixed(0)}K–${(prop.priceTo/1000).toFixed(0)}K · ROI {prop.roi}</p>
                      </div>
                      <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                        {editingLinkId === prop.id ? (
                          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                            <input
                              autoFocus
                              value={editLinkValue}
                              onChange={e => setEditLinkValue(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") saveDriveLink(prop.id); if (e.key === "Escape") { setEditingLinkId(null); setEditLinkValue(""); } }}
                              placeholder="Link Drive..."
                              style={{ padding: "4px 8px", borderRadius: 6, fontSize: 10, background: T.glass, border: `1px solid ${T.accent}50`, color: T.txt, fontFamily: font, outline: "none", width: 180 }}
                            />
                            <button onClick={() => saveDriveLink(prop.id)} style={{ padding: "4px 9px", borderRadius: 5, border: "none", background: T.accent, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>OK</button>
                            <button onClick={() => { setEditingLinkId(null); setEditLinkValue(""); }} style={{ padding: "4px 6px", borderRadius: 5, border: `1px solid ${T.border}`, background: T.glass, cursor: "pointer", color: T.txt3 }}><X size={10} /></button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                            {dl && <a href={dl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 9px", borderRadius: 6, border: `1px solid ${prop.accent}40`, background: `${prop.accent}10`, color: prop.accent, fontSize: 10, fontWeight: 700, textDecoration: "none" }}><Image size={10} /> Galería</a>}
                            <button onClick={e => { e.stopPropagation(); startEditLink(prop.id, dl, e); }} style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 9px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.glass, cursor: "pointer", color: T.txt2, fontSize: 10, fontFamily: font }}>
                              <FileText size={9} /> {dl ? "Editar link" : "Añadir link"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {customProperties.length === 0 && (
              <div style={{ textAlign: "center", padding: "24px 0 8px" }}>
                <p style={{ fontSize: 13, color: T.txt2, fontFamily: fontDisp, marginBottom: 8 }}>Aún no has registrado propiedades personalizadas</p>
                <p style={{ fontSize: 11, color: T.txt3, marginBottom: 16 }}>Registra desarrollos adicionales para incluirlos en tus landing pages</p>
                <button onClick={() => setShowNewPropModal(true)} style={{
                  display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px",
                  borderRadius: 10, border: `1px solid ${T.accent}40`, background: T.accentS,
                  cursor: "pointer", color: T.accent, fontSize: 13, fontWeight: 700, fontFamily: fontDisp,
                }}>
                  <Plus size={15} /> Registrar primera propiedad
                </button>
              </div>
            )}
          </div>
        )}
      </G>

      {/* Quick Market Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <G T={T}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Ico icon={TrendingUp} sz={32} is={15} c={T.emerald} />
            <p style={{ fontSize: 13, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Mercado Riviera Maya</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { l: "Precio promedio", v: marketData.avgPriceM2 },
              { l: "Crecimiento anual", v: marketData.yearGrowth },
              { l: "Plusvalía real", v: marketData.realGrowth },
            ].map(x => (
              <div key={x.l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 11, color: T.txt2 }}>{x.l}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.emerald, fontFamily: fontDisp }}>{x.v}</span>
              </div>
            ))}
          </div>
        </G>
        <G T={T}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Ico icon={DollarSign} sz={32} is={15} c={T.accent} />
            <p style={{ fontSize: 13, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Rendimientos</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { l: "ROI por rentas", v: marketData.rentalROI },
              { l: "Plusvalía capital", v: marketData.capitalAppreciation },
              { l: "Ocupación promedio", v: marketData.occupancy },
            ].map(x => (
              <div key={x.l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 11, color: T.txt2 }}>{x.l}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.accent, fontFamily: fontDisp }}>{x.v}</span>
              </div>
            ))}
          </div>
        </G>
        <G T={T}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Ico icon={Shield} sz={32} is={15} c={T.blue} />
            <p style={{ fontSize: 13, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Para Inversionistas</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { l: "Propiedad extranjera", v: "100% legal" },
              { l: "Impuesto predial", v: "Mínimo" },
              { l: "Aeropuerto Tulum", v: "Nuevo" },
            ].map(x => (
              <div key={x.l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 11, color: T.txt2 }}>{x.l}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.blue, fontFamily: fontDisp }}>{x.v}</span>
              </div>
            ))}
          </div>
        </G>
      </div>

      {/* New Property Modal accessible from step 0 */}
      {showNewPropModal && (
        <NewPropertyModal
          onClose={() => { setShowNewPropModal(false); setEditingProp(null); }}
          onSave={saveCustomProp}
          initialData={editingProp}
          T={T}
        />
      )}
    </div>
  );

  // ─── Step 1: Datos del Cliente ───
  if (step === 1) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 700, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={() => setStep(0)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.glass, cursor: "pointer", color: T.txt2, fontSize: 12, fontFamily: font, display: "flex", alignItems: "center", gap: 4 }}>
          <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Atrás
        </button>
        <div>
          <p style={{ fontSize: 18, fontWeight: 600, color: isLight ? T.txt : "#FFFFFF", fontFamily: fontDisp }}>Crear Landing Page</p>
          <p style={{ fontSize: 11, color: T.txt3, fontFamily: font }}>Paso 1 de 2 — Información del cliente</p>
        </div>
      </div>

      {/* Progress */}
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, height: 3, borderRadius: 2, background: T.accent, boxShadow: `0 0 8px ${T.accent}40` }} />
        <div style={{ flex: 1, height: 3, borderRadius: 2, background: T.border }} />
      </div>

      <G T={T}>
        <p style={{ fontSize: 14, fontWeight: 700, color: T.txt, marginBottom: 16, fontFamily: fontDisp }}>Datos del Cliente</p>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, color: T.txt2, display: "block", marginBottom: 6, fontWeight: 600, letterSpacing: "0.03em" }}>Nombre del cliente</label>
          <input
            type="text" value={clientName} onChange={e => setClientName(e.target.value)}
            placeholder="Ej: Familia Rodríguez, James Mitchell..."
            style={{
              width: "100%", padding: "12px 16px", borderRadius: 10, fontSize: 14,
              background: T.glass, border: `1px solid ${T.border}`, color: T.txt,
              fontFamily: font, outline: "none", transition: "border-color 0.2s",
            }}
            onFocus={e => e.target.style.borderColor = T.accent + "60"}
            onBlur={e => e.target.style.borderColor = T.border}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, color: T.txt2, display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontWeight: 600, letterSpacing: "0.03em" }}>
            <Building2 size={11} color={T.accent} /> Nombre de la agencia / bróker
          </label>
          <input
            type="text" value={agencyName}
            onChange={e => { setAgencyName(e.target.value); localStorage.setItem("stratos_agency_name", e.target.value); }}
            placeholder="Ej: STRATOS REALTY, Inmobiliaria Azul, RE/MAX Elite…"
            style={{ width: "100%", padding: "10px 14px", borderRadius: 9, fontSize: 13, background: T.glass, border: `1px solid ${T.accentB}`, color: T.txt, fontFamily: font, outline: "none" }}
            onFocus={e => e.target.style.borderColor = T.accent + "60"}
            onBlur={e => e.target.style.borderColor = T.accentB}
          />
          <p style={{ fontSize: 10, color: T.txt3, marginTop: 4 }}>Aparece en el encabezado de la landing page del cliente. Se guarda automáticamente.</p>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, color: T.txt2, display: "block", marginBottom: 6, fontWeight: 600, letterSpacing: "0.03em" }}>Asesor asignado</label>
          <select value={asesor} onChange={e => setAsesor(e.target.value)} style={{
            width: "100%", padding: "12px 16px", borderRadius: 10, fontSize: 13,
            background: T.surface || T.glass, border: `1px solid ${T.border}`, color: T.txt,
            fontFamily: font, cursor: "pointer",
          }}>
            {team.map(t => <option key={t.n} value={t.n}>{t.n} — {t.r}</option>)}
          </select>
        </div>

        {/* Asesor contact info */}
        <div style={{ marginBottom: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: T.txt2, display: "flex", alignItems: "center", gap: 5, marginBottom: 6, fontWeight: 600, letterSpacing: "0.03em" }}>
              <Phone size={11} color={T.emerald} /> WhatsApp del asesor
            </label>
            <input
              type="text" value={asesorWA} onChange={e => setAsesorWA(e.target.value)}
              placeholder="+52 998 000 0000"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 9, fontSize: 13, background: T.glass, border: `1px solid ${asesorWA ? T.emerald + "50" : T.border}`, color: T.txt, fontFamily: font, outline: "none" }}
              onFocus={e => e.target.style.borderColor = T.emerald + "70"}
              onBlur={e => e.target.style.borderColor = asesorWA ? T.emerald + "50" : T.border}
            />
            {asesorWA && (
              <a href={`https://wa.me/${asesorWA.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: T.emerald, marginTop: 4, display: "inline-block" }}>
                Verificar número →
              </a>
            )}
          </div>
          <div>
            <label style={{ fontSize: 11, color: T.txt2, display: "flex", alignItems: "center", gap: 5, marginBottom: 6, fontWeight: 600, letterSpacing: "0.03em" }}>
              <CalendarDays size={11} color={T.blue} /> Link de agenda (Calendly, Cal.com…)
            </label>
            <input
              type="text" value={asesorCal} onChange={e => setAsesorCal(e.target.value)}
              placeholder="https://calendly.com/..."
              style={{ width: "100%", padding: "10px 14px", borderRadius: 9, fontSize: 13, background: T.glass, border: `1px solid ${asesorCal ? T.blue + "50" : T.border}`, color: T.txt, fontFamily: font, outline: "none" }}
              onFocus={e => e.target.style.borderColor = T.blue + "70"}
              onBlur={e => e.target.style.borderColor = asesorCal ? T.blue + "50" : T.border}
            />
            {asesorCal && (
              <a href={asesorCal} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: T.blue, marginTop: 4, display: "inline-block" }}>
                Verificar link →
              </a>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, color: T.txt2, display: "block", marginBottom: 8, fontWeight: 600, letterSpacing: "0.03em" }}>Rango de presupuesto</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, color: T.txt3, marginBottom: 4 }}>Desde</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {budgetOptions.slice(0, 5).map(b => (
                  <button key={b.value} onClick={() => setClientBudgetMin(b.value)} style={{
                    padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${clientBudgetMin === b.value ? T.accent + "60" : T.border}`,
                    background: clientBudgetMin === b.value ? T.accentS : T.glass,
                    color: clientBudgetMin === b.value ? T.accent : T.txt2,
                    cursor: "pointer", fontFamily: fontDisp, transition: "all 0.2s",
                  }}>{b.label}</button>
                ))}
              </div>
            </div>
            <div style={{ color: T.txt3, fontSize: 14 }}>—</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, color: T.txt3, marginBottom: 4 }}>Hasta</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {budgetOptions.slice(2).map(b => (
                  <button key={b.value} onClick={() => setClientBudgetMax(b.value)} style={{
                    padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${clientBudgetMax === b.value ? T.accent + "60" : T.border}`,
                    background: clientBudgetMax === b.value ? T.accentS : T.glass,
                    color: clientBudgetMax === b.value ? T.accent : T.txt2,
                    cursor: "pointer", fontFamily: fontDisp, transition: "all 0.2s",
                  }}>{b.label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, color: T.txt2, display: "block", marginBottom: 8, fontWeight: 600, letterSpacing: "0.03em" }}>Preferencias del cliente</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {prefOptions.map(pref => {
              const active = clientPrefs[pref.key];
              return (
                <button key={pref.key} onClick={() => setClientPrefs(prev => ({ ...prev, [pref.key]: !prev[pref.key] }))} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  padding: "14px 8px", borderRadius: 10,
                  border: `1px solid ${active ? T.accent + "50" : T.border}`,
                  background: active ? T.accentS : T.glass,
                  cursor: "pointer", transition: "all 0.2s",
                }}>
                  <pref.icon size={18} color={active ? T.accent : T.txt3} />
                  <span style={{ fontSize: 10, color: active ? T.accent : T.txt2, fontWeight: 600, fontFamily: font, textAlign: "center" }}>{pref.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <WriterSection value={mensaje} onChange={setMensaje} clientName={clientName} T={T} />
      </G>

      <button onClick={() => setStep(2)} disabled={!clientName.trim()} style={{
        padding: "14px 28px", borderRadius: 12, border: "none", cursor: clientName.trim() ? "pointer" : "not-allowed",
        background: clientName.trim() ? (isLight ? T.accent : "rgba(255,255,255,0.95)") : T.glass,
        color: clientName.trim() ? (isLight ? "#FFFFFF" : "#0A0F18") : T.txt3,
        fontSize: 14, fontWeight: 700, fontFamily: fontDisp,
        boxShadow: clientName.trim() ? (isLight ? T.shadowMint || "0 4px 16px rgba(13,154,118,0.25)" : "0 4px 20px rgba(255,255,255,0.15)") : "none",
        transition: "all 0.25s", width: "100%",
      }}>
        Seleccionar Propiedades <ArrowRight size={16} style={{ marginLeft: 8, verticalAlign: "middle" }} />
      </button>
    </div>
  );

  // ─── Step 2: Selección de Propiedades ───
  if (step === 2) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={() => setStep(1)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.glass, cursor: "pointer", color: T.txt2, fontSize: 12, fontFamily: font, display: "flex", alignItems: "center", gap: 4 }}>
          <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Atrás
        </button>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 18, fontWeight: 600, color: isLight ? T.txt : "#FFFFFF", fontFamily: fontDisp }}>Seleccionar Propiedades</p>
          <p style={{ fontSize: 11, color: T.txt3, fontFamily: font }}>Paso 2 de 2 — Landing page para <span style={{ color: T.accent, fontWeight: 600 }}>{clientName}</span> · Presupuesto: <span style={{ color: T.emerald, fontWeight: 600 }}>${(clientBudgetMin / 1000).toFixed(0)}K – ${(clientBudgetMax / 1000).toFixed(0)}K</span></p>
        </div>
        {selectedProps.length > 0 && (
          <button onClick={handleGenerate} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "12px 22px",
            borderRadius: 12, border: "none", cursor: "pointer",
            background: isLight ? T.accent : "rgba(255,255,255,0.95)",
            color: isLight ? "#FFFFFF" : "#0A0F18",
            fontSize: 13, fontWeight: 700, fontFamily: fontDisp,
            boxShadow: isLight ? T.shadowMint || "0 4px 16px rgba(13,154,118,0.25)" : "0 4px 20px rgba(255,255,255,0.15)",
            transition: "all 0.25s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = isLight ? (T.accentDark || T.accent) : "#FFFFFF"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = isLight ? T.accent : "rgba(255,255,255,0.95)"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            <Wand2 size={16} /> Generar Landing Page ({selectedProps.length})
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, height: 3, borderRadius: 2, background: T.accent }} />
        <div style={{ flex: 1, height: 3, borderRadius: 2, background: T.accent, boxShadow: `0 0 8px ${T.accent}40` }} />
      </div>

      {/* Toolbar: hint + register button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.025)", border: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Image size={14} color={T.txt3} />
          <span style={{ fontSize: 11, color: T.txt3, fontFamily: font }}>Haz clic para seleccionar · </span>
          <span style={{ fontSize: 11, color: T.accent, fontWeight: 600, fontFamily: font }}>{filteredProperties.filter(inBudget).length} en presupuesto</span>
          <span style={{ fontSize: 11, color: T.txt3, fontFamily: font }}>· {filteredProperties.length} totales</span>
        </div>
        <button
          onClick={() => setShowNewPropModal(true)}
          style={{
            display: "flex", alignItems: "center", gap: 7, padding: "8px 16px",
            borderRadius: 9, border: `1px solid ${T.accent}40`, background: T.accentS,
            cursor: "pointer", color: T.accent, fontSize: 12, fontWeight: 700, fontFamily: fontDisp,
            transition: "all 0.2s", whiteSpace: "nowrap",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = T.accentB; e.currentTarget.style.borderColor = T.accent + "80"; }}
          onMouseLeave={e => { e.currentTarget.style.background = T.accentS; e.currentTarget.style.borderColor = T.accent + "40"; }}
        >
          <Plus size={14} /> Registrar propiedad
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        {filteredProperties.map(prop => {
          const selected = selectedProps.includes(prop.id);
          const driveLink = driveLinks[prop.id] || prop.driveLink || "";
          const isEditingThis = editingLinkId === prop.id;
          const matchesBudget = inBudget(prop);

          return (
            <div key={prop.id} style={{
              borderRadius: 16, overflow: "visible", cursor: "pointer",
              border: `2px solid ${selected ? prop.accent + "80" : T.border}`,
              background: T.glass, transition: "all 0.3s",
              boxShadow: selected ? `0 0 24px ${prop.accent}20` : "none",
              transform: selected ? "scale(1.01)" : "scale(1)",
              position: "relative",
              opacity: matchesBudget ? 1 : 0.75,
            }}>
              {/* Clickable area for selection */}
              <div onClick={() => toggleProp(prop.id)} style={{ cursor: "pointer" }}>
                {/* Property Image Header */}
                <div style={{
                  height: 140, background: prop.img, position: "relative",
                  display: "flex", alignItems: "flex-end", padding: 16,
                  borderRadius: "14px 14px 0 0", overflow: "hidden",
                }}>
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 60%)" }} />
                  <div style={{ position: "relative", zIndex: 1, width: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                      <div>
                        <p style={{ fontSize: 18, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em" }}>{prop.name}</p>
                        {prop.brand && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: font }}>{prop.brand}</p>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <MapPin size={12} color="rgba(255,255,255,0.7)" />
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontFamily: font }}>{prop.location}</span>
                      </div>
                    </div>
                  </div>
                  {selected && (
                    <div style={{
                      position: "absolute", top: 12, right: 12,
                      width: 28, height: 28, borderRadius: "50%",
                      background: prop.accent, display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: `0 0 12px ${prop.accent}60`,
                    }}>
                      <Check size={16} color="#000" strokeWidth={3} />
                    </div>
                  )}
                  {!selected && !matchesBudget && (
                    <div style={{
                      position: "absolute", top: 12, right: 12,
                      padding: "3px 8px", borderRadius: 6,
                      background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.15)",
                      fontSize: 9, color: "rgba(255,255,255,0.5)", fontFamily: font, whiteSpace: "nowrap",
                    }}>Fuera de rango</div>
                  )}
                  {!selected && matchesBudget && (
                    <div style={{
                      position: "absolute", top: 12, right: 12,
                      width: 28, height: 28, borderRadius: "50%",
                      border: "2px solid rgba(255,255,255,0.3)", background: "rgba(0,0,0,0.3)",
                    }} />
                  )}
                </div>

                {/* Property Details */}
                <div style={{ padding: "14px 16px 10px" }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                    <Pill color={prop.accent} s isLight={isLight}>{prop.type}</Pill>
                    <Pill color={T.emerald} s isLight={isLight}>ROI {prop.roi}</Pill>
                    <Pill color={T.txt2} s isLight={isLight}>{prop.bedrooms}</Pill>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div style={{ padding: "8px 10px", borderRadius: 8, background: `${prop.accent}0A`, border: `1px solid ${prop.accent}18` }}>
                      <p style={{ fontSize: 9, color: T.txt3, marginBottom: 2 }}>Desde</p>
                      <p style={{ fontSize: 16, fontWeight: 700, color: prop.accent, fontFamily: fontDisp }}>${(prop.priceFrom / 1000).toFixed(0)}K</p>
                    </div>
                    <div style={{ padding: "8px 10px", borderRadius: 8, background: T.glass, border: `1px solid ${T.border}` }}>
                      <p style={{ fontSize: 9, color: T.txt3, marginBottom: 2 }}>Hasta</p>
                      <p style={{ fontSize: 16, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>${(prop.priceTo / 1000).toFixed(0)}K</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: T.txt2, lineHeight: 1.5, fontFamily: font, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{prop.description}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10 }}>
                    {prop.highlights.slice(0, 3).map((h, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 14, height: 14, borderRadius: "50%", background: `${prop.accent}18`, border: `1px solid ${prop.accent}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <CheckCircle2 size={8} color={prop.accent} />
                        </div>
                        <span style={{ fontSize: 10, color: T.txt2, fontFamily: font, lineHeight: 1.3 }}>{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ─── Drive Link Bar ─── */}
              <div onClick={e => e.stopPropagation()} style={{
                borderTop: `1px solid ${T.border}`,
                padding: "10px 14px",
                background: isLight ? "rgba(0,0,0,0.04)" : "rgba(0,0,0,0.2)",
                borderRadius: "0 0 14px 14px",
              }}>
                {isEditingThis ? (
                  /* Edit mode */
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <ExternalLink size={13} color={T.txt3} style={{ flexShrink: 0 }} />
                    <input
                      autoFocus
                      value={editLinkValue}
                      onChange={e => setEditLinkValue(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") saveDriveLink(prop.id); if (e.key === "Escape") { setEditingLinkId(null); setEditLinkValue(""); } }}
                      placeholder="Pega aquí el link de Google Drive..."
                      style={{
                        flex: 1, padding: "6px 10px", borderRadius: 7, fontSize: 11,
                        background: T.glass, border: `1px solid ${T.accent}50`, color: T.txt,
                        fontFamily: font, outline: "none",
                      }}
                    />
                    <button onClick={() => saveDriveLink(prop.id)} style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: T.accent, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp, whiteSpace: "nowrap" }}>
                      Guardar
                    </button>
                    <button onClick={() => { setEditingLinkId(null); setEditLinkValue(""); }} style={{ padding: "6px 8px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.glass, cursor: "pointer", color: T.txt3 }}>
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  /* View mode */
                  <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <ExternalLink size={12} color={driveLink ? T.accent : T.txt3} style={{ flexShrink: 0 }} />
                      <span style={{
                        fontSize: 11, color: driveLink ? T.accent : T.txt3, fontFamily: font,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        maxWidth: 200,
                      }} title={driveLink || ""}>
                        {driveLink
                          ? (driveLink.length > 38 ? driveLink.slice(0, 35) + "…" : driveLink)
                          : "Sin link de imágenes"}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {driveLink && (
                        <a
                          href={driveLink} target="_blank" rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{
                            display: "flex", alignItems: "center", gap: 5, padding: "5px 12px",
                            borderRadius: 7, border: `1px solid ${prop.accent}50`,
                            background: `${prop.accent}12`, color: prop.accent,
                            fontSize: 11, fontWeight: 700, textDecoration: "none",
                            fontFamily: fontDisp, transition: "all 0.2s",
                          }}
                        >
                          <Image size={11} /> Ver imágenes
                        </a>
                      )}
                      <button
                        onClick={e => startEditLink(prop.id, driveLink, e)}
                        title={driveLink ? "Cambiar link" : "Agregar link de Drive"}
                        style={{
                          display: "flex", alignItems: "center", gap: 5, padding: "5px 10px",
                          borderRadius: 7, border: `1px solid ${T.border}`,
                          background: T.glass, color: T.txt3, cursor: "pointer",
                          fontSize: 11, fontFamily: font, transition: "all 0.2s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderH; e.currentTarget.style.color = T.txt; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.txt3; }}
                      >
                        {driveLink ? <><Copy size={11} /> Cambiar</> : <><Plus size={11} /> Agregar link</>}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredProperties.length === 0 && (
        <G T={T} style={{ textAlign: "center", padding: 40 }}>
          <Building2 size={40} color={T.txt3} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
          <p style={{ fontSize: 14, color: T.txt2, fontFamily: fontDisp }}>No hay propiedades en este rango de presupuesto</p>
          <p style={{ fontSize: 12, color: T.txt3, marginTop: 4 }}>Ajusta el rango en el paso anterior</p>
          <button onClick={() => setShowNewPropModal(true)} style={{ marginTop: 14, padding: "10px 20px", borderRadius: 10, border: `1px solid ${T.accent}40`, background: T.accentS, color: T.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp }}>
            <Plus size={13} style={{ marginRight: 6, verticalAlign: "middle" }} />Registrar propiedad nueva
          </button>
        </G>
      )}

      {selectedProps.length > 0 && (
        <div style={{
          position: "sticky", bottom: 0, padding: "14px 20px",
          background: isLight ? "rgba(255,255,255,0.98)" : "rgba(6,10,17,0.95)", backdropFilter: "blur(16px)",
          borderRadius: 14, border: `1px solid ${T.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          boxShadow: isLight ? T.shadow2 || "0 -4px 20px rgba(15,23,42,0.10)" : "0 -8px 32px rgba(0,0,0,0.4)",
        }}>
          <div>
            <p style={{ fontSize: 13, color: T.txt, fontWeight: 600 }}>{selectedProps.length} propiedad{selectedProps.length > 1 ? "es" : ""} seleccionada{selectedProps.length > 1 ? "s" : ""}</p>
            <p style={{ fontSize: 11, color: T.txt3 }}>para {clientName}</p>
          </div>
          <button onClick={handleGenerate} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "12px 28px",
            borderRadius: 12, border: "none", cursor: "pointer",
            background: isLight ? T.accent : "rgba(255,255,255,0.95)",
            color: isLight ? "#FFFFFF" : "#0A0F18",
            fontSize: 14, fontWeight: 700, fontFamily: fontDisp,
            boxShadow: isLight ? T.shadowMint || "0 4px 16px rgba(13,154,118,0.25)" : "0 4px 20px rgba(255,255,255,0.15)",
          }}>
            <Wand2 size={16} /> Generar Landing Page
          </button>
        </div>
      )}

      {/* New Property Modal */}
      {showNewPropModal && (
        <NewPropertyModal
          onClose={() => { setShowNewPropModal(false); setEditingProp(null); }}
          onSave={saveCustomProp}
          initialData={editingProp}
          T={T}
        />
      )}

      {/* Full-screen Landing Page Preview */}
      {previewOpen && createPortal(
        <LandingPagePreview
          client={clientName}
          asesor={asesor}
          asesorWA={asesorWA}
          asesorCal={asesorCal}
          mensaje={mensaje}
          agencyName={agencyName}
          properties={allProperties.filter(p => selectedProps.includes(p.id))}
          driveLinks={driveLinks}
          onClose={() => { setPreviewOpen(false); resetForm(); }}
          onCopyLink={handleCopyLink}
          copied={copied}
        />,
        document.body
      )}
    </div>
  );

  return null;
};

/* ════════════════════════════════════════
   LANDING PAGE PREVIEW — FULL SCREEN
   ════════════════════════════════════════ */
const LandingPagePreview = ({ client, asesor, asesorWA = "", asesorCal = "", mensaje, agencyName = "STRATOS REALTY", properties, onClose, onCopyLink, copied, driveLinks = {} }) => {
  const [activeProperty, setActiveProperty] = useState(0);
  const [showSharePanel, setShowSharePanel] = useState(false);

  const currentProp = properties[activeProperty] || properties[0];
  if (!currentProp) return null;

  const fmtPrice = (n) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;

  const waPhone = asesorWA.replace(/\D/g, "");
  const propNames = properties.map(p => p.name).join(", ");
  const waText = encodeURIComponent(`Hola ${asesor.split(" ")[0]}, acabo de revisar la presentación de propiedades que me enviaste (${propNames}). Me gustaría conocer más detalles.`);
  const waUrl = waPhone ? `https://wa.me/${waPhone}?text=${waText}` : null;
  const calUrl = asesorCal || null;

  const demoShareUrl = `${window.location.origin}${window.location.pathname}?lp=preview&c=${encodeURIComponent(client || "cliente")}`;

  const handleWhatsAppAdvisor = () => {
    if (waUrl) window.open(waUrl, "_blank");
  };
  const handleScheduleCall = () => {
    if (calUrl) window.open(calUrl, "_blank");
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100000,
      background: "#000000", overflowY: "auto",
      fontFamily: font,
    }}>
      {/* Share panel overlay */}
      {showSharePanel && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200000,
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setShowSharePanel(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#111318", border: `1px solid ${P.border}`,
            borderRadius: 20, padding: "28px 32px", width: 500, maxWidth: "95vw",
            boxShadow: "0 40px 80px rgba(0,0,0,0.7)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: fontDisp }}>Enviar al cliente</p>
              <button onClick={() => setShowSharePanel(false)} style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${P.border}`, background: P.glass, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={14} color={P.txt2} />
              </button>
            </div>

            {/* Copy link */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: P.txt2, marginBottom: 8, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>Enlace de la landing page</p>
              <div style={{ display: "flex", gap: 8 }}>
                <input readOnly value={demoShareUrl} style={{ flex: 1, padding: "10px 14px", borderRadius: 9, fontSize: 11, background: P.glass, border: `1px solid ${P.border}`, color: P.txt3, fontFamily: font, outline: "none" }} onClick={e => e.target.select()} />
                <button onClick={() => { onCopyLink(); navigator.clipboard.writeText(demoShareUrl).catch(()=>{}); }} style={{
                  padding: "10px 18px", borderRadius: 9, border: "none",
                  background: copied ? P.emerald : P.accent, color: "#000",
                  fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp,
                  display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                  transition: "background 0.2s",
                }}>
                  {copied ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
                </button>
              </div>
            </div>

            {/* WhatsApp option */}
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: P.txt2, marginBottom: 8, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>Enviar por WhatsApp</p>
              {waUrl ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <a href={`https://wa.me/${waPhone}?text=${encodeURIComponent(`Hola ${client || "estimado cliente"}, te comparto la presentación exclusiva de propiedades que seleccioné para ti:\n${demoShareUrl}`)}`}
                    target="_blank" rel="noreferrer"
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "12px 18px",
                      borderRadius: 10, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.25)",
                      color: "#25D366", textDecoration: "none", fontSize: 13, fontWeight: 700, fontFamily: fontDisp,
                      transition: "all 0.2s",
                    }}
                  >
                    <Phone size={16} /> Abrir WhatsApp con cliente
                  </a>
                  <button onClick={() => {
                    const waMsg = `Hola ${client || "estimado cliente"} 🏡\n\nPrepare una presentación exclusiva con propiedades seleccionadas especialmente para ti.\n\nVe las propiedades aquí:\n${demoShareUrl}\n\n¿Cuándo te viene bien una llamada para revisarlas juntos?`;
                    navigator.clipboard.writeText(waMsg).then(() => onCopyLink()).catch(() => {});
                  }} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
                    borderRadius: 9, background: P.glass, border: `1px solid ${P.border}`,
                    color: P.txt2, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: font, transition: "all 0.18s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "#fff"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = P.glass; e.currentTarget.style.color = P.txt2; }}
                  >
                    <Copy size={13} /> Copiar mensaje completo para WhatsApp
                  </button>
                </div>
              ) : (
                <div style={{ padding: "12px 18px", borderRadius: 10, background: P.glass, border: `1px solid ${P.border}`, color: P.txt3, fontSize: 12 }}>
                  Configura el WhatsApp del asesor en el Paso 1 para activar esta opción
                </div>
              )}
            </div>

            {/* Calendly / meeting link */}
            {calUrl && (
              <div>
                <p style={{ fontSize: 11, color: P.txt2, marginBottom: 8, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>Agendar llamada</p>
                <a href={calUrl} target="_blank" rel="noreferrer" style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "12px 18px",
                  borderRadius: 10, background: P.blueS || "rgba(126,184,240,0.08)", border: `1px solid ${P.blue}30`,
                  color: P.blue, textDecoration: "none", fontSize: 13, fontWeight: 700, fontFamily: fontDisp,
                }}>
                  <CalendarDays size={16} /> Abrir link de agenda
                </a>
              </div>
            )}

            <p style={{ fontSize: 10, color: P.txt3, marginTop: 18, lineHeight: 1.6, textAlign: "center" }}>
              La landing page muestra las propiedades seleccionadas con todos sus datos,<br />galería de imágenes y botones de contacto directo con el asesor.
            </p>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100001,
        padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Pill color={P.accent}>Vista Previa</Pill>
          <span style={{ fontSize: 12, color: P.txt2 }}>Landing page para {client}</span>
          {properties.length > 1 && (
            <span style={{ fontSize: 11, color: P.txt3 }}>· {properties.length} propiedades</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={onCopyLink} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
            borderRadius: 8, border: `1px solid ${copied ? P.emerald + "50" : P.border}`,
            background: copied ? "rgba(109,212,168,0.08)" : P.glass,
            cursor: "pointer", color: copied ? P.emerald : P.txt2, fontSize: 12, fontWeight: 600, fontFamily: font,
            transition: "all 0.25s",
          }}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Enlace copiado" : "Copiar enlace"}
          </button>
          <button onClick={() => setShowSharePanel(true)} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
            borderRadius: 8, border: "none", background: "rgba(255,255,255,0.95)",
            cursor: "pointer", color: "#0A0F18", fontSize: 12, fontWeight: 700, fontFamily: fontDisp,
          }}>
            <Share2 size={14} /> Enviar al cliente
          </button>
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: 8, border: `1px solid ${P.border}`,
            background: P.glass, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <X size={16} color={P.txt2} />
          </button>
        </div>
      </div>

      {/* ─── LANDING PAGE CONTENT ─── */}
      <div style={{ paddingTop: 60 }}>
        {/* HERO SECTION */}
        <div style={{
          minHeight: "100vh", position: "relative",
          background: currentProp.img,
          display: "flex", flexDirection: "column", justifyContent: "flex-end",
          padding: "0 0 60px 0",
        }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.1) 100%)" }} />

          {/* Floating nav dots */}
          {properties.length > 1 && (
            <div style={{
              position: "absolute", right: 30, top: "50%", transform: "translateY(-50%)",
              display: "flex", flexDirection: "column", gap: 12,
            }}>
              {properties.map((p, i) => (
                <button key={p.id} onClick={() => setActiveProperty(i)} style={{
                  width: i === activeProperty ? 12 : 8,
                  height: i === activeProperty ? 12 : 8,
                  borderRadius: "50%", border: "none", cursor: "pointer",
                  background: i === activeProperty ? p.accent : "rgba(255,255,255,0.3)",
                  boxShadow: i === activeProperty ? `0 0 12px ${p.accent}60` : "none",
                  transition: "all 0.3s",
                }} title={p.name} />
              ))}
            </div>
          )}

          <div style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto", padding: "0 40px", width: "100%" }}>
            {/* Branding */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 30, animation: "fadeInUp 0.6s ease both" }}>
              <StratosAtom size={24} color={currentProp.accent} />
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", fontWeight: 400, fontFamily: fontDisp, letterSpacing: "0.1em" }}>{agencyName}</span>
            </div>

            {/* Personalized greeting */}
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", fontFamily: font, marginBottom: 8, fontWeight: 400, animation: "fadeInUp 0.65s 0.08s ease both" }}>
              Preparado exclusivamente para
            </p>
            <h1 style={{ fontSize: 52, fontWeight: 300, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 20, animation: "floatSoft 5s 0.3s ease-in-out infinite, fadeInUp 0.7s 0.15s ease both" }}>
              {client || "Estimado Cliente"}
            </h1>

            {mensaje && (
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", fontFamily: font, lineHeight: 1.7, maxWidth: 600, marginBottom: 28 }}>
                {mensaje || `Es un placer presentarle una selección curada de las mejores oportunidades de inversión en la Riviera Maya, seleccionadas específicamente para sus objetivos.`}
              </p>
            )}

            {!mensaje && (
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", fontFamily: font, lineHeight: 1.7, maxWidth: 600, marginBottom: 28 }}>
                Es un placer presentarle una selección curada de las mejores oportunidades de inversión en la Riviera Maya, seleccionadas específicamente para sus objetivos.
              </p>
            )}

            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", animation: "fadeInUp 0.7s 0.25s ease both" }}>
              {calUrl ? (
                <a href={calUrl} target="_blank" rel="noreferrer" style={{
                  padding: "14px 32px", borderRadius: 12, border: "none",
                  background: "#FFFFFF", color: "#000000",
                  fontSize: 14, fontWeight: 700, fontFamily: fontDisp,
                  boxShadow: "0 4px 24px rgba(255,255,255,0.2)", textDecoration: "none",
                  display: "inline-flex", alignItems: "center", gap: 8,
                }}>
                  <CalendarDays size={15} style={{ verticalAlign: "middle" }} /> Agendar Llamada
                </a>
              ) : (
                <button onClick={() => setShowSharePanel(true)} style={{
                  padding: "14px 32px", borderRadius: 12, border: "none",
                  background: "#FFFFFF", color: "#000000",
                  fontSize: 14, fontWeight: 700, fontFamily: fontDisp, cursor: "pointer",
                  boxShadow: "0 4px 24px rgba(255,255,255,0.2)",
                }}>
                  <CalendarDays size={15} style={{ marginRight: 8, verticalAlign: "middle" }} />Agendar Llamada
                </button>
              )}
              {waUrl ? (
                <a href={waUrl} target="_blank" rel="noreferrer" style={{
                  padding: "14px 32px", borderRadius: 12,
                  border: "1px solid rgba(37,211,102,0.3)", background: "rgba(37,211,102,0.08)",
                  color: "#25D366", fontSize: 14, fontWeight: 600, fontFamily: fontDisp,
                  backdropFilter: "blur(10px)", textDecoration: "none",
                  display: "inline-flex", alignItems: "center", gap: 8,
                }}>
                  <Phone size={14} /> WhatsApp
                </a>
              ) : (
                <button onClick={() => setShowSharePanel(true)} style={{
                  padding: "14px 32px", borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)",
                  color: "#FFFFFF", fontSize: 14, fontWeight: 500, fontFamily: fontDisp, cursor: "pointer",
                  backdropFilter: "blur(10px)",
                }}>
                  Contactar Asesor
                </button>
              )}
            </div>

            {/* Quick stats */}
            <div style={{ display: "flex", gap: 40, marginTop: 50 }}>
              {[
                { label: "Propiedades", value: properties.length },
                { label: "ROI Estimado", value: "8-13%" },
                { label: "Ubicaciones", value: [...new Set(properties.map(p => p.location))].length },
              ].map(s => (
                <div key={s.label}>
                  <p style={{ fontSize: 28, fontWeight: 300, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.03em" }}>{s.value}</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: font, letterSpacing: "0.05em", textTransform: "uppercase", marginTop: 4 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PROPERTIES SECTION */}
        <div style={{ background: "#050810", padding: "80px 40px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 60 }}>
              <p style={{ fontSize: 11, color: currentProp.accent, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>PORTAFOLIO EXCLUSIVO</p>
              <h2 style={{ fontSize: 36, fontWeight: 300, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em" }}>
                Propiedades Seleccionadas
              </h2>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginTop: 12, fontFamily: font }}>
                Cada propiedad ha sido elegida en base a sus criterios de inversión
              </p>
            </div>

            {properties.map((prop, idx) => (
              <div key={prop.id} style={{
                marginBottom: 60, borderRadius: 20, overflow: "hidden",
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                animation: `scaleIn 0.55s ${idx * 0.1}s ease both`,
              }}>
                {/* Property Header */}
                <div style={{
                  height: 280, background: prop.img, position: "relative",
                  display: "flex", alignItems: "flex-end", padding: 32,
                }}>
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)" }} />
                  <div style={{ position: "relative", zIndex: 1, width: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                      <div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                          <Pill color={prop.accent}>{prop.type}</Pill>
                          <Pill color={P.emerald}>ROI {prop.roi}</Pill>
                        </div>
                        <h3 style={{ fontSize: 32, fontWeight: 300, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em" }}>
                          {prop.name} <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 200 }}>{prop.brand}</span>
                        </h3>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                          <MapPin size={14} color="rgba(255,255,255,0.5)" />
                          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontFamily: font }}>{prop.location} — {prop.zone}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>DESDE</p>
                        <p style={{ fontSize: 38, fontWeight: 300, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.03em" }}>
                          {fmtPrice(prop.priceFrom)}
                        </p>
                        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>hasta {fmtPrice(prop.priceTo)} USD</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Property Body */}
                <div style={{ padding: 32 }}>
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.7, fontFamily: font, marginBottom: 28, maxWidth: 800 }}>
                    {prop.description}
                  </p>

                  {/* Key Metrics */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
                    {[
                      { label: "Recámaras", value: prop.bedrooms, icon: Home, c: prop.accent },
                      { label: "ROI Anual", value: prop.roi, icon: TrendingUp, c: P.emerald },
                      { label: "Entrega", value: prop.delivery, icon: Calendar, c: P.blue },
                      { label: "Tamaños", value: prop.sizes[0] + " – " + prop.sizes[prop.sizes.length - 1], icon: Maximize2, c: P.violet },
                    ].map(m => (
                      <div key={m.label} style={{
                        padding: "16px", borderRadius: 12,
                        background: `${m.c}08`, border: `1px solid ${m.c}15`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <m.icon size={14} color={m.c} />
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.label}</span>
                        </div>
                        <p style={{ fontSize: 16, fontWeight: 600, color: "#FFFFFF", fontFamily: fontDisp }}>{m.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Highlights */}
                  <div style={{ marginBottom: 24 }}>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, fontWeight: 600 }}>Por qué esta propiedad</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {prop.highlights.map((h, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                          <CheckCircle2 size={16} color={prop.accent} />
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: font }}>{h}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Amenities */}
                  <div style={{ marginBottom: 24 }}>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, fontWeight: 600 }}>Amenidades</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {prop.amenities.map((a, i) => (
                        <span key={i} style={{
                          fontSize: 11, color: "rgba(255,255,255,0.6)", padding: "5px 12px",
                          borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                        }}>{a}</span>
                      ))}
                    </div>
                  </div>

                  {/* Gallery / Drive link CTA */}
                  <div style={{
                    marginTop: 8, padding: "20px 24px", borderRadius: 14,
                    background: (driveLinks[prop.id] || prop.driveLink) ? `${prop.accent}08` : "rgba(255,255,255,0.02)",
                    border: `1px solid ${(driveLinks[prop.id] || prop.driveLink) ? prop.accent + "30" : "rgba(255,255,255,0.05)"}`,
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
                  }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#FFFFFF", fontFamily: fontDisp, marginBottom: 4 }}>
                        {(driveLinks[prop.id] || prop.driveLink) ? "Galería de imágenes disponible" : "Galería de imágenes"}
                      </p>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: font }}>
                        {(driveLinks[prop.id] || prop.driveLink)
                          ? "Fotos reales del proyecto, renders y planos disponibles"
                          : "El asesor puede agregar un link a la galería de fotos desde el panel"}
                      </p>
                    </div>
                    {(driveLinks[prop.id] || prop.driveLink) ? (
                      <a
                        href={driveLinks[prop.id] || prop.driveLink}
                        target="_blank" rel="noreferrer"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 8,
                          padding: "12px 24px", borderRadius: 10,
                          border: `1px solid ${prop.accent}50`,
                          background: `${prop.accent}15`,
                          color: prop.accent, textDecoration: "none",
                          fontSize: 13, fontWeight: 700, fontFamily: fontDisp,
                          whiteSpace: "nowrap",
                        }}
                      >
                        <Image size={15} /> Ver galería <ExternalLink size={12} />
                      </a>
                    ) : (
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 8,
                        padding: "12px 24px", borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)",
                        color: "rgba(255,255,255,0.25)", fontSize: 12, fontFamily: fontDisp,
                      }}>
                        <Image size={14} /> Galería no configurada
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MARKET DATA SECTION */}
        <div style={{ background: "#030508", padding: "80px 40px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 50 }}>
              <p style={{ fontSize: 11, color: P.accent, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>DATOS DEL MERCADO 2026</p>
              <h2 style={{ fontSize: 32, fontWeight: 300, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em" }}>
                ¿Por qué la Riviera Maya?
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 40 }}>
              {[
                { label: "Crecimiento Anual", value: "14%", sub: "Nominal YoY", icon: TrendingUp, c: P.emerald },
                { label: "ROI por Rentas", value: "8-15%", sub: "Neto anual", icon: DollarSign, c: P.accent },
                { label: "Ocupación", value: "75-90%", sub: "Promedio anual", icon: Building2, c: P.blue },
              ].map(s => (
                <div key={s.label} style={{
                  padding: 28, borderRadius: 16, textAlign: "center",
                  background: `${s.c}06`, border: `1px solid ${s.c}15`,
                }}>
                  <s.icon size={24} color={s.c} style={{ margin: "0 auto 14px" }} />
                  <p style={{ fontSize: 36, fontWeight: 300, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.03em" }}>{s.value}</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 6, letterSpacing: "0.05em" }}>{s.label}</p>
                  <p style={{ fontSize: 10, color: s.c, marginTop: 2 }}>{s.sub}</p>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div style={{ padding: 28, borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, marginBottom: 18 }}>Ventajas para Inversionistas</p>
                {[
                  "Propiedad 100% legal para extranjeros via fideicomiso",
                  "Impuestos prediales mínimos vs EE.UU./Canadá",
                  "Nuevo Aeropuerto Internacional de Tulum",
                  "Tren Maya conectando toda la región",
                  "Turismo 365 días — clima cálido todo el año",
                  "Mercado de nómadas digitales en expansión",
                ].map((v, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                    <CheckCircle2 size={16} color={P.accent} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>{v}</span>
                  </div>
                ))}
              </div>

              <div style={{ padding: 28, borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, marginBottom: 18 }}>Infraestructura</p>
                {[
                  { title: "Aeropuerto de Tulum", desc: "Nuevo aeropuerto internacional, abrió en 2025" },
                  { title: "Tren Maya", desc: "Conectividad ferroviaria regional — impulsa plusvalía" },
                  { title: "Precio promedio por m²", desc: "$3,600 USD/m² — potencial de apreciación significativo" },
                  { title: "Plusvalía real", desc: "8% anual después de inflación" },
                ].map((inf, i) => (
                  <div key={i} style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#FFFFFF", fontFamily: fontDisp }}>{inf.title}</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4, lineHeight: 1.4 }}>{inf.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* CTA SECTION */}
        <div style={{ background: "#000000", padding: "80px 40px", textAlign: "center" }}>
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <StratosAtom size={40} color={P.accent} />
            <h2 style={{ fontSize: 32, fontWeight: 300, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em", marginTop: 20, marginBottom: 12 }}>
              ¿Listo para dar el siguiente paso?
            </h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, marginBottom: 32 }}>
              Agenda una llamada con <strong style={{ color: "rgba(255,255,255,0.8)" }}>{asesor}</strong> para conocer todos los detalles, resolver tus dudas y asegurar la mejor oportunidad de inversión.
            </p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              {calUrl ? (
                <a href={calUrl} target="_blank" rel="noreferrer" style={{
                  padding: "16px 40px", borderRadius: 12, border: "none",
                  background: "#FFFFFF", color: "#000000",
                  fontSize: 15, fontWeight: 700, fontFamily: fontDisp,
                  boxShadow: "0 4px 24px rgba(255,255,255,0.2)", textDecoration: "none",
                  display: "inline-flex", alignItems: "center", gap: 8,
                }}>
                  <CalendarDays size={16} /> Agendar con {asesor.split(" ")[0]}
                </a>
              ) : (
                <button style={{
                  padding: "16px 40px", borderRadius: 12, border: "none",
                  background: "#FFFFFF", color: "#000000",
                  fontSize: 15, fontWeight: 700, fontFamily: fontDisp, cursor: "pointer",
                  boxShadow: "0 4px 24px rgba(255,255,255,0.2)",
                }}>
                  Agendar Llamada con {asesor.split(" ")[0]}
                </button>
              )}
              {waUrl ? (
                <a href={`https://wa.me/${waPhone}?text=${encodeURIComponent(`Hola ${asesor.split(" ")[0]}, vi tu presentación de propiedades y me interesa agendar una llamada. ¿Cuándo tienes disponibilidad?`)}`}
                  target="_blank" rel="noreferrer"
                  style={{
                    padding: "16px 40px", borderRadius: 12,
                    border: "1px solid rgba(37,211,102,0.3)", background: "rgba(37,211,102,0.08)",
                    color: "#25D366", fontSize: 15, fontWeight: 600, fontFamily: fontDisp,
                    textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8,
                  }}
                >
                  <Phone size={15} /> WhatsApp
                </a>
              ) : (
                <button style={{
                  padding: "16px 40px", borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.15)", background: "transparent",
                  color: "#FFFFFF", fontSize: 15, fontWeight: 500, fontFamily: fontDisp, cursor: "pointer",
                }}>
                  Contactar Asesor
                </button>
              )}
            </div>

            <div style={{ marginTop: 60, padding: "20px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
                Stratos Realty · Riviera Maya, México · Presentación confidencial generada para {client}
              </p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", marginTop: 6 }}>
                Asesor: {asesor} · Abril 2026 · Todos los precios en USD · Sujeto a disponibilidad
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPages;
