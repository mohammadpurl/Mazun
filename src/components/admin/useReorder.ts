'use client';
import { useState } from 'react';
import { api } from './api';

/** Drag-and-drop plus up/down reordering for an admin list; saves the new id order to `url`.
 *  Shared by the garment and category lists. */
export function useReorder<T extends { id: string }>(items: T[], setItems: (v: T[]) => void, url: string) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function commit(next: T[]) {
    const prev = items;
    setItems(next); setError('');
    try { await api(url, 'PUT', next.map(x => x.id)); }
    catch (e) { setItems(prev); setError((e as Error).message); }
  }
  function move(id: string, to: number) {
    const from = items.findIndex(x => x.id === id);
    if (from < 0 || to < 0 || to >= items.length || from === to) return;
    const next = items.slice();
    next.splice(to, 0, next.splice(from, 1)[0]);
    void commit(next);
  }
  /** Props for one draggable row. */
  const rowProps = (id: string) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => { setDragId(id); e.dataTransfer.effectAllowed = 'move'; },
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); if (overId !== id) setOverId(id); },
    onDragLeave: () => setOverId(o => (o === id ? null : o)),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); if (dragId) move(dragId, items.findIndex(x => x.id === id)); setDragId(null); setOverId(null); },
    onDragEnd: () => { setDragId(null); setOverId(null); },
    className: dragId === id ? 'dragging' : overId === id ? 'over' : '',
  });
  return { move, rowProps, error };
}
