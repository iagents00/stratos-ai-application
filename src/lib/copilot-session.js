import {createClient} from '@supabase/supabase-js';
import {SUPABASE_REST_URL,SUPABASE_ANON_KEY} from './supabase';

// A request keeps the JWT with which it started, including its history writes.
// This client has no login state, storage, refresh timer or shared auth listener.
export function copilotRequestClient(session) {
 const token=session.access_token;
 return createClient(SUPABASE_REST_URL,SUPABASE_ANON_KEY,{
  accessToken:async()=>token,
 });
}
