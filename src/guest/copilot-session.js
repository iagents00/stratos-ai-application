import {supabase} from './backend.js';
// Guest builds retain their local-only backend and never load the real SDK.
export function copilotRequestClient() {return supabase;}
