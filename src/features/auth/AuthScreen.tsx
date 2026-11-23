import { Eye, EyeOff, LogIn, Mail, UserPlus } from 'lucide-react';
import { t } from '@/lib/i18n';
import { useState, type FormEvent } from 'react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { appUrl, supabase } from '@/lib/supabase';

type Mode = 'signin' | 'signup' | 'reset';

function friendly(message: string): string {
  if (/sign-ups are closed|database error saving new user|signups not allowed/i.test(message))
    return t('Better Together is private to two people, and both accounts already exist. Sign in instead.');
  if (/invalid login credentials/i.test(message)) return t('Wrong email or password.');
  if (/email not confirmed/i.test(message)) return t('Confirm your email first: open the link we sent you, then sign in.');
  if (/already registered|already been registered/i.test(message)) return t('There is already an account with this email. Sign in instead.');
  if (/password should be at least/i.test(message)) return t('Use a password of at least 8 characters.');
  if (/rate limit|too many/i.test(message)) return t('Too many tries. Wait a minute and try again.');
  if (/failed to fetch|network/i.test(message)) return t('No internet connection. Connect and try again.');
  return message;
}

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const valid = emailOk && (mode === 'reset' || password.length >= (mode === 'signup' ? 8 : 1));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !valid || busy) return;
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
          options: { emailRedirectTo: appUrl() },
        });
        if (error) throw error;
        if (!data.session) {
          setNotice(t('We sent a confirmation link to {email}. Open it on this device, then sign in here.', { email: email.trim() }));
          setMode('signin');
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl() });
        if (error) throw error;
        setNotice(t('If {email} has an account, a link to set a new password is on its way.', { email: email.trim() }));
        setMode('signin');
      }
    } catch (err) {
      setError(friendly(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-full max-w-sm flex-col justify-center px-5 py-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo size={64} />
        <h1 className="mt-4 text-2xl font-bold tracking-tight">{t('Better Together')}</h1>
        <p className="mt-1 text-sm text-ink-3">{t('Everything, together')}</p>
      </div>

      {mode !== 'reset' && (
        <Segmented<Mode>
          className="mb-5"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError(null);
          }}
          options={[
            { value: 'signin', label: t('Sign in') },
            { value: 'signup', label: t('Create account') },
          ]}
        />
      )}

      <form onSubmit={submit} className="space-y-3">
        {mode === 'reset' && (
          <div>
            <h2 className="text-lg font-semibold">{t('Reset your password')}</h2>
            <p className="text-sm text-ink-3">{t('We\'ll email you a link to choose a new one.')}</p>
          </div>
        )}
        <Field
          label={t('Email')}
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('you@example.com')}
        />
        {mode !== 'reset' && (
          <Field
            label={t('Password')}
            type={show ? 'text' : 'password'}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={mode === 'signup' ? t('At least 8 characters.') : undefined}
            suffix={
              <button
                type="button"
                aria-label={show ? t('Hide password') : t('Show password')}
                onClick={() => setShow((v) => !v)}
                className="-me-1 grid size-9 place-items-center rounded-lg text-ink-3"
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />
        )}

        {error && <p className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">{error}</p>}
        {notice && <p className="rounded-2xl border border-fuel/30 bg-fuel/10 px-4 py-3 text-sm text-ink" role="status">{notice}</p>}

        <Button type="submit" variant="primary" accent="var(--color-fuel)" size="lg" block disabled={!valid || busy}>
          {mode === 'signin' ? <LogIn size={18} /> : mode === 'signup' ? <UserPlus size={18} /> : <Mail size={18} />}
          {busy ? t('Please wait…') : mode === 'signin' ? t('Sign in') : mode === 'signup' ? t('Create account') : t('Send reset link')}
        </Button>
      </form>

      <div className="mt-4 text-center">
        {mode === 'reset' ? (
          <button type="button" className="text-sm font-medium text-ink-2" onClick={() => setMode('signin')}>
            {t('Back to sign in')}
          </button>
        ) : mode === 'signin' ? (
          <button type="button" className="text-sm font-medium text-ink-2" onClick={() => setMode('reset')}>
            {t('Forgot password?')}
          </button>
        ) : null}
      </div>

      <p className="mt-8 text-center text-xs text-ink-3">
        {t('Your data is private to your account and works offline. Anything already on this phone moves into your account when you first sign in.')}
      </p>
    </div>
  );
}

/** Shown after opening a password-reset link. */
export function NewPasswordScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="pt-safe mx-auto flex min-h-full max-w-sm flex-col justify-center px-5 py-10">
      <div className="mb-6 flex flex-col items-center text-center">
        <Logo size={56} />
        <h1 className="mt-4 text-xl font-bold">{t('Choose a new password')}</h1>
      </div>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!supabase || password.length < 8) return;
          setBusy(true);
          const { error } = await supabase.auth.updateUser({ password });
          setBusy(false);
          if (error) setError(friendly(error.message));
          else onDone();
        }}
      >
        <Field label={t('New password')} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} hint={t('At least 8 characters.')} />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" variant="primary" accent="var(--color-fuel)" size="lg" block disabled={password.length < 8 || busy}>
          {t('Save password')}
        </Button>
      </form>
    </div>
  );
}
