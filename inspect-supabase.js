
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ezlwrqlyebahulbienjs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6bHdycWx5ZWJhaHVsYmllbmpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTk2NTEsImV4cCI6MjA5MTE3NTY1MX0.UOcj5weL0K34aKcukZxGYxsgUo5acyT6CJFs7KCBB5E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const tables = ['projects', 'LEADS', 'profiles'];
  for (const table of tables) {
    console.log(`\nInspecting table: ${table}`);
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.error(`Error inspecting ${table}:`, error.message);
    } else if (data && data.length > 0) {
      console.log(`Columns for ${table}:`, Object.keys(data[0]));
    } else {
      console.log(`Table ${table} is empty, cannot inspect columns this way.`);
      // Try to get columns via a different method if possible, but this is a quick check
    }
  }
}

inspect();
