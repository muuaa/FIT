/** Random pics: send each other a photo (camera or gallery) with a line, and see them all in one place. */
import { useQuery } from '@tanstack/react-query';
import { Camera, ChevronLeft, ChevronRight, Heart, ImagePlus, Images, Loader2, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { toast } from '@/stores/toastStore';
import type { Pic } from '@/types/db';

const ACCENT = 'var(--color-us)';

function useUrl(path: string) {
  return useQuery({ queryKey: ['file-url', path], queryFn: () => fileUrl(path), staleTime: 50 * 60_000, retry: 1 }).data;
}

function Img({ path, className, contain }: { path: string; className?: string; contain?: boolean }) {
  const url = useUrl(path);
  return url ? (
    <img src={url} alt="" loading="lazy" className={cn(contain ? 'object-contain' : 'object-cover', className)} />
  ) : (
    <span className={cn('grid place-items-center bg-white/[0.04] text-ink-3', className)}>
      <Loader2 size={18} className="animate-spin" />
    </span>
  );
}

function when(iso: string): string {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return t('just now');
  if (mins < 60) return t('{n} min ago', { n: mins });
  if (mins < 60 * 24) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** Pick a photo (camera or gallery), add a line, send. */
function useSender() {
  const actions = useTableActions('pics');
  const me = useSession((s) => s.user);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const pick = (f: File | undefined) => {
    if (!f || !f.type.startsWith('image/')) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setCaption('');
  };
  const close = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
  };
  const send = async () => {
    if (!file || !me) return;
    setBusy(true);
    try {
      const up = await uploadFile(file, file.name || 'photo.jpg');
      actions.insert({ id: uid(), path: up.path, caption: caption.trim().slice(0, 140), by: me.id, created_at: new Date().toISOString(), hearts: [] });
      sendActivity('pic', { note: caption.trim() ? `: ${caption.trim().slice(0, 60)}` : '' });
      toast.success(t('Sent 📸'));
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Could not send'));
    } finally {
      setBusy(false);
    }
  };
  const inputs = (
    <>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ''))} />
      <input ref={gallery} type="file" accept="image/*" hidden onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ''))} />
      <Sheet
        open={preview !== null}
        onClose={close}
        title={t('Send a pic')}
        footer={
          <Button variant="primary" accent={ACCENT} size="lg" block disabled={busy} onClick={() => void send()}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : t('Send')}
          </Button>
        }
      >
        <div className="space-y-3">
          {preview && <img src={preview} alt="" className="max-h-[50dvh] w-full rounded-2xl object-contain" />}
          <Field label={t('Say something')} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={t('Optional')} maxLength={140} />
        </div>
      </Sheet>
    </>
  );
  return { openCamera: () => camera.current?.click(), openGallery: () => gallery.current?.click(), inputs };
}

function SendButtons({ sender }: { sender: ReturnType<typeof useSender> }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="primary" accent={ACCENT} onClick={sender.openCamera}>
        <Camera size={16} /> {t('Camera')}
      </Button>
      <Button variant="secondary" onClick={sender.openGallery}>
        <ImagePlus size={16} /> {t('Gallery')}
      </Button>
    </div>
  );
}

/** Us tab: the latest pic, and buttons to send one. */
export function PicsCard() {
  const me = useSession((s) => s.user);
  const partner = usePartnerStore((s) => s.partner);
  const { data: rows = [] } = useTable('pics');
  const sender = useSender();
  const sorted = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  // Show the newest one they sent you; otherwise the newest of all.
  const latest = sorted.find((p) => p.by !== me?.id) ?? sorted[0];
  return (
    <Card
      title={t('Pics')}
      icon={Images}
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
        <Link to={`/us/pics?open=${latest.id}`} className="press relative mb-3 block overflow-hidden rounded-2xl">
          <Img path={latest.path} className="aspect-[4/3] w-full" />
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2.5 pt-8 text-start">
            <span className="block text-xs text-white/80">
              {latest.by === me?.id ? t('You') : (partner?.name ?? '')} · {when(latest.created_at)}
            </span>
            {latest.caption && <span className="block truncate text-sm font-medium text-white">{latest.caption}</span>}
          </span>
        </Link>
      ) : (
        <p className="mb-3 text-sm text-ink-2">{t('Send {name} a random pic: what you’re eating, where you are, anything.', { name: partner?.name ?? t('your partner') })}</p>
      )}
      <SendButtons sender={sender} />
      {sender.inputs}
    </Card>
  );
}

export function PicsPage() {
  const me = useSession((s) => s.user);
  const partner = usePartnerStore((s) => s.partner);
  const { data: rows = [] } = useTable('pics');
  const actions = useTableActions('pics');
  const sender = useSender();
  const sorted = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const [openId, setOpenId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('open'));
  const idx = sorted.findIndex((p) => p.id === openId);
  const cur = idx >= 0 ? sorted[idx] : null;
  const nameOf = (p: Pic) => (p.by === me?.id ? t('You') : (partner?.name ?? ''));
  const heart = (p: Pic) => {
    if (!me) return;
    const has = p.hearts.includes(me.id);
    actions.put({ ...p, hearts: has ? p.hearts.filter((h) => h !== me.id) : [...p.hearts, me.id] });
  };
  const remove = (p: Pic) => {
    actions.remove(p.id);
    void deleteFile(p.path).catch(() => undefined);
    setOpenId(null);
    toast.info(t('Deleted'));
  };
  return (
    <>
      <PageHeader title={t('Pics')} subtitle={t('Random moments, sent to each other')} />
      <div className="mb-3">
        <SendButtons sender={sender} />
      </div>
      {sender.inputs}
      {!sorted.length ? (
        <p className="rounded-2xl bg-white/[0.035] p-4 text-sm text-ink-2">{t('No pics yet. Send the first one!')}</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {sorted.map((p) => (
            <button key={p.id} type="button" onClick={() => setOpenId(p.id)} className="press relative overflow-hidden rounded-xl">
              <Img path={p.path} className="aspect-square w-full" />
              {p.hearts.length > 0 && <Heart size={14} className="absolute bottom-1.5 end-1.5 fill-us text-us drop-shadow" />}
              <span className={cn('absolute start-1.5 top-1.5 size-2 rounded-full', p.by === me?.id ? 'bg-accent' : 'bg-us')} />
            </button>
          ))}
        </div>
      )}
      {cur && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/95" role="dialog" aria-label={t('Photo')}>
          <div className="flex items-center justify-between px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
            <span className="text-sm text-white/80">
              {nameOf(cur)} · {when(cur.created_at)}
            </span>
            <IconButton label={t('Close')} className="bg-white/10" onClick={() => setOpenId(null)}>
              <X size={20} />
            </IconButton>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center p-3">
            <Img path={cur.path} contain className="max-h-full max-w-full rounded-2xl" />
            {idx > 0 && (
              <IconButton label={t('Newer')} className="absolute start-2 bg-white/10" onClick={() => setOpenId(sorted[idx - 1].id)}>
                <ChevronLeft size={20} className="rtl:-scale-x-100" />
              </IconButton>
            )}
            {idx < sorted.length - 1 && (
              <IconButton label={t('Older')} className="absolute end-2 bg-white/10" onClick={() => setOpenId(sorted[idx + 1].id)}>
                <ChevronRight size={20} className="rtl:-scale-x-100" />
              </IconButton>
            )}
          </div>
          <div className="flex items-center gap-3 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <p className="min-w-0 flex-1 break-words text-[15px] text-white">{cur.caption}</p>
            <IconButton label={t('Heart')} className="bg-white/10" onClick={() => heart(cur)}>
              <Heart size={20} className={me && cur.hearts.includes(me.id) ? 'fill-us text-us' : 'text-white'} />
            </IconButton>
            {cur.by === me?.id && (
              <IconButton label={t('Delete')} className="bg-white/10 text-danger" onClick={() => remove(cur)}>
                <Trash2 size={18} />
              </IconButton>
            )}
          </div>
        </div>
      )}
    </>
  );
}
