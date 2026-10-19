import { NextResponse } from 'next/server';
import { bad, guardAdminApi } from '@/lib/auth';
import { db } from '@/lib/db';
import { sniffImage } from '@/lib/image';

const MAX_BYTES = 4 * 1024 * 1024;

/** Accepts one image ("file" field), checks its real type from the bytes, stores it and returns its URL. */
export async function POST(req: Request) {
  const denied = await guardAdminApi(req);
  if (denied) return denied;
  let file: File | null = null;
  try { file = (await req.formData()).get('file') as File | null; } catch { /* not multipart */ }
  if (!file || typeof file === 'string') return bad({ file: 'فایلی ارسال نشده' });
  if (file.size > MAX_BYTES) return bad({ file: 'حجم تصویر بیش از ۴ مگابایت است' });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) return bad({ file: 'فقط تصویر PNG، JPEG یا WebP پذیرفته می‌شود' });
  const name = `g/${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}.${kind.ext}`;
  const url = await db().uploadImage(bytes, kind.mime, name);
  return NextResponse.json({ url });
}
