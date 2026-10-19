/** JSON call to an admin API route. Throws an Error whose `errors` holds per-field messages from the server. */
export async function api<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (r.status === 401) { location.href = '/admin/login'; throw new Error('نشست شما تمام شده است'); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.error || (data.errors ? Object.values(data.errors).join(' • ') : 'خطا در ارتباط با سرور')) as Error & { errors?: Record<string, string> };
    err.errors = data.errors;
    throw err;
  }
  return data as T;
}

/** Downscales an image to WebP (keeps transparency) and uploads it; returns its URL. */
export async function uploadImage(file: File, max = 1200): Promise<string> {
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(img.src);
  const blob = await new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('تبدیل تصویر انجام نشد'))), 'image/webp', 0.86));
  const fd = new FormData();
  fd.append('file', blob, 'image.webp');
  const r = await fetch('/api/admin/upload', { method: 'POST', body: fd });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.errors?.file || data.error || 'بارگذاری تصویر انجام نشد');
  return data.url as string;
}

export const faNum = (n: number) => n.toLocaleString('fa-IR', { maximumFractionDigits: 3 });
export const faDate = (iso: string, withTime = true) =>
  new Date(iso).toLocaleString('fa-IR', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
/** Order numbers without thousands separators (#۱۰۰۱, not #۱,۰۰۱). */
export const faId = (n: number) => n.toLocaleString('fa-IR', { useGrouping: false });
