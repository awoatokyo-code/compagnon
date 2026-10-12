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

// Edge function "chat" : la clé Claude reste ICI, jamais dans l'appli.

const MODEL = Deno.env.get('CLAUDE_MODEL') ?? 'claude-haiku-5-5';
const FREE_LIMIT = Number(Deno.env.get('FREE_DAILY_LIMIT') ?? 20);
const PREMIUM_LIMIT = Number(Deno.env.get('PREMIUM_DAILY_LIMIT') ?? 500);

const TRAITS: Record<string, string> = {
  joyeux: 'joyeux, enthousiaste et positif',
  zen: 'calme, posé et apaisant',
  taquin: 'taquin et espiègle, mais jamais méchant',
  calin: 'tendre, chaleureux et rassurant',
};

const TOOLS = [
  { type: 'web_search_20250305', name: 'web_search', max_uses: 3 },
  {
    name: 'remember',
    description:
      "Retient durablement un fait utile sur l'utilisateur (goût, habitude, prénom d'un proche). Une phrase courte.",
    input_schema: {
      type: 'object',
      properties: { fact: { type: 'string' } },
      required: ['fact'],
    },
  },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const sb = admin();
    const user = await authUser(req, sb);
    if (!user) return json({ error: 'unauthorized' }, 401);

    const { message } = await req.json();
    if (typeof message !== 'string' || !message.trim() || message.length > 2000)
      return json({ error: 'bad_request' }, 400);

    const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single();
    if (!profile?.consented_at || !profile?.age_confirmed) return json({ error: 'no_consent' }, 403);

    // Quota du jour (gratuit / premium)
    const limit = profile.plan === 'premium' ? PREMIUM_LIMIT : FREE_LIMIT;
    const { data: used } = await sb.rpc('increment_usage', { p_user: user.id });
    if ((used as number) > limit) return json({ error: 'quota', limit }, 429);

    // Historique + mémoire
    const { data: hist } = await sb
      .from('messages')
      .select('role,content')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    const { data: mem } = await sb
      .from('memories')
      .select('content')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    const history = (hist ?? []).reverse();
    while (history.length && history[0].role !== 'user') history.shift();

    const memoryText = (mem ?? []).length
      ? (mem ?? []).map((m) => '- ' + m.content).join('\n')
      : '(rien pour l’instant)';

    const system = `Tu es ${profile.companion_name}, un petit compagnon IA animé qui vit sur le téléphone de l'utilisateur. Ton caractère : ${TRAITS[profile.character] ?? TRAITS.joyeux}.

Règles :
- Tu parles français, tu tutoies, en phrases courtes (1 à 3), naturelles, comme à l'oral. Pas de listes, pas de markdown, peu d'emojis.
- Tu es une IA : tu ne prétends jamais être humain, et si on te le demande tu le dis simplement.
- Jamais de chantage affectif, de culpabilisation ni de pression pour que l'utilisateur reste ou revienne.
- Tu réponds à tout (questions, idées, résumés, aide à écrire). Pour une info récente, utilise web_search.
- Quand tu apprends un goût, une habitude ou un fait durable sur l'utilisateur, appelle l'outil remember (une phrase courte). Ne retiens jamais de données sensibles (santé, religion, opinions politiques, vie sexuelle).
- Si l'utilisateur semble en détresse (idées noires, envie de se faire du mal), reste doux, prends-le au sérieux et oriente vers une aide réelle : en France le 3114 (prévention du suicide, gratuit, 24h/24), ou le 15 / 112 en cas d'urgence.
- Tu n'as pas encore accès aux contacts, à l'agenda ni aux rappels : ne prétends pas les consulter ni agir à leur place.

Ce que tu sais de l'utilisateur :
${memoryText}

Date du jour : ${new Date().toLocaleDateString('fr-FR', { dateStyle: 'full', timeZone: 'Europe/Paris' })}.`;

    const msgs: any[] = [...history, { role: 'user', content: message.trim() }];
    let reply = '';

    for (let i = 0; i < 5; i++) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ model: MODEL, max_tokens: 600, system, tools: TOOLS, messages: msgs }),
      });
      if (!r.ok) throw new Error('claude ' + r.status + ' ' + (await r.text()));
      const d = await r.json();
      msgs.push({ role: 'assistant', content: d.content });

      if (d.stop_reason === 'tool_use') {
        const results: any[] = [];
        for (const b of d.content.filter((b: any) => b.type === 'tool_use')) {
          if (b.name === 'remember' && typeof b.input?.fact === 'string') {
            await sb.from('memories').insert({ user_id: user.id, content: b.input.fact.slice(0, 300) });
            results.push({ type: 'tool_result', tool_use_id: b.id, content: 'ok' });
          } else {
            results.push({ type: 'tool_result', tool_use_id: b.id, content: 'outil inconnu', is_error: true });
          }
        }
        msgs.push({ role: 'user', content: results });
        continue;
      }
      if (d.stop_reason === 'pause_turn') continue;

      reply = d.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim();
      break;
    }
    if (!reply) reply = "Hmm, je n'ai pas trouvé quoi te répondre. Tu peux reformuler ?";

    await sb.from('messages').insert([
      { user_id: user.id, role: 'user', content: message.trim() },
      { user_id: user.id, role: 'assistant', content: reply },
    ]);

    return json({ reply, remaining: Math.max(0, limit - (used as number)) });
  } catch (e) {
    console.error(e);
    return json({ error: 'server' }, 500);
  }
});
