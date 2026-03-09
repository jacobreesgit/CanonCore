/**
 * Next.js configuration with security headers and MDX support.
 */

/* global process */

import bundleAnalyzer from "@next/bundle-analyzer";
import { createMDX } from "fumadocs-mdx/next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Content Security Policy directives.
 * Configured to allow necessary features while maintaining security.
 *
 * Note on 'unsafe-inline' and 'unsafe-eval':
 * These are required for the following dependencies:
 * - Next.js: Development mode hot reload requires eval
 * - Vidstack: Video player uses inline styles and scripts
 * - Fumadocs: MDX rendering requires inline script evaluation
 *
 * Alternatives considered but not viable:
 * - Nonce-based CSP: Would require middleware changes and break caching
 * - Strict CSP: Would break video playback and documentation
 *
 * Security impact: Low - all scripts are first-party and XSS is mitigated
 * by React's built-in escaping and server component architecture.
 */
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https:;
  font-src 'self' data:;
  connect-src 'self' https:;
  worker-src 'self' blob:;
  media-src 'self' blob: https:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
`;

/**
 * Security headers applied to all routes.
 * Based on OWASP recommendations and Next.js best practices.
 */
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: cspHeader.replace(/\s{2,}/g, " ").trim(),
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use a separate build directory for E2E server to avoid lock conflicts
  // with the dev server running on port 3000.
  ...(process.env.NEXT_DIST_DIR && { distDir: process.env.NEXT_DIST_DIR }),
  devIndicators: false,
  // Transpile fumadocs packages to ensure proper compilation on Vercel
  transpilePackages: ["fumadocs-core", "fumadocs-mdx", "fumadocs-ui"],
  experimental: {
    // Tree-shake barrel imports for these packages to reduce bundle size
    optimizePackageImports: [
      "date-fns",
      "motion",
      "@fortawesome/free-solid-svg-icons",
      "@vidstack/react",
    ],
  },
  /**
   * Bot handling: Aggressive bots are blocked at proxy level, beneficial bots
   * are rate-limited. htmlLimitedBots is not needed since:
   * - Modern search engines (Google, Bing) handle streaming fine
   * - Aggressive crawlers are blocked before reaching pages
   * - Avoiding htmlLimitedBots maintains streaming benefits for all users
   */
  images: {
    localPatterns: [
      {
        pathname: "/api/playlist/artwork",
      },
      {
        pathname: "/api/user/avatar",
      },
      {
        pathname: "/api/user/hero",
      },
      {
        pathname: "/images/**",
      },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "deifkwefumgah.cloudfront.net",
        pathname: "/shadcnblocks/**",
      },
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
        pathname: "/vi/**",
      },
      {
        protocol: "https",
        hostname: "l4wlsi8vxy8hre4v.public.blob.vercel-storage.com",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

const withMDX = createMDX();
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const config = withBundleAnalyzer(withMDX(nextConfig));

export default withSentryConfig(config, {
  // Upload source maps for readable stack traces (maps not served to browsers)
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
  // Route Sentry requests through the server to bypass ad-blockers
  tunnelRoute: "/monitoring",
  // Suppress Sentry CLI logs during build
  silent: !process.env.CI,
  // Disable Sentry telemetry
  telemetry: false,
});
