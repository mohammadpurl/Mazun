import { Skeleton } from '@/components/admin/ui/controls';

/** Shown while a panel page loads: the shape of the page (header, four cards, a list), not a spinner. */
export default function Loading() {
  return (
    <div className="stack" aria-busy="true" aria-label="در حال بارگذاری">
      <div className="page-head"><Skeleton h={52} w={52} r={16} /><div className="titles stack-sm"><Skeleton h={12} w={120} /><Skeleton h={24} w={220} /><Skeleton h={12} w={300} /></div></div>
      <div className="grid-4">{[0, 1, 2, 3].map(i => <div key={i} className="stat"><Skeleton h={40} w={40} r={20} /><Skeleton h={14} w="60%" /><Skeleton h={24} w="40%" /></div>)}</div>
      <div className="card stack">{[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} h={44} />)}</div>
    </div>
  );
}
