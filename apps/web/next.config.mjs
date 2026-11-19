// Security headers apply to every route. Inline scripts and styles are allowed because Next.js and the theme bootstrap use them;
// everything else is restricted to the site's own origin.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export default {
  poweredByHeader: false,
  devIndicators: false,
  compress: true,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        {key: 'X-Content-Type-Options', value: 'nosniff'},
        {key: 'Referrer-Policy', value: 'same-origin'},
        {key: 'X-Frame-Options', value: 'DENY'},
        {key: 'Content-Security-Policy', value: csp},
        {key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()'},
        {key: 'Strict-Transport-Security', value: 'max-age=15552000; includeSubDomains'},
        {key: 'Cross-Origin-Opener-Policy', value: 'same-origin'},
      ],
    }, {
      // The brand and icon assets never change between deploys of the same name, so browsers may cache them for a long time.
      source: '/brand/:path*',
      headers: [{key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400'}],
    }, {
      source: '/images/:path*',
      headers: [{key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400'}],
    }];
  },
};
