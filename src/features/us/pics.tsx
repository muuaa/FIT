/**
 * Shared: photos, videos and posts (Instagram, TikTok, YouTube… any link) you send each other.
 * Things can also arrive from other apps through the phone's Share menu (Android app).
 */
import { useQuery } from '@tanstack/react-query';
import { Camera, ClipboardPaste, ExternalLink, Heart, ImagePlus, Link2, Loader2, Play, Send, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/AppShell';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { useSession } from '@/features/auth/session';
import { useTable, useTableActions } from '@/hooks/useTable';
import { sendActivity } from '@/lib/activity';
import { cn } from '@/lib/cn';
import { deleteFile, fileUrl, uploadFile } from '@/lib/files';
import { t } from '@/lib/i18n';
import { uid } from '@/lib/localDb';
import { usePartnerStore } from '@/lib/partner';
import { supabase } from '@/lib/supabase';
import { toast } from '@/stores/toastStore';
import type { Pic } from '@/types/db';

const ACCENT = 'var(--color-us)';
const kindOf = (p: Pic) => p.kind ?? 'photo';

type Preview = { title: string | null; image: string | null; site: string | null };

/** Open a shared link in its own app (Instagram, TikTok, YouTube…) when there is one. */
function openLink(url: string) {
  const native = (window as { BTNative?: { openLink?: (u: string) => void; openExternal?: (u: string) => void } }).BTNative;
  if (native?.openLink) native.openLink(url);
  else if (native?.openExternal) native.openExternal(url);
  else window.open(url, '_blank', 'noopener');
}

const URL_RE = /https?:\/\/[^\s<>"']+/i;
const firstUrl = (s: string) => URL_RE.exec(s)?.[0]?.replace(/[).,!?]+$/, '') ?? null;

async function fetchPreview(url: string): Promise<Preview> {
  if (!supabase) return { title: null, image: null, site: null };
  const { data } = await supabase.functions.invoke('linkpreview', { body: { url } });
  const p = (data ?? {}) as Partial<Preview>;
  let site = p.site ?? null;
  try {
    site = site ?? new URL(url).hostname.replace(/^www\./, '');
  } catch {
    /* fine */
  }
  return { title: p.title ?? null, image: p.image ?? null, site };
}

function siteLabel(p: { site?: string | null; url?: string }): string {
  const s = p.site || (p.url ? (() => { try { return new URL(p.url!).hostname.replace(/^www\./, ''); } catch { return ''; } })() : '');
  if (/instagram/i.test(s)) return 'Instagram';
  if (/tiktok/i.test(s)) return 'TikTok';
  if (/youtu/i.test(s)) return 'YouTube';
  if (/^(x|twitter)\.com$/i.test(s)) return 'X';
  if (/facebook|fb\.watch/i.test(s)) return 'Facebook';
  if (/snapchat/i.test(s)) return 'Snapchat';
  return s;
}

function useUrl(path: string) {
  return useQuery({ queryKey: ['file-url', path], queryFn: () => fileUrl(path), staleTime: 50 * 60_000, retry: 1, enabled: Boolean(path) }).data;
}

function when(iso: string): string {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return t('just now');
  if (mins < 60) return t('{n} min ago', { n: mins });
  if (mins < 60 * 24) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** A link shown as a card: its picture, site and title. Tap to open it. */
function LinkCard({ p, compact }: { p: Pick<Pic, 'url' | 'title' | 'image' | 'site'>; compact?: boolean }) {
  const [broken, setBroken] = useState(false);
  const label = siteLabel(p);
  return (
    <button type="button" onClick={() => p.url && openLink(p.url)} className="press block w-full overflow-hidden rounded-2xl bg-white/[0.05] text-start">
      {p.image && !broken ? (
        <span className="relative block">
          <img src={p.image} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className={cn('w-full object-cover', compact ? 'aspect-[16/9]' : 'max-h-[60dvh] min-h-40')} />
          {/youtube|tiktok|instagram/i.test(label) && (
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-12 place-items-center rounded-full bg-black/55 text-white backdrop-blur">
                <Play size={22} className="ms-0.5 fill-white" />
              </span>
            </span>
          )}
        </span>
      ) : (
        <span className="grid h-24 place-items-center bg-gradient-to-br from-us/25 to-accent/15 text-3xl">🔗</span>
      )}
      <span className="block px-3 py-2.5">
        <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
          {label} <ExternalLink size={11} />
        </span>
        <span className="mt-0.5 line-clamp-2 block text-sm font-medium">{p.title || t('Open the post')}</span>
      </span>
    </button>
  );
}

function Media({ p, onOpen }: { p: Pic; onOpen?: () => void }) {
  const url = useUrl(p.path);
  if (kindOf(p) === 'video')
    return url ? (
      <video src={url} controls playsInline preload="metadata" className="max-h-[70dvh] w-full rounded-2xl bg-black" />
    ) : (
      <span className="grid aspect-video place-items-center rounded-2xl bg-white/[0.04]">
        <Loader2 size={18} className="animate-spin text-ink-3" />
      </span>
    );
  return url ? (
    <button type="button" onClick={onOpen} className="press block w-full overflow-hidden rounded-2xl">
      <img src={url} alt="" loading="lazy" className="max-h-[70dvh] w-full object-cover" />
    </button>
  ) : (
    <span className="grid aspect-[4/3] place-items-center rounded-2xl bg-white/[0.04]">
      <Loader2 size={18} className="animate-spin text-ink-3" />
    </span>
  );
}

// ---------------------------------------------------------------- sending

type Draft = { kind: 'photo' | 'video'; file: Blob; name: string; preview: string } | { kind: 'link'; url: string };

function useSender() {
  const actions = useTableActions('pics');
  const me = useSession((s) => s.user);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [caption, setCaption] = useState('');
  const [link, setLink] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [looking, setLooking] = useState(false);
  const [busy, setBusy] = useState(false);

  const pickFile = (f: Blob | undefined, name = 'file') => {
    if (!f) return;
    const kind = f.type.startsWith('video/') ? 'video' : f.type.startsWith('image/') ? 'photo' : null;
    if (!kind) return toast.error(t('Pick a photo or a video.'));
    if (f.size > 50 * 1024 * 1024) return toast.error(t('That file is over 50 MB. Try a shorter video.'));
    setCaption('');
    setDraft({ kind, file: f, name, preview: URL.createObjectURL(f) });
  };
  const startLink = (text = '') => {
    setCaption('');
    setPreview(null);
    const u = firstUrl(text);
    setLink(u ?? '');
    // Text that came with the link (e.g. from a share) becomes the caption.
    if (u) setCaption(text.replace(u, '').trim().slice(0, 140));
    setDraft({ kind: 'link', url: u ?? '' });
  };
  // Look the link up as it's typed or pasted.
  const linkUrl = draft?.kind === 'link' ? firstUrl(link) : null;
  useEffect(() => {
    if (!linkUrl) {
      setPreview(null);
      return;
    }
    let live = true;
    setLooking(true);
    const id = window.setTimeout(() => {
      void fetchPreview(linkUrl)
        .then((p) => live && setPreview(p))
        .catch(() => live && setPreview({ title: null, image: null, site: null }))
        .finally(() => live && setLooking(false));
    }, 350);
    return () => {
      live = false;
      window.clearTimeout(id);
    };
  }, [linkUrl]);

  const close = () => {
    if (draft && draft.kind !== 'link') URL.revokeObjectURL(draft.preview);
    setDraft(null);
  };
  const send = async () => {
    if (!draft || !me) return;
    setBusy(true);
    try {
      const base = { id: uid(), caption: caption.trim().slice(0, 140), by: me.id, created_at: new Date().toISOString(), hearts: [] as string[] };
      if (draft.kind === 'link') {
        if (!linkUrl) return;
        const p = preview ?? (await fetchPreview(linkUrl).catch(() => ({ title: null, image: null, site: null })));
        actions.insert({ ...base, kind: 'link', path: '', url: linkUrl, title: p.title, image: p.image, site: p.site });
        sendActivity('pic', { what: t('a post'), note: p.title ? `: ${p.title.slice(0, 60)}` : '' });
      } else {
        const up = await uploadFile(draft.file, draft.name);
        actions.insert({ ...base, kind: draft.kind, path: up.path, mime: up.mime });
        sendActivity('pic', { what: draft.kind === 'video' ? t('a video') : t('a photo'), note: caption.trim() ? `: ${caption.trim().slice(0, 60)}` : '' });
      }
      toast.success(t('Sent 💌'));
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Could not send'));
    } finally {
      setBusy(false);
    }
  };
  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setLink(text.trim());
    } catch {
      toast.info(t('Long-press the box and choose Paste.'));
    }
  };

  const ui = (
    <>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (pickFile(e.target.files?.[0], e.target.files?.[0]?.name), (e.target.value = ''))} />
      <input ref={gallery} type="file" accept="image/*,video/*" hidden onChange={(e) => (pickFile(e.target.files?.[0], e.target.files?.[0]?.name), (e.target.value = ''))} />
      <Sheet
        open={draft !== null}
        onClose={close}
        title={draft?.kind === 'link' ? t('Share a post or link') : draft?.kind === 'video' ? t('Send a video') : t('Send a photo')}
        footer={
          <Button variant="primary" accent={ACCENT} size="lg" block disabled={busy || (draft?.kind === 'link' && !linkUrl)} onClick={() => void send()}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <><Send size={16} /> {t('Send')}</>}
          </Button>
        }
      >
        <div className="space-y-3">
          {draft?.kind === 'photo' && <img src={draft.preview} alt="" className="max-h-[45dvh] w-full rounded-2xl object-contain" />}
          {draft?.kind === 'video' && <video src={draft.preview} controls playsInline className="max-h-[45dvh] w-full rounded-2xl bg-black" />}
          {draft?.kind === 'link' && (
            <>
              <div className="flex items-end gap-2">
                <Field className="min-w-0 flex-1" label={t('Link')} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.instagram.com/reel/…" inputMode="url" />
                <IconButton label={t('Paste')} className="mb-0.5 size-11 bg-white/[0.06]" onClick={() => void paste()}>
                  <ClipboardPaste size={18} />
                </IconButton>
              </div>
              {linkUrl &&
                (looking && !preview ? (
                  <div className="grid h-24 place-items-center rounded-2xl bg-white/[0.04]">
                    <Loader2 size={18} className="animate-spin text-ink-3" />
                  </div>
                ) : (
                  <LinkCard compact p={{ url: linkUrl, title: preview?.title ?? null, image: preview?.image ?? null, site: preview?.site ?? null }} />
                ))}
            </>
          )}
          <Field label={t('Say something')} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={t('Optional')} maxLength={140} />
        </div>
      </Sheet>
    </>
  );
  return { openCamera: () => camera.current?.click(), openGallery: () => gallery.current?.click(), startLink, pickFile, ui };
}

function SendButtons({ sender }: { sender: ReturnType<typeof useSender> }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Button variant="primary" accent={ACCENT} onClick={sender.openCamera}>
        <Camera size={16} /> {t('Camera')}
      </Button>
      <Button variant="secondary" onClick={sender.openGallery}>
        <ImagePlus size={16} /> {t('Gallery')}
      </Button>
      <Button variant="secondary" onClick={() => sender.startLink()}>
        <Link2 size={16} /> {t('Link')}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- the Us tab's card

function Thumb({ p }: { p: Pic }) {
  const url = useUrl(kindOf(p) === 'link' ? '' : p.path);
  const k = kindOf(p);
  if (k === 'link') return <LinkCard compact p={p} />;
  return (
    <Link to="/us/pics" className="press relative block overflow-hidden rounded-2xl bg-white/[0.04]">
      {k === 'video' ? (
        url ? <video src={`${url}#t=0.5`} muted playsInline preload="metadata" className="aspect-[4/3] w-full object-cover" /> : <span className="block aspect-[4/3]" />
      ) : url ? (
        <img src={url} alt="" className="aspect-[4/3] w-full object-cover" />
      ) : (
        <span className="block aspect-[4/3]" />
      )}
      {k === 'video' && (
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-12 place-items-center rounded-full bg-black/55 text-white">
            <Play size={22} className="ms-0.5 fill-white" />
          </span>
        </span>
      )}
    </Link>
  );
}

export function PicsCard() {
  const me = useSession((s) => s.user);
  const partner = usePartnerStore((s) => s.partner);
  const { data: rows = [] } = useTable('pics');
  const sender = useSender();
  const sorted = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const latest = sorted.find((p) => p.by !== me?.id) ?? sorted[0];
  return (
    <Card
      title={t('Shared')}
      icon={Send}
      accent={ACCENT}
      action={
        rows.length > 0 ? (
          <Link to="/us/pics" className="text-xs font-semibold text-us">
            {t('All {n}', { n: rows.length })}
          </Link>
        ) : undefined
      }
    >
      {latest ? (
        <div className="mb-3">
          <Thumb p={latest} />
          <p className="mt-1.5 truncate text-xs text-ink-3">
            {latest.by === me?.id ? t('You') : (partner?.name ?? '')} · {when(latest.created_at)}
            {latest.caption ? ` · ${latest.caption}` : ''}
          </p>
        </div>
      ) : (
        <p className="mb-3 text-sm text-ink-2">{t('Send {name} photos, videos and posts (Instagram, TikTok, YouTube…). In other apps, tap Share → Better Together.', { name: partner?.name ?? t('your partner') })}</p>
      )}
      <SendButtons sender={sender} />
      {sender.ui}
    </Card>
  );
}

// ---------------------------------------------------------------- the feed

export function PicsPage() {
  const me = useSession((s) => s.user);
  const partner = usePartnerStore((s) => s.partner);
  const { data: rows = [] } = useTable('pics');
  const actions = useTableActions('pics');
  const sender = useSender();
  const [params, setParams] = useSearchParams();
  const [viewer, setViewer] = useState<string | null>(null);
  const sorted = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));

  // Arrived through the phone's Share menu: a link/text, or a photo/video from another app.
  useEffect(() => {
    const text = params.get('share');
    const file = params.get('shared');
    if (!text && !file) return;
    setParams({}, { replace: true });
    if (text) sender.startLink(text);
    if (file) {
      void fetch('/FIT/__shared__/file')
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('missing'))))
        .then((b) => sender.pickFile(b, params.get('name') || 'shared'))
        .catch(() => toast.error(t('Couldn’t open what you shared. Try again from the app.')));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const heart = (p: Pic) => {
    if (!me) return;
    const has = p.hearts.includes(me.id);
    actions.put({ ...p, hearts: has ? p.hearts.filter((h) => h !== me.id) : [...p.hearts, me.id] });
  };
  const remove = (p: Pic) => {
    actions.remove(p.id, t('Deleted'));
    if (p.path) void deleteFile(p.path).catch(() => undefined);
  };
  const viewing = sorted.find((p) => p.id === viewer);
  return (
    <>
      <PageHeader title={t('Shared')} subtitle={t('Photos, videos and posts, for each other')} />
      <div className="mb-3">
        <SendButtons sender={sender} />
      </div>
      {sender.ui}
      {!sorted.length ? (
        <p className="rounded-2xl bg-white/[0.035] p-4 text-sm text-ink-2">{t('Nothing shared yet. Send the first one!')}</p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((p) => {
            const mine = p.by === me?.id;
            const hearted = Boolean(me && p.hearts.includes(me.id));
            return (
              <li key={p.id} className="glass rounded-[24px] p-2.5">
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span className={cn('size-2 rounded-full', mine ? 'bg-accent' : 'bg-us')} />
                  <span className="text-sm font-semibold">{mine ? t('You') : (partner?.name ?? '')}</span>
                  <span className="text-xs text-ink-3">· {when(p.created_at)}</span>
                </div>
                {kindOf(p) === 'link' ? <LinkCard p={p} /> : <Media p={p} onOpen={() => setViewer(p.id)} />}
                <div className="mt-2 flex items-center gap-2 px-1">
                  <p className="min-w-0 flex-1 break-words text-[15px]">{p.caption}</p>
                  <button type="button" onClick={() => heart(p)} aria-label={t('Heart')} className="press flex items-center gap-1 rounded-full px-2 py-1">
                    <Heart size={20} className={hearted ? 'fill-us text-us' : 'text-ink-3'} />
                    {p.hearts.length > 0 && <span className="tabular text-xs text-ink-3">{p.hearts.length}</span>}
                  </button>
                  {mine && (
                    <IconButton label={t('Delete')} className="size-9 text-ink-3" onClick={() => remove(p)}>
                      <Trash2 size={16} />
                    </IconButton>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {viewing && kindOf(viewing) === 'photo' && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/95 p-3" role="dialog" aria-label={t('Photo')} onClick={() => setViewer(null)}>
          <IconButton label={t('Close')} className="absolute end-3 top-[calc(env(safe-area-inset-top)+0.75rem)] bg-white/10" onClick={() => setViewer(null)}>
            <X size={20} />
          </IconButton>
          <FullImage path={viewing.path} />
        </div>
      )}
    </>
  );
}

function FullImage({ path }: { path: string }) {
  const url = useUrl(path);
  return url ? <img src={url} alt="" className="max-h-full max-w-full rounded-2xl object-contain" /> : <Loader2 className="animate-spin text-ink-3" />;
}
