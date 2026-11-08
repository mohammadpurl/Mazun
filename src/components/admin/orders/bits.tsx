'use client';
/* Pieces shared by the order screens: product thumbnails, the customer cell, money. */
import Link from 'next/link';
import type { Order, OrderItem } from '@/lib/types';
import { Avatar } from '../ui/controls';
import { faNum, phoneOut } from '../ui/format';

/** What a list needs to draw a piece: its picture and colour. Built on the server from the catalogue. */
export type Pics = Record<string, { img: string; color: string }>;

export function ItemThumbs({ items, pics, max = 3 }: { items: OrderItem[]; pics: Pics; max?: number }) {
  const pieces = items.reduce((a, i) => a + i.qty, 0);
  return (
    <span className="row" style={{ gap: 8, flexWrap: 'nowrap', minWidth: 0 }}>
      <span className="thumbs" aria-hidden="true">
        {/* With more pieces than fit, the last place shows how many more ("+۲") in a bubble of the same size. */}
        {items.slice(0, items.length > max ? max - 1 : max).map((it, i) => {
          const p = it.garmentId ? pics[it.garmentId] : undefined;
          return <span key={i} className="thumb" style={{ background: p?.color ?? 'var(--muted)' }}>{p?.img && <img src={p.img} alt="" loading="lazy" />}</span>;
        })}
        {items.length > max && <span className="thumb more-thumb">+{faNum(items.length - max + 1)}</span>}
      </span>
      <span className="ellipsis xs muted" title={items.map(i => i.name).join('، ')}>{faNum(pieces)} قطعه</span>
    </span>
  );
}

export function CustomerCell({ o, link = true }: { o: Pick<Order, 'customerName' | 'phone' | 'customerId'>; link?: boolean }) {
  return (
    <span className="who">
      <Avatar name={o.customerName} seed={o.phone} size="sm" />
      <span className="meta">
        {link && o.customerId ? <Link href={`/admin/customers/${o.customerId}`}>{o.customerName}</Link> : <b>{o.customerName}</b>}
        <span className="ltr" style={{ textAlign: 'start' }}>{phoneOut(o.phone)}</span>
      </span>
    </span>
  );
}

export const money = (n: number, currency: string) => `${faNum(n)} ${currency}`;
