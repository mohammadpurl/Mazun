/** @type {import('next').NextConfig} */
const supabaseHost = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : null;

export default {
  poweredByHeader: false,
  images: {
    remotePatterns: supabaseHost ? [{ protocol: 'https', hostname: supabaseHost }] : [],
  },
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
  },
};
