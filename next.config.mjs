/**
 * Next.js configuration with security headers and MDX support.
 */

import { createMDX } from "fumadocs-mdx/next";

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
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https:;
  font-src 'self' data:;
  connect-src 'self' https:;
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
  images: {
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

export default withMDX(nextConfig);
