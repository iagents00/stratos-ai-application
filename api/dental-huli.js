/* global process */
import { SESSION_COOKIE, cookieValue, passwordMatches, signSession, verifySession } from '../server/dental-security.mjs';
import { createHuliClient, discoverConnection, executeQuery } from '../server/dental-huli.mjs';
import { HuliError } from '../supabase/functions/_shared/huli.mjs';
import { authorizeClinic } from '../server/clinical-auth.mjs';
import { createClinicalTrace, readClinicalBody } from '../server/clinical-request.mjs';
let cachedScope;
export default async function handler(req,res) {
  const trace=createClinicalTrace(req.method);
  res.setHeader('X-Request-ID',trace.requestId);
  res.setHeader('Cache-Control','private, no-store');res.setHeader('Pragma','no-cache');res.setHeader('X-Content-Type-Options','nosniff');
  const send=(status,body)=>{trace.complete(status);return res.status(status).json(body);};
  try {
    const config=JSON.parse(process.env.DENTAL_HULI_CONFIG || '{}');
    if(!config.apiKey || !config.userId || !config.passwordHash || !config.sessionSecret || !config.organizationId)return send(503,{error:'La conexión Huli no está configurada.'});
    if(!['GET','POST'].includes(req.method))return send(405,{error:'Método no permitido.'});
    if(req.method==='POST' && req.headers.origin!==`https://${req.headers.host}`)return send(403,{error:'Origen no permitido.'});
    const body=req.method==='POST'?readClinicalBody(req):{};
    if(req.method==='POST')trace.setAction(body.action);
    const tenantMode=!!config.stratosOrganizationId;
    const actorId=tenantMode?await authorizeClinic(req,config):null;
    const authenticated=tenantMode?!!actorId:verifySession(cookieValue(req.headers.cookie),config);
    if(actorId)trace.setActor(config.stratosOrganizationId,actorId);
    const cookie=token=>`${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${token?14400:0}`;
    if(!tenantMode && req.method==='POST' && body.action==='login') {
      if(!passwordMatches(body.password,config))return send(401,{error:'La clave de acceso no es correcta.'});
      res.setHeader('Set-Cookie',cookie(signSession(config)));return send(200,{authenticated:true});
    }
    if(!authenticated)return send(401,{error:'Ingresa al perfil clínico para consultar Huli.'});
    if(!tenantMode && req.method==='POST' && body.action==='logout') {res.setHeader('Set-Cookie',cookie(''));return send(200,{authenticated:false});}
    const client=createHuliClient(config);
    if(!cachedScope || cachedScope.organization!==config.organizationId || cachedScope.expires<Date.now())cachedScope={organization:config.organizationId,expires:Date.now()+60000,data:await discoverConnection(client,config)};
    if(req.method==='GET')return send(200,{authenticated:true,...cachedScope.data});
    return send(200,await executeQuery(client,cachedScope.data,body));
  }catch(error){return send(error instanceof HuliError?error.status:502,{error:error instanceof HuliError?error.message:'No se pudo consultar Huli. Intenta de nuevo.'});}
}
