// Fixture exclusivamente local: no sesión ni peticiones a Supabase.
import React, { useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Gestion } from '../src/app/views/MiDia';
export default function Prueba() {
  const [modo,setModo]=useState('definitivo'), [intentos,setIntentos]=useState(0), [resultado,setResultado]=useState('');
  const primero=useRef(null);
  async function guardar(_,gestion) {
    setIntentos(n=>n+1);
    if (!primero.current) {
      primero.current=gestion;
      if (modo==='incierto') {
        // Simula pérdida de respuesta y que el siguiente paso venza antes del reintento.
        Date.now=()=>Date.parse(gestion.fecha)+60000;
        throw new Error('Respuesta de red perdida (simulada).');
      }
      throw Object.assign(new Error('El servidor rechazó la gestión (simulado). Corrige el resultado.'),{definitivo:true});
    }
    setResultado(modo==='incierto' ? (JSON.stringify(gestion)===JSON.stringify(primero.current) ? 'Reintento idéntico confirmado después de vencer la fecha.' : 'ERROR: payload distinto') : `Borrador corregido: ${gestion.detalle}`);
  }
  return <main className="stratos-rails rails-light" style={{fontFamily:'sans-serif',padding:20,'--rails-text':'#17212f','--rails-secondary':'#4b5563','--rails-border':'#b0bac7','--rails-surface':'#fff','--rails-field':'#fff','--rails-accent':'#087252'}}>
    <h1>Prueba local · sin datos reales</h1>
    <label htmlFor="modo">Fallo simulado</label><select id="modo" value={modo} onChange={e=>setModo(e.target.value)} disabled={intentos>0}><option value="definitivo">Rechazo definitivo</option><option value="incierto">Respuesta incierta</option></select>
    <p>Intentos: {intentos}</p><output>{resultado}</output>
    <Gestion accion={{leadId:'fixture',nombre:'Cliente de ejemplo',canal:'llamada',version:'2026-09-12T00:00:00Z'}} resultado="contactado" onGuardar={guardar} onCancelar={()=>setResultado('Formulario cerrado por el usuario.')} />
  </main>;
}
createRoot(document.getElementById('root')).render(<Prueba />);
