import { Dumbbell, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { supabase } from '@/lib/supabase';

type Mode = 'signin' | 'signup' | 'reset';

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim() }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) setNotice('Check your inbox to confirm your email, then sign in.');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setNotice('If that email has an account, a reset link is on its way.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pt-safe mx-auto flex min-h-full max-w-sm flex-col justify-center px-6 py-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 grid size-16 place-items-center rounded-3xl bg-gradient-to-br from-lift to-lift-2 text-bg">
          <Dumbbell size={30} strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">FIT</h1>
        <p className="mt-1 text-sm text-ink-3">Training · Fuel · Hydration · Progress</p>
      </div>

      {mode !== 'reset' && (
        <Segmented
          className="mb-5"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError(null);
            setNotice(null);
          }}
          options={[
            { value: 'signin', label: 'Sign in' },
            { value: 'signup', label: 'Create account' },
          ]}
        />
      )}

      <form onSubmit={submit} className="space-y-3">
        {mode === 'signup' && (
          <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" />
        )}
        <Field
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          inputMode="email"
        />
        {mode !== 'reset' && (
          <Field
            label="Password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
        )}

        {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        {notice && (
          <p className="flex items-start gap-2 rounded-xl bg-fuel/10 px-3 py-2 text-sm text-fuel">
            <Mail size={16} className="mt-0.5 shrink-0" />
            {notice}
          </p>
        )}

        <Button type="submit" variant="primary" accent="var(--color-lift)" size="lg" block disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
        </Button>
      </form>

      <button
        type="button"
        className="mt-5 text-sm text-ink-3 underline-offset-4 active:underline"
        onClick={() => {
          setMode(mode === 'reset' ? 'signin' : 'reset');
          setError(null);
          setNotice(null);
        }}
      >
        {mode === 'reset' ? 'Back to sign in' : 'Forgot password?'}
      </button>
    </div>
  );
}
