/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "deifkwefumgah.cloudfront.net",
        pathname: "/shadcnblocks/**",
      },
    ],
  },
};

export default nextConfig;
