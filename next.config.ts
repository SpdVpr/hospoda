import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  poweredByHeader: false,
  async redirects() {
    return ['hospoda.vercel.app', 'hospoda-spdvprs-projects.vercel.app'].map(host => ({
      source: '/:path*',
      has: [{ type: 'host' as const, value: host }],
      destination: 'https://team.hospodavesnice.cz/:path*',
      permanent: true,
    }));
  },
  async headers() {
    const development = process.env.NODE_ENV === 'development';
    return [{ source: '/:path*', headers: [
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
      { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline'" + (development ? " 'unsafe-eval'" : "") + "; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://ucxnvmvxwvhcakradpgg.supabase.co https://lh3.googleusercontent.com; connect-src 'self' https://ucxnvmvxwvhcakradpgg.supabase.co wss://ucxnvmvxwvhcakradpgg.supabase.co" + (development ? " ws:" : "") + "; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'" },
    ] }];
  },
};

export default nextConfig;
