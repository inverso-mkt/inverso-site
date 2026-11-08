/**
 * Inverso — função do formulário de contato.
 *
 * Atende só /api/* (o resto do site é servido como arquivo estático):
 *   POST /api/contato       formulário de contato → e-mail via Resend
 *   GET  /api/substack      artigos do Substack (feed RSS) em JSON
 *   GET/POST /api/depoimentos[/ocultar]   depoimentos (ver depoimentos.js)
 * Valida os campos, descarta robôs (campo-armadilha) e envia o pedido por e-mail via Resend.
 *
 * Configuração (Cloudflare → Workers → inverso-site → Configurações → Variáveis e segredos):
 *   RESEND_API_KEY  chave de API do Resend (segredo)
 *   CONTACT_TO      e-mail que recebe os contatos (segredo)
 *   CONTACT_FROM    opcional; remetente. Padrão: "Inverso <onboarding@resend.dev>"
 */

import { substack } from './substack.js';
import { depoimentos } from './depoimentos.js';

const MAX_BODY = 20000;
const LIMITS = { nome: 120, email: 254, whatsapp: 40, area: 60, origem: 40, mensagem: 4000 };
const EMAIL_RE = /^[^\s@<>"',;:]+@[^\s@<>"',;:]+\.[^\s@<>"',;:]{2,}$/;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const page = (title, text, status) =>
  new Response(
    `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} — Inverso</title><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.5rem;line-height:1.5"><h1>${title}</h1><p>${text}</p><p><a href="/#contato">Voltar ao formulário</a></p>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
  );

const clean = (v, max) =>
  String(v ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max);

const oneLine = (v) => v.replace(/[\r\n\t]+/g, ' ').trim();
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

async function contato(request, env, url) {
  const wantsJson = (request.headers.get('Accept') || '').includes('application/json');
  const fail = (status, msg) => (wantsJson ? json({ ok: false, error: msg }, status) : page('Não deu certo', msg, status));
  const done = () => (wantsJson ? json({ ok: true }) : Response.redirect(new URL('/obrigado/', url).href, 303));

  if (!sameSite(request, url)) return fail(403, 'Pedido recusado.');

  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > MAX_BODY) return fail(413, 'Mensagem grande demais.');

  let data;
  try {
    const type = request.headers.get('Content-Type') || '';
    if (!type.includes('application/x-www-form-urlencoded') && !type.includes('multipart/form-data')) {
      return fail(415, 'Formato não aceito.');
    }
    data = await request.formData();
  } catch {
    return fail(400, 'Não foi possível ler o formulário.');
  }

  // Campo-armadilha: humano não vê, robô preenche. Responde "ok" e não envia nada.
  if (clean(data.get('bot-field'), 200)) return done();

  const f = {};
  for (const k of Object.keys(LIMITS)) f[k] = clean(data.get(k), LIMITS[k]);
  f.nome = oneLine(f.nome);
  f.email = oneLine(f.email);

  if (f.nome.length < 2) return fail(422, 'Informe seu nome.');
  if (!EMAIL_RE.test(f.email)) return fail(422, 'Informe um e-mail válido.');
  if (f.mensagem.length < 5) return fail(422, 'Escreva sua mensagem.');
  if (clean(data.get('consentimento'), 10) !== 'sim') return fail(422, 'É preciso concordar com o contato.');

  if (!env.RESEND_API_KEY || !env.CONTACT_TO) {
    console.error('contato: RESEND_API_KEY ou CONTACT_TO não configurados');
    return fail(500, 'O envio ainda não está configurado.');
  }

  const quando = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const text = [
    'Novo contato pelo site da Inverso',
    '',
    `Nome: ${f.nome}`,
    `E-mail: ${f.email}`,
    `WhatsApp: ${f.whatsapp || '—'}`,
    `Área: ${f.area || '—'}`,
    `Página: ${f.origem || '—'}`,
    `Recebido em: ${quando} (Brasília)`,
    '',
    'Mensagem:',
    f.mensagem,
  ].join('\n');
  const html =
    `<div style="font-family:system-ui,sans-serif;line-height:1.5;color:#111"><h2 style="margin:0 0 12px">Novo contato pelo site</h2>` +
    `<p style="margin:0"><b>Nome:</b> ${esc(f.nome)}<br><b>E-mail:</b> ${esc(f.email)}<br><b>WhatsApp:</b> ${esc(f.whatsapp || '—')}<br>` +
    `<b>Área:</b> ${esc(f.area || '—')}<br><b>Página:</b> ${esc(f.origem || '—')}<br><b>Recebido em:</b> ${esc(quando)} (Brasília)</p>` +
    `<p style="margin:16px 0 4px"><b>Mensagem:</b></p><p style="margin:0;white-space:pre-wrap">${esc(f.mensagem)}</p></div>`;

  let r;
  try {
    r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.CONTACT_FROM || 'Inverso <onboarding@resend.dev>',
        to: [env.CONTACT_TO],
        reply_to: f.email,
        subject: `Novo contato: ${f.nome}${f.area ? ' · ' + f.area : ''}`.slice(0, 150),
        text,
        html,
      }),
    });
  } catch (e) {
    console.error('contato: falha de rede ao chamar o Resend', String(e));
    return fail(502, 'Não conseguimos enviar agora. Tente de novo em instantes.');
  }
  if (!r.ok) {
    // Só o status e o corpo do erro (sem dados do visitante) vão para o log.
    console.error('contato: Resend respondeu', r.status, (await r.text()).slice(0, 300));
    return fail(502, 'Não conseguimos enviar agora. Tente de novo em instantes.');
  }
  return done();
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/substack') {
      if (request.method !== 'GET') return new Response('Método não permitido', { status: 405, headers: { Allow: 'GET' } });
      return substack(request, env, url, ctx);
    }
    if (url.pathname === '/api/depoimentos' || url.pathname === '/api/depoimentos/ocultar') return depoimentos(request, env, url, ctx);
    if (url.pathname === '/api/contato') {
      if (request.method !== 'POST') {
        return new Response('Método não permitido', { status: 405, headers: { Allow: 'POST' } });
      }
      return contato(request, env, url);
    }
    if (url.pathname.startsWith('/api/')) return new Response('Não encontrado', { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
