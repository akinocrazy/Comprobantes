export async function onRequestPost({ request, env }) {
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '');
  const u = await fetch(env.SUPABASE_URL + '/auth/v1/user', {
    headers: { Authorization: 'Bearer ' + token, apikey: env.SUPABASE_ANON_KEY }
  });
  if (!u.ok) return json({ error: 'no autorizado' }, 401);
  const body = await request.json().catch(() => ({}));
  if (!body.imagen) return json({ error: 'sin imagen' }, 400);
  if (!env.ANTHROPIC_API_KEY) return json({ monto: null, error: 'Falta la variable ANTHROPIC_API_KEY en Cloudflare' });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: env.MODELO || 'claude-haiku-5-5',
        max_tokens: 200,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: body.imagen } },
          { type: 'text', text: 'Comprobante de transferencia en pesos colombianos. Responde SOLO JSON: {"monto": entero en pesos sin separadores (ej. $6.000,00 -> 6000) o null si no se ve claro, "referencia": texto o null}.' }
        ] }]
      })
    });
    const d = await r.json();
    if (!r.ok) return json({ monto: null, error: 'Anthropic ' + r.status + ': ' + (d.error?.message || 'error') });
    const m = (d.content?.[0]?.text || '').match(/\{[\s\S]*\}/);
    return json(m ? JSON.parse(m[0]) : { monto: null, referencia: null });
  } catch (e) {
    return json({ monto: null, error: String(e) });
  }
}
