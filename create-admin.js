import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Cargar variables de entorno
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1];
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(url, key);

async function createAdmin() {
  console.log('Creando usuario administrador...');
  
  const email = 'super@stratos.ai';
  const password = 'AdminStratos2026';
  const name = 'Super Administrador';

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
        role: 'super_admin'
      }
    }
  });

  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('✅ Usuario creado exitosamente.');
    console.log('Email:', email);
    console.log('Password:', password);
  }
}

createAdmin();
