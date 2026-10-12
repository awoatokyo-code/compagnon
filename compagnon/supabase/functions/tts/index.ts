import { createClient } from 'npm:@supabase/supabase-js@2';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

export const admin = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

export async function authUser(req: Request, sb: ReturnType<typeof admin>) {
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data } = await sb.auth.getUser(token);
  return data.user;
}

import { encodeBase64 } from 'jsr:@std/encoding@1/base64';
// Edge function "tts" : voix neuronale (OpenAI TTS). Une voix par compagnon.

const VOICES: Record<string, string> = {
  axo: 'coral',
  capy: 'sage',
  gobi: 'ash',
  pixel: 'echo',
  lumi: 'shimmer',
  mousse: 'fable',
  mochi: 'nova',
  boba: 'alloy',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const sb = admin();
    const user = await authUser(req, sb);
    if (!user) return json({ error: 'unauthorized' }, 401);

    const { text } = await req.json();
    if (typeof text !== 'string' || !text.trim() || text.length > 600) return json({ error: 'bad_request' }, 400);

    const { data: profile } = await sb.from('profiles').select('companion,plan').eq('id', user.id).single();
    if (!profile) return json({ error: 'no_profile' }, 403);

    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice: VOICES[profile.companion] ?? 'coral',
        input: text,
        instructions: 'Parle en français, de façon naturelle et chaleureuse, comme un petit compagnon vivant et expressif.',
        response_format: 'mp3',
      }),
    });
    if (!r.ok) throw new Error('tts ' + r.status);
    return json({ audio: encodeBase64(new Uint8Array(await r.arrayBuffer())) });
  } catch (e) {
    console.error(e);
    return json({ error: 'server' }, 500);
  }
});
