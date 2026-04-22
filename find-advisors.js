
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ezlwrqlyebahulbienjs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6bHdycWx5ZWJhaHVsYmllbmpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTk2NTEsImV4cCI6MjA5MTE3NTY1MX0.UOcj5weL0K34aKcukZxGYxsgUo5acyT6CJFs7KCBB5E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findAdvisors() {
  const { data, error } = await supabase.from('LEADS').select('ASESOR');
  if (error) console.error(error.message);
  else {
    const advisors = [...new Set(data.map(l => l.ASESOR))];
    console.log('Advisors found in DB:', advisors);
  }
}

findAdvisors();
