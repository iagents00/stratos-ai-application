import { lazy, Suspense, useMemo, useState } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { ClientProvider } from '../contexts/ClientContext';
import { getClientConfig } from '../clients';
import { DENTAL_DEMO_USER } from './profile-data';
const App = lazy(() => import('../app/App.jsx'));
export default function DentalProfile() {
  const [entered, setEntered] = useState(() => { try { return sessionStorage.getItem("stratos.dental-demo.entered") === "1"; } catch { return false; } });
  const enter = () => { try { sessionStorage.setItem("stratos.dental-demo.entered", "1"); } catch { /* Demo works without storage. */ } setEntered(true); };
  const auth = useMemo(() => ({ user: DENTAL_DEMO_USER, bootHydrating: false, loading: false, error: null, isAuthenticated: true, login: async () => ({data:DENTAL_DEMO_USER,error:null}), logout: async () => { try { sessionStorage.removeItem("stratos.dental-demo.entered"); } catch { /* Optional storage. */ } setEntered(false); }, upgradeToOnline: () => {}, hasRole: role => role === 'admin', hasMinRole: level => level >= 1 }), []);
  return <ClientProvider config={getClientConfig('clinica-dental-demo')}><AuthContext.Provider value={auth}>{entered ? <Suspense fallback={<p style={{padding:30}}>Cargando perfil dental…</p>}><App /></Suspense> : <div style={{minHeight:'100dvh',background:'#060a11',color:'#e5e7eb',display:'grid',placeItems:'center',padding:24}}><section style={{maxWidth:440,width:'100%',border:'1px solid #29374a',borderRadius:16,padding:32,background:'#0b1220'}}><p style={{color:'#6ee7c2',fontSize:13}}>STRATOS AI · PERFIL INDEPENDIENTE</p><h1 style={{fontSize:28,fontWeight:550}}>Clínica Dental · Demo</h1><p style={{lineHeight:1.7,color:'#bdc9d8'}}>Ingresa como Admin Dental para probar el CRM de pacientes, la agenda y Copilot dentro de la plataforma oficial.</p><p style={{fontSize:12,lineHeight:1.7,color:'#a5b4c8'}}>Perfil de demostración con datos ficticios. No consulta ni modifica Huli y no comparte datos con otros clientes.</p><button onClick={enter} style={{width:'100%',padding:14,marginTop:16,border:0,borderRadius:10,background:'#6ee7c2',color:'#08261d',fontWeight:650,cursor:'pointer'}}>Entrar al perfil dental demo</button></section></div>}</AuthContext.Provider></ClientProvider>;
}
