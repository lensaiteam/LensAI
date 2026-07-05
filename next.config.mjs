/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The old static HTML prototype is kept only as a visual reference and must
  // never be compiled or served by Next.
  webpack: (config) => config,
};

export default nextConfig;
