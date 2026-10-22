export async function onRequestPost({ request, env }) {
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '');
  const u = await fetch(env.SUPABASE_URL + '/auth/v1/user', {
    headers: { Authorization: 'Bearer ' + token, apikey: env.SUPABASE_ANON_KEY }
  });
  if (!u.ok) return json({ error: 'no autorizado' }, 401);
  const body = await request.json().catch(() => ({}));
  if (!body.imagen) return json({ error: 'sin imagen' }, 400);
  if (!env.GEMINI_API_KEY) return json({ monto: null, error: 'Falta la variable GEMINI_API_KEY en Cloudflare' });
  const modelo = env.MODELO_GEMINI || 'gemini-3.5-flash';
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + modelo + ':generateContent', {
      method: 'POST',
      headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { inline_data: { mime_type: 'image/jpeg', data: body.imagen } },
          { text: 'Comprobante de transferencia en pesos colombianos. Responde SOLO JSON: {"monto": entero en pesos sin separadores (ej. $6.000,00 -> 6000) o null si no se ve claro, "referencia": texto o null}.' }
        ] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' }
      })
    });
    const d = await r.json();
    if (!r.ok) return json({ monto: null, error: 'Gemini ' + r.status + ': ' + (d.error?.message || 'error').slice(0, 120) });
    const txt = (d.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    const m = txt.match(/\{[\s\S]*\}/);
    return json(m ? JSON.parse(m[0]) : { monto: null, referencia: null });
  } catch (e) {
    return json({ monto: null, error: String(e).slice(0, 120) });
  }
}
