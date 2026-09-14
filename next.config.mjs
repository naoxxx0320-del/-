/** @type {import('next').NextConfig} */

// Repo is published at https://<user>.github.io/<repo>/ so a basePath is
// required on GitHub Pages. It is applied only in CI (GITHUB_PAGES=true),
// so local `npm run dev` / `npm run build` keep working at the root.
const repo = "-";
const isPages = process.env.GITHUB_PAGES === "true";

const nextConfig = {
  output: "export", // static HTML export -> ./out
  images: { unoptimized: true },
  trailingSlash: true,
  basePath: isPages ? `/${repo}` : "",
  assetPrefix: isPages ? `/${repo}/` : "",
  reactStrictMode: true,
};

export default nextConfig;
