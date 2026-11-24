import { BookOpen, Camera, Loader2, Paperclip, PenLine, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { AttachmentThumb, AttachmentViewer } from '@/components/ui/AttachmentView';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DayPicker } from '@/components/ui/DayPicker';
import { useQuery } from '@tanstack/react-query';
import { useTable, useTableActions, useTableEveryone } from '@/hooks/useTable';
import { useToday } from '@/hooks/useToday';
import { relativeDay } from '@/lib/date';
import { filesAvailable } from '@/lib/files';
import { t } from '@/lib/i18n';
import { personId } from '@/lib/localDb';
import { useOtherPerson } from '@/lib/partner';
import { supabase } from '@/lib/supabase';
import type { Attachment, JournalEntry } from '@/types/db';
import { Handwriting } from './Handwriting';
import { useAttachments } from './useAttachments';

const ACCENT = 'var(--color-journal)';

/** Gratitude lines + free writing for a day. Saves as you type (debounced) and when leaving a field. */
function EntryEditor({ date }: { date: string }) {
  const { data: rows = [] } = useTable('journal');
  const actions = useTableActions('journal');
  const saved = rows.find((r) => r.date === date);
  const [g, setG] = useState<string[]>(['', '', '']);
  const [text, setText] = useState('');
  const timer = useRef<number | null>(null);
  const draft = useRef<{ g: string[]; text: string } | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  // Load the day's entry (and when it changes on another device, unless we're mid-edit).
  useEffect(() => {
    if (draft.current) return;
    setG([0, 1, 2].map((i) => saved?.gratitude[i] ?? ''));
    setText(saved?.text ?? '');
  }, [saved, date]);

  const flush = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    const d = draft.current;
    draft.current = null;
    if (!d) return;
    // Keep text exactly as typed (trimming here would eat a space you just typed before pausing).
    const gratitude = d.g;
    const body = d.text;
    if (!gratitude.some((x) => x.trim()) && !body.trim()) {
      if (saved) actions.remove(date);
      return;
    }
    const row: Omit<JournalEntry, 'by'> = { date, gratitude, text: body, updated_at: new Date().toISOString() };
    actions.put(row);
  };

  const change = (next: { g?: string[]; text?: string }) => {
    const ng = next.g ?? g;
    const nt = next.text ?? text;
    if (next.g) setG(ng);
    if (next.text !== undefined) setText(nt);
    draft.current = { g: ng, text: nt };
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 700);
  };

  // Save pending text when switching day or leaving the page.
  useEffect(() => () => flush(), [date]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const a = area.current;
    if (!a) return;
    a.style.height = 'auto';
    a.style.height = `${Math.max(160, a.scrollHeight)}px`;
  }, [text]);

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-ink-3">
          <Sparkles size={13} className="text-journal" /> {t('3 things I’m grateful for')}
        </div>
        <div className="space-y-1.5">
          {g.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="tabular w-4 text-center text-sm font-semibold text-journal">{i + 1}</span>
              <input
                value={v}
                onChange={(e) => change({ g: g.map((x, j) => (j === i ? e.target.value : x)) })}
                onBlur={flush}
                maxLength={200}
                aria-label={t('Gratitude {n}', { n: i + 1 })}
                className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-ink outline-none focus:border-ink-3"
              />
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-ink-3">{t('Notes')}</div>
        <textarea
          ref={area}
          value={text}
          onChange={(e) => change({ text: e.target.value })}
          onBlur={flush}
          placeholder={t('How was your day? What did you learn? What’s next?')}
          aria-label={t('Journal notes')}
          className="block min-h-40 w-full resize-none rounded-2xl border border-line bg-surface-2 p-3.5 leading-relaxed text-ink outline-none placeholder:text-ink-3 focus:border-ink-3"
        />
        <p className="mt-1 text-end text-[11px] text-ink-3">{t('Saves automatically')}</p>
      </div>
    </div>
  );
}

function Attachments({ date }: { date: string }) {
  const photoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const att = useAttachments((a) => a.date === date && a.kind !== 'progress');
  const [pad, setPad] = useState(false);
  const [open, setOpen] = useState<Attachment | null>(null);

  if (!filesAvailable())
    return <p className="text-sm text-ink-3">{t('Sign in to add photos, files and handwriting to your journal.')}</p>;

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        <Button variant="secondary" onClick={() => setPad(true)}>
          <PenLine size={16} /> {t('Write')}
        </Button>
        <Button variant="secondary" onClick={() => photoInput.current?.click()} disabled={att.uploading}>
          <Camera size={16} /> {t('Photo')}
        </Button>
        <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={att.uploading}>
          <Paperclip size={16} /> {t('File')}
        </Button>
      </div>
      {att.uploading && (
        <p className="mt-2 flex items-center gap-2 text-xs text-ink-3">
          <Loader2 size={14} className="animate-spin" /> {t('Uploading…')}
        </p>
      )}
      {att.list.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {att.list.map((a) => (
            <AttachmentThumb key={a.id} a={a} onOpen={() => setOpen(a)} />
          ))}
        </div>
      )}
      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void att.addFiles(e.target.files, 'photo', date);
          e.target.value = '';
        }}
      />
      <input
        ref={fileInput}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          void att.addFiles(e.target.files, 'file', date);
          e.target.value = '';
        }}
      />
      <Handwriting
        open={pad}
        onClose={() => setPad(false)}
        onSave={(png) => att.add(png, `${t('Handwriting')} ${date}.png`, 'drawing', date)}
      />
      <AttachmentViewer
        a={open}
        onClose={() => setOpen(null)}
        onDelete={(a) => {
          att.remove(a);
          setOpen(null);
        }}
      />
    </div>
  );
}

/** The other person's entry for the day (read-only), with their photos and handwriting. */
function OtherEntry({ date }: { date: string }) {
  const other = useOtherPerson();
  const { data: everyone = [] } = useTableEveryone('journal');
  const entry = other ? everyone.find((r) => r.by === other.id && r.date === date) : undefined;
  const [open, setOpen] = useState<Attachment | null>(null);
  // Their attachments live in their own space; the server lets the two of you read each other's.
  const { data: files = [] } = useQuery({
    queryKey: ['other-journal-files', other?.id, date],
    enabled: Boolean(other && supabase && navigator.onLine),
    queryFn: async () => {
      const { data } = await supabase!
        .from('records')
        .select('data')
        .eq('user_id', other!.id)
        .eq('tbl', 'attachments')
        .eq('deleted', false)
        .eq('data->>date', date);
      return (data ?? []).map((r) => r.data as Attachment).filter((a) => a.kind !== 'progress');
    },
  });
  if (!other || (!entry && !files.length)) return null;
  const gratitude = entry?.gratitude.filter((g) => g.trim()) ?? [];
  return (
    <Card title={t('{name}’s entry', { name: other.name })} icon={BookOpen} accent="var(--color-us)">
      {gratitude.length > 0 && (
        <ul className="mb-3 space-y-1">
          {gratitude.map((g, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <Sparkles size={13} className="mt-1 shrink-0 text-us" /> <span className="min-w-0 break-words">{g}</span>
            </li>
          ))}
        </ul>
      )}
      {entry?.text && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-2">{entry.text}</p>}
      {files.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {files.map((a) => (
            <AttachmentThumb key={a.id} a={a} onOpen={() => setOpen(a)} />
          ))}
        </div>
      )}
      <AttachmentViewer a={open} onClose={() => setOpen(null)} />
    </Card>
  );
}

export function JournalPage() {
  const today = useToday();
  const [date, setDate] = useState(today);
  const { data: rows = [] } = useTableEveryone('journal');
  const { data: atts = [] } = useTable('attachments');
  const other = useOtherPerson();
  const me = personId();
  // Both of your entries, newest first (yours first on the same day).
  const recent = rows
    .filter((r) => r.date !== date && (r.by === me || r.by === other?.id))
    .sort((a, b) => b.date.localeCompare(a.date) || (a.by === me ? -1 : 1))
    .slice(0, 20);
  return (
    <>
      <PageHeader title={t('Journal')} back="/life" />
      <DayPicker date={date} onChange={setDate} />
      <div className="space-y-3">
        <Card title={relativeDay(date)} icon={BookOpen} accent={ACCENT}>
          <EntryEditor key={date} date={date} />
        </Card>
        <Card title={t('Handwriting, photos & files')} icon={Paperclip} accent={ACCENT}>
          <Attachments date={date} />
        </Card>
        <OtherEntry date={date} />
        {recent.length > 0 && (
          <Card title={t('Earlier entries')} icon={BookOpen} accent={ACCENT}>
            <ul className="divide-y divide-line/60">
              {recent.map((r) => {
                const theirs = r.by !== me;
                const n = theirs ? 0 : atts.filter((a) => a.date === r.date && a.kind !== 'progress').length;
                return (
                  <li key={`${r.date}|${r.by}`}>
                    <button type="button" onClick={() => setDate(r.date)} className="w-full py-2.5 text-start">
                      <div className="flex justify-between text-xs text-ink-3">
                        <span>
                          {relativeDay(r.date)}
                          {theirs && other && <span className="text-us"> · {other.name}</span>}
                        </span>
                        {n > 0 && (
                          <span className="flex items-center gap-1">
                            <Paperclip size={11} /> {n}
                          </span>
                        )}
                      </div>
                      <div className="line-clamp-2 text-sm">{r.text || r.gratitude.filter(Boolean).join(' · ')}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}

/** Today card: a peek at today's entry, or a prompt. */
export function JournalToday() {
  const today = useToday();
  const { data: rows = [] } = useTable('journal');
  const e = rows.find((r) => r.date === today);
  const filled = e ? e.gratitude.filter(Boolean).length : 0;
  return (
    <div className="text-sm">
      {e ? (
        <p className="line-clamp-3 text-ink-2">{e.text || e.gratitude.filter(Boolean).join(' · ')}</p>
      ) : (
        <p className="text-ink-3">{t('Write a few lines and 3 things you’re grateful for.')}</p>
      )}
      {filled > 0 && <p className="mt-1 text-xs text-journal">{t('{n}/3 gratitude', { n: filled })}</p>}
    </div>
  );
}

export function useJournalSummary(): string {
  const today = useToday();
  const { data: rows = [] } = useTable('journal');
  return rows.some((r) => r.date === today) ? '✓' : t('Write');
}
