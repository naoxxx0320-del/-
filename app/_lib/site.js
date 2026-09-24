// サイト共通の定数（SEO / OGP / 構造化データで使用）。
// 独自ドメイン aroma-daiamond.com をトップ階層で配信するため basePath は無し。
// CI（GITHUB_PAGES=true）のときだけ本番オリジンを付与し、
// ローカル開発（npm run dev）では localhost を使う。

const isPages = process.env.GITHUB_PAGES === "true";

export const BASE_PATH = "";
export const ORIGIN = isPages
  ? "https://aroma-daiamond.com"
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
  telephone: "00-0000-0000",
  telephoneDisplay: "00-0000-0000",
  email: "naoxxx0320@gmail.com",
  // [営業時間]10:00〜翌5:00 [電話受付]9:30〜翌4:00
  openingHours: "Mo-Su 10:00-29:00",
  hoursBusiness: "10:00〜翌5:00", // 表示用（営業時間）
  hoursPhone: "9:30〜翌4:00", // 表示用（電話受付）
  priceRange: "¥13,000〜",
  description:
    "宝石のように美しいセラピスト達。極上の癒しと刺激の空間 men's esthetic AROMA DAIAMOND（アロマ ダイアモンド）亀戸。",
  ogImage: "hero-banner.jpg",
  locale: "ja_JP",
};

// GA4 測定ID（例: G-XXXXXXXXXX）。未設定のうちは解析タグは出力されない。
// 取得後に環境変数 NEXT_PUBLIC_GA_ID をセットすれば有効になる。
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "";
