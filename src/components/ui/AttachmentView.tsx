import { File as FileIcon, Loader2, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { fileUrl } from '@/lib/files';
import { t } from '@/lib/i18n';
import type { Attachment } from '@/types/db';
import { IconButton } from './Button';

function useSignedUrl(path: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    fileUrl(path)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [path]);
  return { url, failed };
}

/** Square thumbnail for an attachment; images preview, other files show an icon. */
export function AttachmentThumb({ a, onOpen }: { a: Attachment; onOpen: () => void }) {
  const isImage = a.mime.startsWith('image/');
  const { url, failed } = useSignedUrl(a.path);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={a.name}
      className="relative grid aspect-square place-items-center overflow-hidden rounded-2xl border border-line bg-surface-2"
    >
      {isImage && url ? (
        <img src={url} alt="" className={`size-full object-cover ${a.kind === 'drawing' ? 'bg-white object-contain' : ''}`} loading="lazy" />
      ) : isImage && !failed ? (
        <Loader2 size={18} className="animate-spin text-ink-3" />
      ) : (
        <span className="flex flex-col items-center gap-1 px-2 text-center">
          <FileIcon size={22} className="text-ink-3" />
          <span className="line-clamp-2 text-[10px] text-ink-3">{failed ? t('Offline') : a.name}</span>
        </span>
      )}
    </button>
  );
}

/** Full-screen viewer with open/download and delete. */
export function AttachmentViewer({ a, onClose, onDelete }: { a: Attachment | null; onClose: () => void; onDelete: (a: Attachment) => void }) {
  if (!a) return null;
  return createPortal(<Viewer a={a} onClose={onClose} onDelete={onDelete} />, document.body);
}

function Viewer({ a, onClose, onDelete }: { a: Attachment; onClose: () => void; onDelete: (a: Attachment) => void }) {
  const { url, failed } = useSignedUrl(a.path);
  const isImage = a.mime.startsWith('image/');
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label={a.name}>
      <div className="pt-safe flex items-center gap-2 px-3 py-2">
        <IconButton label={t('Close')} onClick={onClose} className="text-white">
          <X size={22} />
        </IconButton>
        <div className="min-w-0 flex-1 truncate text-sm text-white/80">{a.name}</div>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="rounded-xl px-3 py-2 text-sm font-semibold text-water">
            {t('Open')}
          </a>
        )}
        {confirm ? (
          <button type="button" onClick={() => onDelete(a)} className="rounded-xl bg-danger px-3 py-2 text-sm font-semibold text-bg">
            {t('Delete')}
          </button>
        ) : (
          <IconButton label={t('Delete')} onClick={() => setConfirm(true)} className="text-white">
            <Trash2 size={20} />
          </IconButton>
        )}
      </div>
      <div className="grid min-h-0 flex-1 place-items-center p-3 pb-[calc(env(safe-area-inset-bottom)+12px)]" onClick={onClose}>
        {isImage && url ? (
          <img
            src={url}
            alt={a.name}
            className={`max-h-full max-w-full rounded-xl object-contain ${a.kind === 'drawing' ? 'bg-white' : ''}`}
            onClick={(e) => e.stopPropagation()}
          />
        ) : failed ? (
          <p className="text-sm text-white/70">{t("Couldn't load this file. Check your connection.")}</p>
        ) : isImage ? (
          <Loader2 className="animate-spin text-white/60" />
        ) : (
          <a href={url ?? undefined} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-2 text-white" onClick={(e) => e.stopPropagation()}>
            <FileIcon size={40} />
            <span className="text-sm underline">{t('Open {name}', { name: a.name })}</span>
          </a>
        )}
      </div>
    </div>
  );
}
