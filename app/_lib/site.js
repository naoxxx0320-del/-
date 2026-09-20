// サイト共通の定数（SEO / OGP / 構造化データで使用）。
// GitHub Pages ではサブパス配下（/-/）で公開されるため、
// CI（GITHUB_PAGES=true）のときだけ basePath / 本番オリジンを付与する。
// 独自ドメイン導入時は ORIGIN と BASE_PATH を書き換えれば全体に反映される。

const isPages = process.env.GITHUB_PAGES === "true";

export const BASE_PATH = isPages ? "/-" : "";
export const ORIGIN = isPages
  ? "https://naoxxx0320-del.github.io"
  : "http://localhost:3000";

// 正規URL（末尾スラッシュあり）。相対パス連結の起点にする。
export const SITE_URL = `${ORIGIN}${BASE_PATH}/`;

// ルート相対のパスを絶対URLに変換する（OGP画像・canonical 用）。
export const abs = (path = "") => `${SITE_URL}${String(path).replace(/^\/+/, "")}`;

export const SITE = {
  name: "AROMA DAIAMOND",
  nameJa: "アロマ ダイアモンド",
  legalName: "AROMA DAIAMOND（アロマ ダイアモンド）",
  area: "亀戸",
  addressLocality: "亀戸",
  addressRegion: "東京都",
  addressDistrict: "江東区",
  addressCountry: "JP",
  telephone: "+81-50-5444-9830",
  telephoneDisplay: "050-5444-9830",
  email: "naoxxx0320@gmail.com",
  // [営業時間]10:00〜翌5:00 [電話受付]9:30〜翌4:00
  openingHours: "Mo-Su 10:00-29:00",
  priceRange: "¥15,000〜",
  description:
    "宝石のように美しいセラピスト達。極上の癒しと刺激の空間 men's esthetic AROMA DAIAMOND（アロマ ダイアモンド）亀戸。",
  ogImage: "hero-banner.jpg",
  locale: "ja_JP",
};

// GA4 測定ID（例: G-XXXXXXXXXX）。未設定のうちは解析タグは出力されない。
// 取得後に環境変数 NEXT_PUBLIC_GA_ID をセットすれば有効になる。
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "";
