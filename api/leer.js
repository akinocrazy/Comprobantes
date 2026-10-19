export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const u = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
    headers: { Authorization: 'Bearer ' + token, apikey: process.env.SUPABASE_ANON_KEY }
  });
  if (!u.ok) return res.status(401).json({ error: 'no autorizado' });
  const { imagen } = req.body || {};
  if (!imagen) return res.status(400).json({ error: 'sin imagen' });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.MODELO || 'claude-haiku-5-5',
        max_tokens: 200,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imagen } },
          { type: 'text', text: 'Comprobante de transferencia en pesos colombianos. Responde SOLO JSON: {"monto": entero en pesos sin separadores (ej. $6.000,00 -> 6000) o null si no se ve claro, "referencia": texto o null}.' }
        ] }]
      })
    });
    const d = await r.json();
    const m = (d.content?.[0]?.text || '').match(/\{[\s\S]*\}/);
    res.json(m ? JSON.parse(m[0]) : { monto: null, referencia: null });
  } catch (e) {
    res.json({ monto: null, referencia: null });
  }
}
