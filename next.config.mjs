/** @type {import('next').NextConfig} */

// 独自ドメイン（aroma-daiamond.com）をトップ階層で配信するため basePath は不要。
// public/CNAME により GitHub Pages が自動でカスタムドメインを設定する。
// もし github.io サブパス配信に戻す場合は basePath / assetPrefix に `/-` を指定する。

const nextConfig = {
  output: "export", // static HTML export -> ./out
  images: { unoptimized: true },
  trailingSlash: true,
  basePath: "",
  assetPrefix: "",
  reactStrictMode: true,
};

export default nextConfig;
