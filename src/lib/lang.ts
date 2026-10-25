import { cookies, headers } from 'next/headers';
import { LANGS, type Lang } from './types';

/** The visitor's language: the "lang" cookie set by the switcher, else the browser's first supported language, else English. */
export async function requestLang(): Promise<Lang> {
  const c = (await cookies()).get('lang')?.value;
  if (c && (LANGS as readonly string[]).includes(c)) return c as Lang;
  const accept = (await headers()).get('accept-language') ?? '';
  for (const part of accept.split(',')) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if ((LANGS as readonly string[]).includes(code)) return code as Lang;
  }
  return 'en';
}
