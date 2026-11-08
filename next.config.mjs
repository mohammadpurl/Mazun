/** @type {import('next').NextConfig} */
const supabaseHost = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : null;

export default {
  poweredByHeader: false,
  // /abaya with no piece named goes to the collection, before the shop layout runs.
  async redirects() {
    return [{ source: '/abaya', destination: '/#collection', permanent: false }];
  },
  // The live mirror's pose model and wasm (~15 MB). The paths carry no version, so they are cached for a day and
  // refreshed in the background, not kept for a year: an upgrade must not leave a stale wasm behind the new loader.
  async headers() {
    return [{ source: '/mediapipe/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }] }];
  },
  images: {
    remotePatterns: supabaseHost ? [{ protocol: 'https', hostname: supabaseHost }] : [],
  },
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
    // src/app/global-not-found.tsx: unknown addresses get the shop's 404 without every page paying for it.
    globalNotFound: true,
  },
};
