import { useState } from 'react';
import { useTable, useTableActions } from '@/hooks/useTable';
import { deleteFile, uploadFile } from '@/lib/files';
import { t } from '@/lib/i18n';
import { uid } from '@/lib/localDb';
import { toast } from '@/stores/toastStore';
import type { Attachment, AttachmentKind } from '@/types/db';

export function useAttachments(filter: (a: Attachment) => boolean) {
  const { data = [] } = useTable('attachments');
  const actions = useTableActions('attachments');
  const [busy, setBusy] = useState(0);
  const list = data.filter(filter).sort((a, b) => a.created_at.localeCompare(b.created_at));

  async function add(file: Blob, name: string, kind: AttachmentKind, date: string) {
    setBusy((n) => n + 1);
    try {
      const up = await uploadFile(file, name);
      actions.insert({ id: uid(), date, kind, path: up.path, name, mime: up.mime, size: up.size, created_at: new Date().toISOString() });
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Upload failed'));
      return false;
    } finally {
      setBusy((n) => n - 1);
    }
  }

  async function addFiles(files: FileList | null, kind: AttachmentKind, date: string) {
    if (!files) return;
    for (const f of Array.from(files)) await add(f, f.name, f.type.startsWith('image/') && kind === 'file' ? 'photo' : kind, date);
  }

  function remove(a: Attachment) {
    actions.remove(a.id);
    void deleteFile(a.path).catch(() => undefined);
    toast.info(t('Deleted'));
  }

  return { list, add, addFiles, remove, uploading: busy > 0 };
}
