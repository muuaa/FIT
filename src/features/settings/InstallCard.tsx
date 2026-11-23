import { Download, Share, SquarePlus, Smartphone } from 'lucide-react';
import { t } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { clearInstallPrompt, installPrompt, isStandalone, onInstallChange } from '@/lib/install';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** How to put Better Together on the home screen. Hidden once it's running as an installed app. */
export function InstallCard() {
  const [, rerender] = useState(0);
  useEffect(() => {
    return onInstallChange(() => rerender((n) => n + 1));
  }, []);

  if (import.meta.env.VITE_EMBEDDED || isStandalone()) return null;
  const deferred = installPrompt();

  return (
    <Card title={t('Install on your phone')} icon={Smartphone} accent="var(--color-weight)">
      <p className="mb-3 text-sm text-ink-2">
        {t('Installed, Better Together opens full-screen from your home screen and works offline.')}
      </p>
      {deferred ? (
        <Button
          variant="primary"
          accent="var(--color-weight)"
          block
          onClick={async () => {
            const e = installPrompt();
            if (!e) return;
            await e.prompt();
            await e.userChoice.catch(() => undefined);
            clearInstallPrompt();
          }}
        >
          <Download size={16} /> {t('Install app')}
        </Button>
      ) : isIOS ? (
        <ol className="space-y-2 text-sm text-ink-2">
          <li className="flex items-center gap-2">
            <span className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-surface-3 text-xs font-bold">1</span>
            {t('Open this page in Safari and tap')} <Share size={16} className="text-weight" aria-label={t('Share')} /> {t('Share')}
          </li>
          <li className="flex items-center gap-2">
            <span className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-surface-3 text-xs font-bold">2</span>
            {t('Choose')} <SquarePlus size={16} className="text-weight" aria-hidden /> {t('Add to Home Screen')}
          </li>
        </ol>
      ) : (
        <p className="text-sm text-ink-3">{t('Open your browser\'s menu (⋮) and choose “Install app” or “Add to Home screen”.')}</p>
      )}
    </Card>
  );
}
