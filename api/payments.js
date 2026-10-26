/** No provider is connected yet. Never accept a charge or collect card details in this state. */
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'GET') return res.status(200).json({ enabled: false, provider: null, status: 'awaiting_provider' });
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'method_not_allowed' }); }
  return res.status(503).json({ error: 'payments_not_configured', message: 'Los pagos todavía no están habilitados. No se realizó ningún cargo.' });
}
