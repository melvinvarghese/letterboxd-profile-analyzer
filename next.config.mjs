/** @type {import('next').NextConfig} */
const repoBase = process.env.NEXT_PUBLIC_BASE_PATH || '';
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: repoBase ? `/${repoBase.replace(/^\/+|\/+$/g, '')}` : '',
  images: { unoptimized: true },
  poweredByHeader: false,
};
export default nextConfig;
