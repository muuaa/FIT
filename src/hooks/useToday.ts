import { useEffect, useState } from 'react';
import { todayISO } from '@/lib/date';

/**
 * Today's local date (YYYY-MM-DD) that updates when the calendar day changes, including when the app
 * is brought back to the foreground the next morning. Without this, an installed PWA left open overnight
 * keeps logging to yesterday.
 */
export function useToday(): string {
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    const check = () => setToday((prev) => {
      const now = todayISO();
      return now === prev ? prev : now;
    });
    const id = window.setInterval(check, 30_000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);
  return today;
}
