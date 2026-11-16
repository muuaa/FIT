import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
  tone: 'error' | 'success' | 'info';
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, tone?: Toast['tone']) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  push: (message, tone = 'info') => {
    const id = nextId++;
    set({ toasts: [...get().toasts.slice(-2), { id, message, tone }] });
    window.setTimeout(() => get().dismiss(id), tone === 'error' ? 5000 : 2500);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = {
  error: (m: string) => useToastStore.getState().push(m, 'error'),
  success: (m: string) => useToastStore.getState().push(m, 'success'),
  info: (m: string) => useToastStore.getState().push(m, 'info'),
};
