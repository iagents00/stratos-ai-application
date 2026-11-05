import React from 'react';
import {createRoot} from 'react-dom/client';
import LoginScreenNative from '../../src/landing/LoginScreenNative';
import {ClientContext} from '../../src/contexts/ClientContext';
window.loginCalls=[];
window.barStyles=[];
window.Capacitor={isNativePlatform:()=>true,registerPlugin:name=>name==='SystemBars'?{setStyle:async({style})=>{window.barStyles.push(style);}}:null};

const root=createRoot(document.getElementById('root'));
window.unmountLogin=()=>root.unmount();
root.render(<ClientContext.Provider value={{clientId:'tenant',config:{name:'Stratos',brand:{accent:'#00D1FF'}}}}><LoginScreenNative onLogin={async(email,password)=>{window.loginCalls.push({email,password});await new Promise(resolve=>setTimeout(resolve,250));return {error:'Correo o contraseña incorrectos.'};}} /></ClientContext.Provider>);
