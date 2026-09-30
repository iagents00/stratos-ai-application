import { createContext, useContext } from 'react';
import { supabase } from '../lib/supabase';
export const HuliContext=createContext(null);
export const useHuli=()=>useContext(HuliContext);
export async function queryHuli(body,signal) {
  const {data:sessionData}=await supabase.auth.getSession();
  const token=sessionData.session?.access_token;
  const headers={...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})};
  const response=await fetch('/api/dental-huli',{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,credentials:'same-origin',signal});
  let data;try{data=await response.json();}catch{throw new Error('No se pudo leer la respuesta. Reintenta.');}
  if(!response.ok)throw new Error(data.error || 'No se pudo consultar Huli.');
  return data;
}
