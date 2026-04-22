
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ezlwrqlyebahulbienjs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6bHdycWx5ZWJhaHVsYmllbmpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTk2NTEsImV4cCI6MjA5MTE3NTY1MX0.UOcj5weL0K34aKcukZxGYxsgUo5acyT6CJFs7KCBB5E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testProfiles() {
  // Try to find if there is ANY column we can use to insert
  // Since it's likely a profile table, it might need a user_id or id
  const { data, error } = await supabase.from('profiles').insert([{ role: 'admin' }]).select();
  if (error) {
    console.error(error.message);
    // Try with a random ID if it requires one
    const { data: d2, error: e2 } = await supabase.from('profiles').insert([{ id: '00000000-0000-0000-0000-000000000000', role: 'admin' }]).select();
    if (e2) console.error('Second attempt failed:', e2.message);
    else console.log(d2);
  } else {
    console.log(data);
  }
}

testProfiles();
