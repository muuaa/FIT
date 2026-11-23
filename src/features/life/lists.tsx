import { useQuery, useQueryClient } from '@tanstack/react-query';
import { sendActivity } from '@/lib/activity';
import { Check, Copy, LogOut, Plus, RefreshCw, Share2, Trash2, Users } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { Empty, Spinner } from '@/components/ui/States';
import { useSession } from '@/features/auth/session';
import { tick } from '@/lib/alerts';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';
import {
  addItem,
  clearDone,
  createList,
  deleteItem,
  deleteList,
  fetchLists,
  joinList,
  leaveList,
  setItemDone,
  type SharedItem,
  type SharedList,
  type SharedMember,
} from '@/lib/sharedLists';
import { cloudEnabled } from '@/lib/supabase';
import { toast } from '@/stores/toastStore';

const ACCENT = 'var(--color-lists)';
const KEY = ['sharedLists'];

function useLists() {
  return useQuery({
    queryKey: KEY,
    queryFn: fetchLists,
    enabled: cloudEnabled,
    staleTime: 0,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

function ListCard({ list, items, members }: { list: SharedList; items: SharedItem[]; members: SharedMember[] }) {
  const qc = useQueryClient();
  const me = useSession((s) => s.user);
  const [text, setText] = useState('');
  const [share, setShare] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const mine = list.owner === me?.id;
  const open = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  const mutate = async (fn: () => Promise<unknown>, optimistic?: (d: Awaited<ReturnType<typeof fetchLists>>) => Awaited<ReturnType<typeof fetchLists>>) => {
    if (optimistic) qc.setQueryData(KEY, (d: Awaited<ReturnType<typeof fetchLists>> | undefined) => (d ? optimistic(d) : d));
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Could not save'));
    } finally {
      void qc.invalidateQueries({ queryKey: KEY });
    }
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    setText('');
    const temp: SharedItem = { id: `tmp-${Date.now()}`, list_id: list.id, text: v, done: false, created_by: me?.id ?? '', created_at: new Date().toISOString() };
    void mutate(() => addItem(list.id, v.slice(0, 200)), (d) => ({ ...d, items: [...d.items, temp] }));
    sendActivity('list', { item: v.slice(0, 60), list: list.name });
  };

  const toggle = (i: SharedItem) => {
    tick();
    void mutate(() => setItemDone(i.id, !i.done), (d) => ({ ...d, items: d.items.map((x) => (x.id === i.id ? { ...x, done: !x.done } : x)) }));
  };

  return (
    <Card
      title={list.name}
      icon={Users}
      accent={ACCENT}
      action={
        <IconButton label={t('Share list')} onClick={() => setShare(true)}>
          <Share2 size={18} />
        </IconButton>
      }
    >
      <form onSubmit={add} className="mb-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('Add an item')}
          aria-label={t('Add an item to {name}', { name: list.name })}
          enterKeyHint="done"
          className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-ink outline-none placeholder:text-ink-3 focus:border-ink-3"
        />
        <button type="submit" aria-label={t('Add')} disabled={!text.trim()} className="grid size-11 place-items-center rounded-xl bg-lists text-bg disabled:opacity-40">
          <Plus size={20} />
        </button>
      </form>
      {items.length === 0 ? (
        <p className="py-2 text-center text-sm text-ink-3">{t('Empty list. Add the first item above.')}</p>
      ) : (
        <ul className="space-y-1">
          {[...open, ...done].map((i) => (
            <li key={i.id} className="flex items-center gap-1 rounded-xl bg-surface-2 pe-1">
              <button type="button" role="checkbox" aria-checked={i.done} disabled={i.id.startsWith('tmp-')} onClick={() => toggle(i)} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-start">
                <span className={cn('grid size-5 shrink-0 place-items-center rounded-md border-2', i.done ? 'border-lists bg-lists text-bg' : 'border-ink-3')}>
                  {i.done && <Check size={12} strokeWidth={3} />}
                </span>
                <span className={cn('min-w-0 flex-1 truncate text-sm', i.done && 'text-ink-3 line-through')}>{i.text}</span>
              </button>
              <IconButton
                label={t('Delete')}
                className="size-9"
                disabled={i.id.startsWith('tmp-')}
                onClick={() => void mutate(() => deleteItem(i.id), (d) => ({ ...d, items: d.items.filter((x) => x.id !== i.id) }))}
              >
                <Trash2 size={14} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex items-center justify-between text-xs text-ink-3">
        <span className="truncate">
          {members.length > 1 ? t('Shared with {names}', { names: members.filter((m) => m.user_id !== me?.id).map((m) => m.email || '?').join(', ') }) : t('Only you so far')}
        </span>
        {done.length > 0 && (
          <button type="button" className="shrink-0 font-semibold text-lists" onClick={() => void mutate(() => clearDone(list.id), (d) => ({ ...d, items: d.items.filter((x) => !(x.list_id === list.id && x.done)) }))}>
            {t('Clear ticked ({n})', { n: done.length })}
          </button>
        )}
      </div>

      <Sheet open={share} onClose={() => { setShare(false); setConfirm(false); }} title={list.name}>
        <p className="mb-3 text-sm text-ink-2">{t('Share this code. Whoever enters it in Lists → Join can see and edit this list (nothing else).')}</p>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(list.join_code).then(
              () => toast.success(t('Code copied')),
              () => undefined,
            );
          }}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-lists/40 bg-lists/10 py-4"
        >
          <span className="tabular font-mono text-3xl font-bold tracking-[0.3em] text-lists" dir="ltr">
            {list.join_code}
          </span>
          <Copy size={18} className="text-lists" />
        </button>
        {typeof navigator.share === 'function' && (
          <Button
            block
            variant="secondary"
            className="mt-2"
            onClick={() => void navigator.share({ text: t('Join my “{name}” list in Better Together with code {code}', { name: list.name, code: list.join_code }) }).catch(() => undefined)}
          >
            <Share2 size={16} /> {t('Send code')}
          </Button>
        )}
        <div className="mt-5 border-t border-line/60 pt-3">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-3">{t('Members')}</div>
          <ul className="mb-4 space-y-1 text-sm">
            {members.map((m) => (
              <li key={m.user_id} className="truncate">
                {m.email || '?'} {m.user_id === list.owner && <span className="text-xs text-ink-3">· {t('owner')}</span>}
              </li>
            ))}
          </ul>
          {confirm ? (
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setConfirm(false)}>
                {t('Cancel')}
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => {
                  setShare(false);
                  void mutate(() => (mine ? deleteList(list.id) : leaveList(list.id, me!.id)), (d) => ({ ...d, lists: d.lists.filter((l) => l.id !== list.id) }));
                }}
              >
                {mine ? t('Delete for everyone') : t('Leave list')}
              </Button>
            </div>
          ) : (
            <Button variant="danger" block onClick={() => setConfirm(true)}>
              {mine ? <Trash2 size={16} /> : <LogOut size={16} />} {mine ? t('Delete list') : t('Leave list')}
            </Button>
          )}
        </div>
      </Sheet>
    </Card>
  );
}

export function ListsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch, isFetching } = useLists();
  const [sheet, setSheet] = useState<'new' | 'join' | null>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setValue(''), [sheet]);

  if (!cloudEnabled)
    return (
      <>
        <PageHeader title={t('Shared lists')} back="/us" />
        <Empty icon={Users} title={t('Sign in to share lists')} />
      </>
    );

  const submit = async () => {
    const v = value.trim();
    if (!v) return;
    setBusy(true);
    try {
      if (sheet === 'new') await createList(v.slice(0, 80));
      else await joinList(v);
      toast.success(sheet === 'new' ? t('List created') : t('Joined the list'));
      setSheet(null);
      await qc.invalidateQueries({ queryKey: KEY });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Something went wrong'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title={t('Shared lists')}
        back="/us"
        right={
          <IconButton label={t('Refresh')} onClick={() => void refetch()}>
            <RefreshCw size={18} className={isFetching ? 'animate-spin' : ''} />
          </IconButton>
        }
      />
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Button variant="primary" accent={ACCENT} onClick={() => setSheet('new')}>
          <Plus size={16} /> {t('New list')}
        </Button>
        <Button variant="secondary" onClick={() => setSheet('join')}>
          <Users size={16} /> {t('Join with code')}
        </Button>
      </div>
      {isLoading ? (
        <Spinner />
      ) : error ? (
        <Empty icon={Users} title={error instanceof Error ? error.message : t('Could not load lists')}>
          {!navigator.onLine && t('Shared lists need an internet connection.')}
        </Empty>
      ) : !data?.lists.length ? (
        <Empty icon={Users} title={t('No shared lists yet')}>
          {t('Make a grocery or chores list and share its code with your partner. Everything else in your account stays private.')}
        </Empty>
      ) : (
        <div className="space-y-3">
          {data.lists.map((l) => (
            <ListCard key={l.id} list={l} items={data.items.filter((i) => i.list_id === l.id)} members={data.members.filter((m) => m.list_id === l.id)} />
          ))}
        </div>
      )}
      <Sheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        title={sheet === 'new' ? t('New shared list') : t('Join a list')}
        footer={
          <Button variant="primary" accent={ACCENT} size="lg" block disabled={!value.trim() || busy} onClick={() => void submit()}>
            {sheet === 'new' ? t('Create') : t('Join')}
          </Button>
        }
      >
        <Field
          label={sheet === 'new' ? t('List name') : t('Code')}
          value={value}
          onChange={(e) => setValue(sheet === 'join' ? e.target.value.toUpperCase() : e.target.value)}
          placeholder={sheet === 'new' ? t('e.g. Groceries') : 'A1B2C3D4'}
          autoCapitalize={sheet === 'join' ? 'characters' : 'sentences'}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
        />
      </Sheet>
    </>
  );
}

export function useListsSummary(): string {
  const { data } = useLists();
  if (!cloudEnabled) return '—';
  const open = data?.items.filter((i) => !i.done).length ?? 0;
  return data ? String(open) : '…';
}
