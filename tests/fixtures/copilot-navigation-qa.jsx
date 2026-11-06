// Local-only fixture: browser runner intercepts every backend request.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {AuthContext} from '../../src/contexts/AuthContext';
import {ClientProvider} from '../../src/contexts/ClientContext';
import {DEFAULT_CLIENT_CONFIG} from '../../src/clients/_shared/defaults';
import App from '../../src/app/App';
import Copilot from '../../src/app/views/Copilot';
const params=new URLSearchParams(location.search);
const chatOnly=params.has('chat');
const live=params.has('live');
const chatTheme=params.get('theme')==='dark'?'dark':'light';
const user={id:'10000000-0000-4000-a000-000000000099',organizationId:'10000000-0000-4000-a000-000000000001',role:'admin',name:'QA Navegación',email:'qa@example.invalid',isDemo:!chatOnly&&!live,_offline:live,viewAllLeads:true};
const config={...DEFAULT_CLIENT_CONFIG,id:'tenant',name:'Empresa QA',features:{...DEFAULT_CLIENT_CONFIG.features,copilotModule:true,teamAdmin:true,comandoDirectivo:false}};
if(!chatOnly&&!localStorage.getItem('stratos.crm.view.'+user.id))localStorage.setItem('stratos.crm.view.'+user.id,'copilot');
createRoot(document.getElementById('root')).render(<AuthContext.Provider value={{user,loading:false,bootHydrating:false,login:async()=>{},logout:async()=>{}}}><ClientProvider config={config}>{chatOnly?<div style={{display:'flex',height:'100%',minHeight:0}}><Copilot theme={chatTheme} onBack={()=>{document.body.dataset.back='yes';}} /></div>:<App/>}</ClientProvider></AuthContext.Provider>);
