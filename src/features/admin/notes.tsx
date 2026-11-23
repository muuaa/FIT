import { Pin, PinOff, Plus, StickyNote, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { IconButton } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { Empty } from '@/components/ui/States';
import { useTable, useTableActions } from '@/hooks/useTable';
import { relativeDay } from '@/lib/date';
import { t } from '@/lib/i18n';
import { uid } from '@/lib/localDb';
import type { Note } from '@/types/db';

function NoteEditor({ note, onClose }: { note: Note | null; onClose: () => void }) {
  const actions = useTableActions('notes');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const timer = useRef<number | null>(null);
  const id = useRef<string | null>(null);
  useEffect(() => {
    if (!note) return;
    id.current = note.id;
    setTitle(note.title);
    setBody(note.body);
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = (tt: string, bb: string) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (!id.current) return;
      if (!tt.trim() && !bb.trim()) return;
      actions.put({ id: id.current, title: tt, body: bb, pinned: note?.pinned ?? false, updated_at: new Date().toISOString() });
    }, 500);
  };
  return (
    <Sheet open={note !== null} onClose={onClose} title={t('Note')}>
      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          save(e.target.value, body);
        }}
        placeholder={t('Title')}
        aria-label={t('Title')}
        className="mb-2 w-full bg-transparent text-xl font-bold text-ink outline-none placeholder:text-ink-3"
      />
      <textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          save(title, e.target.value);
        }}
        placeholder={t('Write anything: ideas, gift ideas, recipes, plans…')}
        aria-label={t('Note')}
        rows={14}
        className="w-full resize-none bg-transparent leading-relaxed text-ink outline-none placeholder:text-ink-3"
      />
      <p className="text-end text-[11px] text-ink-3">{t('Saves automatically')}</p>
    </Sheet>
  );
}

export function NotesPage() {
  const { data: notes = [] } = useTable('notes');
  const actions = useTableActions('notes');
  const [open, setOpen] = useState<Note | null>(null);
  const sorted = [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at));
  const create = () => setOpen({ id: uid(), title: '', body: '', pinned: false, updated_at: new Date().toISOString() });
  return (
    <>
      <PageHeader
        title={t('Notes')}
        back="/life"
        right={
          <IconButton label={t('New note')} onClick={create}>
            <Plus size={22} />
          </IconButton>
        }
      />
      {sorted.length === 0 ? (
        <button type="button" onClick={create} className="block w-full">
          <Empty icon={StickyNote} title={t('No notes yet')}>
            {t('Tap to write your first note.')}
          </Empty>
        </button>
      ) : (
        <ul className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
          {sorted.map((n) => (
            <li key={n.id} className="glass animate-page relative rounded-[22px]">
              <button type="button" onClick={() => setOpen(n)} className="press block h-full min-h-28 w-full p-3.5 pe-9 text-start">
                <div className="line-clamp-2 text-[15px] font-semibold">{n.title || t('Untitled')}</div>
                <div className="mt-1 line-clamp-4 whitespace-pre-line text-xs text-ink-3">{n.body}</div>
                <div className="mt-2 text-[10px] text-ink-3">{relativeDay(n.updated_at.slice(0, 10))}</div>
              </button>
              <div className="absolute end-1 top-1 flex flex-col">
                <IconButton label={n.pinned ? t('Unpin') : t('Pin')} className="size-8" onClick={() => actions.patch(n.id, { pinned: !n.pinned })}>
                  {n.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                </IconButton>
                <IconButton label={t('Delete')} className="size-8" onClick={() => actions.remove(n.id, t('Deleted “{title}”', { title: n.title || t('Untitled') }))}>
                  <Trash2 size={14} />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}
      <NoteEditor note={open} onClose={() => setOpen(null)} />
    </>
  );
}

export function useNotesSummary(): string {
  const { data: notes = [] } = useTable('notes');
  return notes.length ? String(notes.length) : t('Write');
}
