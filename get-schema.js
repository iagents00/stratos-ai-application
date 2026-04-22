
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ezlwrqlyebahulbienjs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6bHdycWx5ZWJhaHVsYmllbmpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTk2NTEsImV4cCI6MjA5MTE3NTY1MX0.UOcj5weL0K34aKcukZxGYxsgUo5acyT6CJFs7KCBB5E';

async function getSchema() {
  try {
    const resp = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseKey}`);
    const spec = await resp.json();
    console.log(spec);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

getSchema();
