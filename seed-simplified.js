
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ezlwrqlyebahulbienjs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6bHdycWx5ZWJhaHVsYmllbmpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTk2NTEsImV4cCI6MjA5MTE3NTY1MX0.UOcj5weL0K34aKcukZxGYxsgUo5acyT6CJFs7KCBB5E';

const supabase = createClient(supabaseUrl, supabaseKey);

const MOCK_LEADS = [
  { n: "Rafael", phone: "+1 817 682 3272", st: "Zoom Concretado", presupuesto: 200000, p: "Torre 25 · BAGA · Kaab On The Beach", campana: "Cancún", bio: "Mexicano radicado en Texas..." },
  { n: "Fam. Rodríguez", phone: "+52 984 123 0001", st: "Negociación", presupuesto: 4200000, p: "Gobernador 28", campana: "Referido", bio: "Familia inversionista..." },
];

const MOCK_PROPS = [
  { n: "Gobernador 28", u: 48, s: 31, roi: "24%", pr: "$280K–$1.2M", loc: "Playa del Carmen", st: "Pre-venta" },
  { n: "Monarca 28", u: 72, s: 45, roi: "19%", pr: "$180K–$650K", loc: "Playa del Carmen", st: "Construcción" },
];

async function seed() {
  console.log('Starting simplified seed...');

  // Projects
  const { error: errP } = await supabase.from('projects').upsert(
    MOCK_PROPS.map(p => ({
      name: p.n,
      units: p.u,
      sold: p.s,
      roi: p.roi,
      price_range: p.pr,
      location: p.loc,
      status: p.st
    }))
  );
  if (errP) console.error('Error projects:', errP.message);
  else console.log('Projects ok');

  // Leads
  const { error: errL } = await supabase.from('LEADS').upsert(
    MOCK_LEADS.map(l => ({
      "NOMBRE DEL CLIENTE": l.n,
      "TELEFONO": l.phone,
      "ESTATUS": l.st,
      "PRESUPUESTO": l.presupuesto,
      "PROYECTO DE INTERES": l.p,
      "CAMPAÑA": l.campana,
      "NOTAS": [{ nota: l.bio, fecha: new Date().toISOString() }]
    }))
  );
  if (errL) console.error('Error leads:', errL.message);
  else console.log('Leads ok');
}

seed();
