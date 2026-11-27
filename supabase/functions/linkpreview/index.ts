// Link preview for shared posts and videos: the page's title, picture and site name (Open Graph tags).
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });
}

/** Only public web addresses (no local or private network hosts). */
function allowed(u: URL): boolean {
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || !h.includes('.')) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(':')) return false; // raw IPs
  return true;
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .trim();
}

function meta(html: string, keys: string[]): string | null {
  for (const k of keys) {
    const a = new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*content=["']([^"']+)["']`, 'i').exec(html);
    if (a) return decode(a[1]);
    const b = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${k}["']`, 'i').exec(html);
    if (b) return decode(b[1]);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const { url } = (await req.json().catch(() => ({}))) as { url?: string };
    let u: URL;
    try {
      u = new URL(String(url ?? ''));
    } catch {
      return json({ error: 'bad url' }, 400);
    }
    if (!allowed(u)) return json({ error: 'bad url' }, 400);
    // YouTube and TikTok have official preview endpoints (their pages often hide the tags from bots).
    const host = u.hostname.replace(/^(www\.|m\.)/, '');
    const oembed =
      host === 'youtube.com' || host === 'youtu.be' || host === 'music.youtube.com'
        ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u.toString())}`
        : host === 'tiktok.com' || host.endsWith('.tiktok.com')
          ? `https://www.tiktok.com/oembed?url=${encodeURIComponent(u.toString())}`
          : null;
    if (oembed) {
      const r = await fetch(oembed, { headers: { accept: 'application/json' } }).catch(() => null);
      const o = r?.ok ? ((await r.json().catch(() => null)) as { title?: string; thumbnail_url?: string; author_name?: string } | null) : null;
      if (o?.title || o?.thumbnail_url)
        return json({ title: (o.title ?? '').slice(0, 200) || null, image: o.thumbnail_url ?? null, site: host.includes('tiktok') ? 'TikTok' : 'YouTube', url: u.toString() });
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    const res = await fetch(u, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        // Sites give link previews to chat apps' preview bots.
        'user-agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'en',
      },
    }).finally(() => clearTimeout(timer));
    const final = new URL(res.url || u.toString());
    let html = '';
    if (res.ok && (res.headers.get('content-type') ?? '').includes('html')) {
      const reader = res.body?.getReader();
      const dec = new TextDecoder();
      while (reader && html.length < 600_000) {
        const { value, done } = await reader.read();
        if (done) break;
        html += dec.decode(value, { stream: true });
        if (html.includes('</head>')) break;
      }
      await reader?.cancel().catch(() => undefined);
    }
    const title = meta(html, ['og:title', 'twitter:title']) ?? (/<title[^>]*>([^<]{1,300})<\/title>/i.exec(html)?.[1] ? decode(/<title[^>]*>([^<]{1,300})<\/title>/i.exec(html)![1]) : null);
    let image = meta(html, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']);
    if (image) {
      try {
        image = new URL(image, final).toString();
      } catch {
        image = null;
      }
    }
    const site = meta(html, ['og:site_name']) ?? final.hostname.replace(/^www\./, '');
    return json({ title: title?.slice(0, 200) ?? null, image, site: site.slice(0, 60), url: u.toString() });
  } catch (e) {
    return json({ title: null, image: null, site: null, error: e instanceof Error ? e.message : 'failed' });
  }
});
