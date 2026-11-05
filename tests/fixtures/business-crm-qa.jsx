import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AuthContext} from '../../src/contexts/AuthContext';
import {ClientProvider} from '../../src/contexts/ClientContext';
import CRM from '../../src/app/views/CRM';
import {applyPipelineConfig} from '../../src/app/constants/pipeline';
import {DEFAULT_CLIENT_CONFIG} from '../../src/clients/_shared/defaults';
const stages=['RS Primer contacto','RS Contactado','RS Reunión','M Primer Contacto','M Contactado','M Reunión'];
const businessLines=[{id:'real-estate',label:'Bienes raíces',entryStage:stages[0],stages:stages.slice(0,3)}, {id:'medicine',label:'Medicina',entryStage:stages[3],stages:stages.slice(3)}];
const legacy=new URLSearchParams(location.search).has('legacy');
const config={...DEFAULT_CLIENT_CONFIG,id:'tenant',name:'Empresa de prueba',features:{...DEFAULT_CLIENT_CONFIG.features,procesoGuiado:false},crm:{pipeline:stages.map(name=>({name,color:'#268099'})),appointmentStages:['RS Reunión','M Reunión'],businessLines:legacy?[]:businessLines}};
applyPipelineConfig(config);
const user={id:'qa-user',organizationId:'10000000-0000-4000-a000-000000000001',role:'admin',name:'Asesor QA',isDemo:true,viewAllLeads:true};
function Fixture(){
 const [openCounter,setOpenCounter]=useState(0);
 const [leads,setLeads]=useState([{id:'10000000-0000-4000-a000-000000000011',n:'Ana Medicina',st:stages[3],sc:15,source:'telegram',asesor:user.name,phone:'5215500000101',seguimientos:2,budget:'',notas:'Nota conservada',isNew:false}, {id:'10000000-0000-4000-a000-000000000012',n:'Beto Inmobiliario',st:stages[0],sc:12,source:'whatsapp',asesor:user.name,phone:'5215500000102',seguimientos:0,budget:'',isNew:false}]);
 return <AuthContext.Provider value={{user,loading:false}}><ClientProvider config={config}><button onClick={()=>setOpenCounter(n=>n+1)}>Nuevo cliente</button><CRM autoOpenNewLead={openCounter} onNewLeadHandled={()=>{}} leadsData={leads} setLeadsData={setLeads} theme="light" /></ClientProvider></AuthContext.Provider>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
