'use client';
import { ErrorState } from '@/components/admin/ui/ErrorState';

/** The panel frame itself failed to load (its first database reads): the same message, on its own page. */
export default function AdminError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="error-page"><ErrorState {...props} /></main>;
}
