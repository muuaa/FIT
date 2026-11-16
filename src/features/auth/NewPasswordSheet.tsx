import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { supabase } from '@/lib/supabase';
import { toast } from '@/stores/toastStore';
import { useAuth } from './AuthContext';

export function NewPasswordSheet() {
  const { recovering, clearRecovering } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Password updated');
    setPassword('');
    clearRecovering();
  }

  return (
    <Sheet
      open={recovering}
      onClose={clearRecovering}
      title="Choose a new password"
      footer={
        <Button variant="primary" accent="var(--color-lift)" block disabled={busy || password.length < 6} onClick={save}>
          Save password
        </Button>
      }
    >
      <Field
        label="New password"
        type="password"
        minLength={6}
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
    </Sheet>
  );
}
