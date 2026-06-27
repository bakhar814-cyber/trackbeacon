/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // The worker imports server-only modules; keep them external in server bundles.
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "prisma"],
  },
};
export default nextConfig;
