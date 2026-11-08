'use client';
import { useRouter } from 'next/navigation';
import { startTransition } from 'react';
import { AIcon } from './Icon';

/** A page that failed to load (usually the database): what happened, and a way to try again. "Try again" fetches the
 *  server data again, not only re-renders. In production the server's message is hidden (Next sends a generic English
 *  one with a digest), so the Persian explanation is shown instead. */
export function ErrorState({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const message = !error.digest && error.message ? error.message : 'ارتباط با پایگاه داده برقرار نشد. چند لحظه بعد دوباره امتحان کنید.';
  return (
    <div className="card" role="alert">
      <div className="empty">
        <span className="art"><AIcon name="warning" duo /></span>
        <b>این صفحه بارگذاری نشد</b>
        <span>{message}</span>
        {error.digest && <span className="xs ltr">{error.digest}</span>}
        <div className="row" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn" onClick={() => startTransition(() => { router.refresh(); reset(); })}><AIcon name="refresh" />تلاش دوباره</button>
          <a className="btn outline" href="/admin">داشبورد</a>
        </div>
      </div>
    </div>
  );
}
