/**
 * GET /api/substack — lê o feed RSS público do Substack da Inverso e devolve os artigos em JSON.
 * O endereço do Substack vem de /data/redes.json (campo "substack"). Sem endereço, devolve lista vazia.
 * Só passam título, link, data, um resumo curto e a imagem de capa. O texto completo continua no Substack.
 */

const MAX_ITEMS = 12;

const decode = (s) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1]).trim() : '';
};

const plain = (html) => decode(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const httpsUrl = (u) => {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' ? x.href : '';
  } catch {
    return '';
  }
};

export function parseFeed(xml) {
  const items = [];
  for (const chunk of xml.split(/<item[\s>]/i).slice(1, MAX_ITEMS + 1)) {
    const title = plain(tag(chunk, 'title'));
    const link = httpsUrl(tag(chunk, 'link'));
    if (!title || !link) continue;
    const when = new Date(tag(chunk, 'pubDate'));
    const img = chunk.match(/<enclosure[^>]*\surl="([^"]+)"[^>]*type="image\//i) || chunk.match(/<enclosure[^>]*type="image\/[^"]*"[^>]*\surl="([^"]+)"/i);
    items.push({
      title: title.slice(0, 160),
      url: link,
      date: isNaN(when) ? '' : when.toISOString().slice(0, 10),
      desc: plain(tag(chunk, 'description')).slice(0, 200),
      img: img ? httpsUrl(decode(img[1])) : '',
    });
  }
  return items;
}

export async function substack(request, env, url, ctx) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=900' };
  const empty = () => new Response('[]', { headers: { ...headers, 'Cache-Control': 'public, max-age=60' } });

  const cache = caches.default;
  const key = new Request(url.origin + '/api/substack');
  const hit = await cache.match(key);
  if (hit) return hit;

  let base = '';
  try {
    const r = await env.ASSETS.fetch(new Request(new URL('/data/redes.json', url)));
    base = httpsUrl(String((await r.json()).substack || '').trim());
  } catch {
    return empty();
  }
  if (!base) return empty();

  if (url.searchParams.get('dbg') === '2') {
    const out = {};
    const b = base.replace(/\/+$/, '');
    for (const [k, path, ua] of [['feed_ua', '/feed', 'Mozilla/5.0 (compatible; InversoSite/1.0; +https://inverso-site.inverso-mkt.workers.dev)'], ['api_ua', '/api/v1/archive?sort=new&limit=12', 'Mozilla/5.0 (compatible; InversoSite/1.0; +https://inverso-site.inverso-mkt.workers.dev)'], ['api_plain', '/api/v1/archive?sort=new&limit=12', '']]) {
      try { const r = await fetch(b + path, { headers: ua ? { 'User-Agent': ua, Accept: '*/*' } : { Accept: '*/*' } }); out[k] = r.status + ':' + (await r.text()).length; } catch (e) { out[k] = 'err'; }
    }
    return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
  }
  let xml;
  try {
    const r = await fetch(base.replace(/\/+$/, '') + '/feed', { headers: { Accept: 'application/rss+xml, application/xml, text/xml' }, cf: { cacheTtl: 600 } });
    if (url.searchParams.get('dbg') === '1') return new Response(JSON.stringify({status: r.status, ct: r.headers.get('content-type'), len: (await r.text()).length}), { headers: { 'Content-Type': 'application/json' } });
    if (!r.ok) return empty();
    xml = await r.text();
  } catch (e) {
    console.error('substack: falha ao ler o feed', String(e));
    if (url.searchParams.get('dbg') === '1') return new Response(JSON.stringify({erro: String(e)}), { headers: { 'Content-Type': 'application/json' } });
    return empty();
  }

  const res = new Response(JSON.stringify(parseFeed(xml)), { headers });
  ctx?.waitUntil(cache.put(key, res.clone()));
  return res;
}
