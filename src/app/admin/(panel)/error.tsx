'use client';
import { ErrorState } from '@/components/admin/ui/ErrorState';

/** A page inside the panel that failed to load; the sidebar and header stay. */
export default function PanelError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState {...props} />;
}
