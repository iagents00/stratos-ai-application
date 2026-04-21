
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1];
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(url, key);

async function check() {
  const tables = ['leads', 'profiles', 'users_data', 'crm_leads', 'properties'];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (!error) {
      console.log(`Table found: ${table}`);
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`Table ${table} not accessible: ${error.message}`);
    }
  }
}

check();
