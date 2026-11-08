import { notFound } from 'next/navigation';

/** Unknown admin addresses get the panel's own 404, inside the panel, rather than the shop's. */
export default function MissingAdminPage() {
  notFound();
}
