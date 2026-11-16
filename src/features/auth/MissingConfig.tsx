import { TriangleAlert } from 'lucide-react';

export function MissingConfig() {
  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center gap-3 px-6 text-sm text-ink-2">
      <TriangleAlert className="text-lift" />
      <h1 className="text-lg font-semibold text-ink">Supabase isn't configured</h1>
      <p>
        Set <code className="text-ink">VITE_SUPABASE_URL</code> and <code className="text-ink">VITE_SUPABASE_ANON_KEY</code>{' '}
        in <code className="text-ink">.env.local</code> (or in your Vercel project settings) and reload. See the README for
        the full setup guide.
      </p>
    </div>
  );
}
