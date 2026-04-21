import { P } from "../../../design-system/tokens";

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

export default PropArt;
