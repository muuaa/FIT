import { useQueryClient } from '@tanstack/react-query';
import { t } from '@/lib/i18n';
import { ClipboardCopy, Download, HardDrive, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { eraseAll, exportAll, importAll, setMeta, storageAvailable, TABLE_NAMES, all } from '@/lib/localDb';
import { cloudEnabled } from '@/lib/supabase';
import { toast } from '@/stores/toastStore';
import { useRestStore, useWorkoutStore } from '@/stores/workoutStore';

const embedded = Boolean(import.meta.env.VITE_EMBEDDED);

export function BackupCard() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState('');
  const [confirmErase, setConfirmErase] = useState(false);
  const [copyFallback, setCopyFallback] = useState<string | null>(null);

  const rowCount = TABLE_NAMES.reduce((n, t) => n + all(t).length, 0);

  const afterChange = () => {
    useWorkoutStore.getState().setActive(null);
    useRestStore.getState().stop();
    qc.invalidateQueries();
  };

  const restore = (text: string) => {
    try {
      importAll(text);
      setMeta({ welcomed: true, sample: false });
      afterChange();
      setPasted('');
      setPasteOpen(false);
      toast.success(t('Backup restored'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Could not restore that backup'));
    }
  };

  const backupText = () => JSON.stringify(exportAll());

  async function copy() {
    const text = backupText();
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('Backup copied. Paste it into Notes or a message to yourself.'));
    } catch {
      setCopyFallback(text);
    }
  }

  function download() {
    const blob = new Blob([backupText()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `better-together-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <Card title={t('Your data')} icon={HardDrive} accent="var(--color-water)">
      <p className="text-sm text-ink-2">
        {cloudEnabled
          ? t('{n} entries, saved to your account. You can also keep your own copy as a file.', { n: rowCount.toLocaleString() })
          : storageAvailable
            ? t('Stored only in this browser on this device ({n} entries). Clearing browser data or uninstalling the browser deletes it, so keep a backup.', { n: rowCount.toLocaleString() })
            : t('Storage is blocked in this browser, so nothing will be kept after you close the page.')}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={copy}>
          <ClipboardCopy size={16} /> {t('Copy backup')}
        </Button>
        {!embedded ? (
          <Button variant="secondary" onClick={download}>
            <Download size={16} /> {t('Download')}
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => setPasteOpen((v) => !v)}>
            <Upload size={16} /> {t('Paste backup')}
          </Button>
        )}
        <Button variant="secondary" className={embedded ? 'col-span-2' : ''} onClick={() => fileRef.current?.click()}>
          <Upload size={16} /> {t('Restore from file')}
        </Button>
        {!embedded && (
          <Button variant="secondary" onClick={() => setPasteOpen((v) => !v)}>
            <ClipboardCopy size={16} /> {t('Paste backup')}
          </Button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json,.txt"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          const reader = new FileReader();
          reader.onload = () => restore(String(reader.result));
          reader.readAsText(f);
        }}
      />

      {copyFallback && (
        <div className="mt-3">
          <p className="mb-1 text-xs text-ink-3">{t('Copying isn\'t allowed here. Select all of the text below and copy it yourself:')}</p>
          <textarea
            id="backup-copy"
            readOnly
            value={copyFallback}
            onFocus={(e) => e.target.select()}
            className="h-28 w-full rounded-2xl border border-line bg-surface-2 p-3 font-mono text-xs text-ink-2"
          />
          <Button size="sm" variant="ghost" onClick={() => setCopyFallback(null)}>
            Done
          </Button>
        </div>
      )}

      {pasteOpen && (
        <div className="mt-3 space-y-2">
          <textarea
            id="backup-paste"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={t('Paste a Better Together backup here')}
            className="h-28 w-full rounded-2xl border border-line bg-surface-2 p-3 font-mono text-xs text-ink outline-none"
          />
          <p className="text-xs text-ink-3">Restoring replaces everything currently in {cloudEnabled ? "your account" : "this app on this device"}.</p>
          <Button block variant="primary" accent="var(--color-water)" disabled={!pasted.trim()} onClick={() => restore(pasted)}>
            {t('Restore this backup')}
          </Button>
        </div>
      )}

      <div className="mt-4 border-t border-line/60 pt-3">
        {confirmErase ? (
          <div className="space-y-2">
            <p className="text-sm text-danger">{cloudEnabled
                ? "Delete every workout, meal, weigh-in and setting from your account, on all your devices? This can't be undone."
                : "Delete every workout, meal, weigh-in and setting on this device? This can't be undone."}</p>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setConfirmErase(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => {
                  eraseAll();
                  setMeta({ welcomed: true });
                  afterChange();
                  setConfirmErase(false);
                  toast.success(t('All data erased'));
                }}
              >
                {t('Erase everything')}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" block onClick={() => setConfirmErase(true)}>
            <Trash2 size={16} /> {t('Erase all data')}
          </Button>
        )}
      </div>
    </Card>
  );
}
