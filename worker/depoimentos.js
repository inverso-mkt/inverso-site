/**
 * Depoimentos do site.
 *
 *   POST /api/depoimentos            recebe um depoimento (nome, cargo, e-mail, estrelas, texto)
 *   GET  /api/depoimentos            lista os depoimentos PÚBLICOS (só os de 5 estrelas que não foram ocultados)
 *   GET  /api/depoimentos/ocultar    página de confirmação para ocultar um depoimento (link vem no e-mail)
 *   POST /api/depoimentos/ocultar    oculta o depoimento
 *
 * Regras:
 *  - Toda avaliação chega por e-mail para CONTACT_TO, com qualquer nota. As que não são 5 estrelas ficam só no e-mail.
 *  - Só 5 estrelas são gravadas no KV como públicas. O e-mail do autor nunca é gravado nem exibido.
 *  - O e-mail traz um link assinado para ocultar o depoimento depois de publicado.
 *
 * Armazenamento: KV com o nome DEPOIMENTOS (ver wrangler.jsonc). Sem o KV, o envio por e-mail continua funcionando.
 */

const MAX_BODY = 6000;
const EMAIL_RE = /^[^\s@<>"',;:]+@[^\s@<>"',;:]+\.[^\s@<>"',;:]{2,}$/;
const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|br|io|app|link|xyz)\b)/i;
const LIST_MAX = 30;

const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra } });

const html = (title, body, status = 200) =>
  new Response(
    `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} — Inverso</title><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.5rem;line-height:1.5"><h1>${title}</h1>${body}`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
  );

const clean = (v, max) =>
  String(v ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max);
const oneLine = (v) => v.replace(/\s+/g, ' ').trim();
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function sameSite(request, url) {
  const from = request.headers.get('Origin') || request.headers.get('Referer');
  if (!from) return false;
  try {
    return new URL(from).host === url.host;
  } catch {
    return false;
  }
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function sign(env, id) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(`ocultar:${env.RESEND_API_KEY || ''}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(id))).slice(0, 40);
}
async function sha(text) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))).slice(0, 32);
}
const safeEq = (a, b) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

const cacheKey = (url) => new Request(url.origin + '/api/depoimentos');

async function listar(env, url, ctx) {
  const cache = caches.default;
  const hit = await cache.match(cacheKey(url));
  if (hit) return hit;
  const out = [];
  if (env.DEPOIMENTOS) {
    const { keys } = await env.DEPOIMENTOS.list({ prefix: 'd:', limit: 200 });
    for (const k of keys.reverse()) {
      if (out.length >= LIST_MAX) break;
      const v = await env.DEPOIMENTOS.get(k.name, 'json');
      if (!v || !v.publico || v.oculto) continue;
      out.push({ nome: v.nome, papel: v.papel || '', texto: v.texto, data: String(v.criado || '').slice(0, 7) });
    }
  }
  const res = json(out, 200, { 'Cache-Control': 'public, max-age=60, s-maxage=60' });
  ctx?.waitUntil(cache.put(cacheKey(url), res.clone()));
  return res;
}

async function enviar(request, env, url, ctx) {
  if (!sameSite(request, url)) return json({ ok: false, error: 'Pedido recusado.' }, 403);
  if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY) return json({ ok: false, error: 'Texto grande demais.' }, 413);

  let data;
  try {
    const type = request.headers.get('Content-Type') || '';
    if (!type.includes('application/x-www-form-urlencoded') && !type.includes('multipart/form-data')) return json({ ok: false, error: 'Formato não aceito.' }, 415);
    data = await request.formData();
  } catch {
    return json({ ok: false, error: 'Não foi possível ler o formulário.' }, 400);
  }

  if (clean(data.get('bot-field'), 200)) return json({ ok: true }); // robô: finge que deu certo

  const nome = oneLine(clean(data.get('nome'), 80));
  const papel = oneLine(clean(data.get('papel'), 80));
  const email = oneLine(clean(data.get('email'), 254));
  const estrelas = Number(clean(data.get('estrelas'), 2));
  const texto = clean(data.get('texto'), 600);

  if (nome.length < 2) return json({ ok: false, error: 'Informe seu nome.' }, 422);
  if (!EMAIL_RE.test(email)) return json({ ok: false, error: 'Informe um e-mail válido.' }, 422);
  if (!Number.isInteger(estrelas) || estrelas < 1 || estrelas > 5) return json({ ok: false, error: 'Escolha de 1 a 5 estrelas.' }, 422);
  if (texto.length < 20) return json({ ok: false, error: 'Conte um pouco mais: o texto precisa ter pelo menos 20 caracteres.' }, 422);
  if (LINK_RE.test(texto) || LINK_RE.test(nome) || LINK_RE.test(papel)) return json({ ok: false, error: 'Não aceitamos links no depoimento.' }, 422);
  if (clean(data.get('consentimento'), 10) !== 'sim') return json({ ok: false, error: 'É preciso concordar com a publicação.' }, 422);

  if (!env.RESEND_API_KEY || !env.CONTACT_TO) {
    console.error('depoimentos: RESEND_API_KEY ou CONTACT_TO não configurados');
    return json({ ok: false, error: 'O envio ainda não está configurado.' }, 500);
  }

  // Limite simples: um envio por pessoa a cada 2 minutos.
  const ip = request.headers.get('CF-Connecting-IP') || '';
  if (env.DEPOIMENTOS && ip) {
    const rl = 'rl:' + (await sha(ip + '|dep'));
    if (await env.DEPOIMENTOS.get(rl)) return json({ ok: false, error: 'Você acabou de enviar um depoimento. Tente de novo em alguns minutos.' }, 429);
    await env.DEPOIMENTOS.put(rl, '1', { expirationTtl: 120 });
  }

  const publico = estrelas === 5 && !!env.DEPOIMENTOS;
  const agora = new Date();
  const id = `${String(agora.getTime()).padStart(13, '0')}-${(await sha(email + Math.random())).slice(0, 8)}`;
  if (publico) {
    await env.DEPOIMENTOS.put(`d:${id}`, JSON.stringify({ id, nome, papel, texto, estrelas, criado: agora.toISOString(), publico: true, oculto: false }));
    await caches.default.delete(cacheKey(url));
  }

  const quando = agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const estr = '★'.repeat(estrelas) + '☆'.repeat(5 - estrelas);
  const status = publico
    ? 'PUBLICADO no site (5 estrelas).'
    : estrelas === 5
    ? 'Não publicado: o armazenamento dos depoimentos não está ligado.'
    : 'NÃO publicado: só depoimentos de 5 estrelas aparecem no site. Vale responder esta pessoa.';
  let extra = '';
  let extraHtml = '';
  if (publico) {
    const link = `${url.origin}/api/depoimentos/ocultar?id=${encodeURIComponent(id)}&t=${await sign(env, id)}`;
    extra = `\n\nPara tirar do site: ${link}`;
    extraHtml = `<p style="margin:16px 0 0"><a href="${esc(link)}">Ocultar este depoimento do site</a></p>`;
  }
  const text = [`Novo depoimento pelo site da Inverso`, '', `Nota: ${estr} (${estrelas}/5)`, `Nome: ${nome}`, `Cargo/empresa: ${papel || '—'}`, `E-mail: ${email}`, `Recebido em: ${quando} (Brasília)`, '', 'Texto:', texto, '', status + extra].join('\n');
  const body =
    `<div style="font-family:system-ui,sans-serif;line-height:1.5;color:#111"><h2 style="margin:0 0 12px">Novo depoimento: ${estr}</h2>` +
    `<p style="margin:0"><b>Nome:</b> ${esc(nome)}<br><b>Cargo/empresa:</b> ${esc(papel || '—')}<br><b>E-mail:</b> ${esc(email)}<br><b>Recebido em:</b> ${esc(quando)} (Brasília)</p>` +
    `<p style="margin:16px 0 4px"><b>Texto:</b></p><p style="margin:0;white-space:pre-wrap">${esc(texto)}</p>` +
    `<p style="margin:16px 0 0"><b>${esc(status)}</b></p>${extraHtml}</div>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.CONTACT_FROM || 'Inverso <onboarding@resend.dev>',
        to: [env.CONTACT_TO],
        reply_to: email,
        subject: `Depoimento ${estrelas}★ de ${nome}`.slice(0, 150),
        text,
        html: body,
      }),
    });
    if (!r.ok) {
      console.error('depoimentos: Resend respondeu', r.status, (await r.text()).slice(0, 300));
      if (!publico) return json({ ok: false, error: 'Não conseguimos enviar agora. Tente de novo em instantes.' }, 502);
    }
  } catch (e) {
    console.error('depoimentos: falha de rede ao chamar o Resend', String(e));
    if (!publico) return json({ ok: false, error: 'Não conseguimos enviar agora. Tente de novo em instantes.' }, 502);
  }
  return json({ ok: true, publicado: publico });
}

async function ocultar(request, env, url, ctx) {
  const id = clean(url.searchParams.get('id'), 60);
  const t = clean(url.searchParams.get('t'), 60);
  if (!/^\d{13}-[0-9a-f]{8}$/.test(id) || !env.RESEND_API_KEY || !safeEq(t, await sign(env, id))) return html('Link inválido', '<p>Este link não é válido ou expirou.</p>', 403);
  if (request.method === 'GET') {
    return html(
      'Ocultar depoimento?',
      `<p>O depoimento deixa de aparecer no site. Você pode me pedir para recolocar depois.</p><form method="POST" action="${esc(url.pathname + url.search)}"><button style="font:inherit;padding:.7rem 1.2rem;border:2px solid #000;background:#000;color:#fff;border-radius:99px;cursor:pointer">Ocultar</button></form>`
    );
  }
  if (!sameSite(request, url)) return html('Pedido recusado', '<p>Abra o link pelo e-mail e tente de novo.</p>', 403);
  if (!env.DEPOIMENTOS) return html('Indisponível', '<p>O armazenamento dos depoimentos não está ligado.</p>', 500);
  const v = await env.DEPOIMENTOS.get(`d:${id}`, 'json');
  if (!v) return html('Não encontrado', '<p>Esse depoimento não existe mais.</p>', 404);
  v.oculto = true;
  await env.DEPOIMENTOS.put(`d:${id}`, JSON.stringify(v));
  await caches.default.delete(cacheKey(url));
  return html('Depoimento oculto', '<p>Pronto. Ele já saiu do site.</p><p><a href="/depoimentos/">Voltar</a></p>');
}

export async function depoimentos(request, env, url, ctx) {
  if (url.pathname === '/api/depoimentos/ocultar') {
    if (request.method !== 'GET' && request.method !== 'POST') return new Response('Método não permitido', { status: 405 });
    return ocultar(request, env, url, ctx);
  }
  if (request.method === 'GET') return listar(env, url, ctx);
  if (request.method === 'POST') return enviar(request, env, url, ctx);
  return new Response('Método não permitido', { status: 405, headers: { Allow: 'GET, POST' } });
}
