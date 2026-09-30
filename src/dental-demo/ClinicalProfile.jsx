import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { ClientProvider } from '../contexts/ClientContext';
import { getClientConfig } from '../clients';
import { HuliContext, queryHuli } from './HuliContext';
import './huli-workspace.css';
const App=lazy(()=>import('../app/App.jsx'));
export default function ClinicalProfile() {
  const [metadata,setMetadata]=useState(null),[boot,setBoot]=useState(true),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{let active=true;queryHuli().then(d=>{if(active)setMetadata(d);}).catch(()=>{}).finally(()=>{if(active)setBoot(false);});return()=>{active=false;};},[]);
  const auth=useMemo(()=>({user:{id:'dental-huli-local',name:'Huli · Clínica',role:'admin',organizationId:'huli-clinic-isolated',isDemo:true,isClinicalSession:true},isAuthenticated:!!metadata,bootHydrating:false,loading:false,error:null,logout:async()=>{try{await queryHuli({action:'logout'});setMetadata(null);setPassword('');}catch(e){setError(e.message);}},upgradeToOnline:()=>{},hasRole:r=>r==='admin',hasMinRole:()=>true}),[metadata]);
  async function login(event){event.preventDefault();setBusy(true);setError('');try{await queryHuli({action:'login',password});setPassword('');setMetadata(await queryHuli());}catch(e){setError(e.message);}finally{setBusy(false);}}
  if(!metadata)return <div className="huli-entry"><form onSubmit={login}><p className="huli-kicker">STRATOS AI · CLÍNICA</p><h1>Tu clínica dental</h1><p>Pacientes y agenda conectados a tu cuenta Huli, dentro de Stratos.</p><label htmlFor="huli-password">Clave privada del perfil</label><input id="huli-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required disabled={boot||busy} /><p className="huli-error" role="alert">{error}</p><button disabled={boot||busy||!password}>{boot?'Verificando sesión…':busy?'Conectando…':'Entrar a la clínica'}</button><small>Acceso protegido. La clave de Huli permanece en el servidor.</small></form></div>;
  return <ClientProvider config={getClientConfig('clinica-dental')}><AuthContext.Provider value={auth}><HuliContext.Provider value={metadata}><Suspense fallback={<div className="huli-loading">Abriendo tu espacio clínico…</div>}><App /></Suspense></HuliContext.Provider></AuthContext.Provider></ClientProvider>;
}
