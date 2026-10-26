import { isNativeApp } from '../../lib/native';
import './account-security.css';
export default function PaymentsReadiness({ T, user }) {
  if (import.meta.env.MODE === 'app' || isNativeApp() || user?.isDemo || !['super_admin', 'admin', 'ceo'].includes(user?.role)) return null;
  return <section className="account-security" style={{ '--account-text': T.txt, '--account-muted': T.txt2, '--account-border': T.border }} aria-labelledby="payments-title">
    <h2 id="payments-title">Pagos</h2>
    <p><strong>Pendientes de activación</strong></p>
    <p>Los cobros en línea aún no están disponibles. Cuando se active el servicio, podrás consultar aquí las opciones de pago de tu organización.</p>
    {user.role === 'super_admin' && <p>Falta elegir Stripe u Openpay, conectar la cuenta comercial y validar el primer pago de prueba antes de activar cobros reales.</p>}
  </section>;
}
