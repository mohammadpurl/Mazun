'use client';
import Link from 'next/link';
import { Ornament } from './fx';
import { Icon } from './Icon';
import { useShop } from './Shop';

/** Shown when a link leads nowhere: the shop's own chrome, a short note in the visitor's language, a way back. A
 *  missing product says so; any other address gets the general note. The tab title comes from each 404's metadata. */
export function NotFound({ what }: { what: 'piece' | 'page' }) {
  const { c } = useShop();
  const title = what === 'piece' ? c.notFoundTitle : c.pageNotFoundTitle;
  return (
    <main className="mz-404">
      {/* A CSS entrance, so the note is there even before (or without) scripts: this page is rendered on the server. */}
      <div className="mz-404__in">
        <p className="mz-404__code" aria-hidden="true">404</p>
        <h1 className="mz-h2">{title}</h1>
        <p className="mz-body">{what === 'piece' ? c.notFoundBody : c.pageNotFoundBody}</p>
        <Ornament className="mz-404__orn" />
        <Link href="/#collection" className="mz-btn is-main">{c.notFoundCta}<Icon name="next" size={20} className="mz-arrow" /></Link>
      </div>
    </main>
  );
}
