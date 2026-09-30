import {useEffect,useState} from 'react';
import {HuliContext,queryHuli} from './HuliContext';
import HuliWorkspace from './HuliWorkspace';
export default function TenantHuliWorkspace({view}){
 const [metadata,setMetadata]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{const controller=new AbortController();queryHuli(undefined,controller.signal).then(d=>{if(!controller.signal.aborted)setMetadata(d);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[attempt]);
 if(error)return <section className="huli-workspace huli-panel" role="alert"><h2>No se pudo conectar con Huli</h2><p>{error}</p><button className="huli-secondary" onClick={()=>{setError('');setAttempt(x=>x+1);}}>Reintentar</button></section>;
 if(!metadata)return <section className="huli-workspace" aria-busy="true">Conectando tu clínica con Huli…</section>;
 return <HuliContext.Provider value={metadata}><HuliWorkspace view={view}/></HuliContext.Provider>;
}
