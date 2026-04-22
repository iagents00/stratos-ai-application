import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Cargar variables de entorno
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1];
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(url, key);

async function testAuth() {
  console.log('Probando login...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@stratos.ai',
    password: 'AdminStratos2026'
  });

  if (error) {
    console.log('Error de Login:', error.message);
    if (error.message.includes('Email not confirmed')) {
      console.log('⚠️ El usuario EXISTE pero no está confirmado.');
    }
  } else {
    console.log('✅ Login Exitoso:', data.user.id);
  }
}

testAuth();
