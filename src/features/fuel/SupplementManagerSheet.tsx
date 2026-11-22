import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { t } from '@/lib/i18n';
import { useState } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { Toggle } from '@/components/ui/Toggle';
import { useAddSupplement, useDeleteSupplement, useSupplements, useUpdateSupplement } from '@/hooks/useSupplements';
import type { Supplement } from '@/types/db';

function Row({ s }: { s: Supplement }) {
  const update = useUpdateSupplement();
  const del = useDeleteSupplement();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(s.name);
  const [dosage, setDosage] = useState(s.dosage);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (editing)
    return (
      <li className="space-y-2 rounded-2xl bg-surface-2 p-3">
        <Field label={t('Name')} value={name} onChange={(e) => setName(e.target.value)} />
        <Field label={t('Dosage / notes')} value={dosage} onChange={(e) => setDosage(e.target.value)} />
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" className="flex-1" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            accent="var(--color-supp)"
            className="flex-1"
            disabled={!name.trim()}
            onClick={() => {
              update.mutate({ id: s.id, name: name.trim(), dosage: dosage.trim() });
              setEditing(false);
            }}
          >
            <Check size={16} /> {t('Save')}
          </Button>
        </div>
      </li>
    );

  return (
    <li className="flex items-center gap-2 rounded-2xl bg-surface-2 py-2 ps-4 pe-2">
      <div className="min-w-0 flex-1">
        <div className={`truncate font-medium ${s.active ? '' : 'text-ink-2'}`}>{s.name}</div>
        <div className="truncate text-xs text-ink-3">{s.dosage || 'No dosage set'}</div>
      </div>
      {confirmDelete ? (
        <>
          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
            Keep
          </Button>
          <Button size="sm" variant="danger" onClick={() => del.mutate(s.id)}>
            Delete
          </Button>
        </>
      ) : (
        <>
          <IconButton label={t('Edit {name}', { name: s.name })} onClick={() => setEditing(true)}>
            <Pencil size={16} />
          </IconButton>
          <IconButton label={t('Delete {name}', { name: s.name })} onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} />
          </IconButton>
          <Toggle
            checked={s.active}
            onChange={(active) => update.mutate({ id: s.id, active })}
            accent="var(--color-supp)"
            label={t('{name} active', { name: s.name })}
          />
        </>
      )}
    </li>
  );
}

export function SupplementManagerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: list = [] } = useSupplements();
  const add = useAddSupplement();
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');

  return (
    <Sheet open={open} onClose={onClose} title={t('Supplement shelf')}>
      <p className="mb-3 text-sm text-ink-3">
        {t('Switch on what you currently have. Only active supplements appear in your daily checklist.')}
      </p>
      <ul className="space-y-2">
        {list.map((s) => (
          <Row key={s.id} s={s} />
        ))}
      </ul>
      <form
        className="mt-5 space-y-2 rounded-2xl border border-dashed border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          add.mutate(
            { name: name.trim(), dosage: dosage.trim() },
            {
              onSuccess: () => {
                setName('');
                setDosage('');
              },
            },
          );
        }}
      >
        <div className="text-sm font-semibold">{t('Add custom supplement')}</div>
        <Field label={t('Name')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('e.g. Ashwagandha')} />
        <Field label={t('Dosage / notes')} value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder={t('e.g. 600 mg with dinner')} />
        <Button type="submit" variant="primary" accent="var(--color-supp)" block disabled={!name.trim() || add.isPending}>
          <Plus size={18} /> {t('Add to shelf')}
        </Button>
      </form>
    </Sheet>
  );
}
