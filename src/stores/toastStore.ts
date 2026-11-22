import { create } from 'zustand';
import { t } from '@/lib/i18n';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: number;
  message: string;
  tone: 'error' | 'success' | 'info';
  action?: ToastAction;
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, tone?: Toast['tone'], action?: ToastAction) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  push: (message, tone = 'info', action) => {
    const id = nextId++;
    set({ toasts: [...get().toasts.slice(-2), { id, message, tone, action }] });
    // Toasts with an action (Undo) stay a little longer so there's time to reach them.
    window.setTimeout(() => get().dismiss(id), action ? 5000 : tone === 'error' ? 5000 : 2500);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = {
  error: (m: string) => useToastStore.getState().push(m, 'error'),
  success: (m: string) => useToastStore.getState().push(m, 'success'),
  info: (m: string) => useToastStore.getState().push(m, 'info'),
  /** "Deleted X" with an Undo button. */
  undo: (m: string, onUndo: () => void) => useToastStore.getState().push(m, 'info', { label: t('Undo'), onClick: onUndo }),
};
