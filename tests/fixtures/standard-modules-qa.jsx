// Browser QA intercepts every backend call; synthetic records only.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {AuthContext} from '../../src/contexts/AuthContext';
import {ClientProvider} from '../../src/contexts/ClientContext';
import {TenantConfigGate} from '../../src/contexts/TenantConfigGate';
import {getClientConfig} from '../../src/clients';
import App from '../../src/app/App';
const user={id:'20000000-0000-4000-8000-000000000099',organizationId:'20000000-0000-4000-8000-000000000001',role:'admin',name:'Admin QA',email:'qa@example.invalid',viewAllLeads:true};
createRoot(document.getElementById('root')).render(<AuthContext.Provider value={{user,loading:false,bootHydrating:false,login:async()=>{},logout:async()=>{}}}><ClientProvider config={getClientConfig('tenant')}><TenantConfigGate><App/></TenantConfigGate></ClientProvider></AuthContext.Provider>);
