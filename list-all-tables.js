
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ezlwrqlyebahulbienjs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6bHdycWx5ZWJhaHVsYmllbmpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTk2NTEsImV4cCI6MjA5MTE3NTY1MX0.UOcj5weL0K34aKcukZxGYxsgUo5acyT6CJFs7KCBB5E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listAllTables() {
  // Use a hacky way to list tables via an intentional error or just query a known view if enabled
  // Actually, let's try to query 'rpc' list if possible, or just try many names.
  // Best way via PostgREST is to check the root endpoint (which is what schema cache is)
  
  console.log("Fetching schema info...");
  const resp = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: { 'apikey': supabaseKey }
  });
  const schema = await resp.json();
  
  if (schema.definitions) {
    console.log("Tables found in schema definitions:");
    Object.keys(schema.definitions).forEach(table => {
      console.log(`- ${table}`);
      console.log("  Columns:", Object.keys(schema.definitions[table].properties));
    });
  } else {
    console.log("Could not fetch definitions. Trying direct select from common tables.");
  }
}

listAllTables();
