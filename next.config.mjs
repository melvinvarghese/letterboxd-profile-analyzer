/** Static export: no server, public API credential, or runtime environment required. */
const repoBase = process.env.NEXT_PUBLIC_BASE_PATH || "";
export default {
  output: "export",
  trailingSlash: true,
  basePath: repoBase ? `/${repoBase.replace(/^\/+|\/+$/g, "")}` : "",
  images: { unoptimized: true },
  poweredByHeader: false,
};
