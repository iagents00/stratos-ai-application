import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { boundedAccountOperation } from '../lib/account-security';
import { P } from '../design-system/tokens';
import '../app/components/account-security.css';
export default function EmailConfirmation({ confirmation }) {
  const [message, setMessage] = useState('Comprobando la confirmación de tu correo…');
  useEffect(() => {
    let active = true;
    if (!confirmation.token) { setMessage('Sigue las instrucciones enviadas a tus buzones para completar el cambio. Después inicia sesión con tu correo confirmado.'); return; }
    boundedAccountOperation(supabase.auth.getUser(confirmation.token)).then(({data,error}) => {
      if (!active) return;
      setMessage(error || !data?.user?.email ? 'No se pudo verificar este enlace. Intenta iniciar sesión o solicita otro cambio desde tu perfil.' : data.user.new_email ? 'Falta completar la confirmación. Revisa también el otro buzón.' : `Correo confirmado: ${data.user.email}. Ya puedes usarlo para iniciar sesión.`);
    }).catch(() => { if (active) setMessage('No se pudo comprobar el correo. Revisa tu conexión e intenta iniciar sesión.'); });
    return () => { active = false; };
  }, [confirmation]);
  return <main style={{ minHeight:'100dvh', display:'grid', placeItems:'center', padding:24, background:P.bg }}><section className="account-security" style={{ maxWidth:480, '--account-text':P.txt,'--account-muted':P.txt2,'--account-border':P.border,'--account-accent':P.accent }}><h1>Confirmación de correo</h1><p role="status">{message}</p><a style={{color:P.accent}} href="/login">Ir al acceso de Stratos</a></section></main>;
}
