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
  name: "AROMA DIAMOND",
  nameJa: "アロマダイヤモンド",
  legalName: "AROMA DIAMOND（アロマダイヤモンド）",
  area: "亀戸",
  addressLocality: "亀戸",
  addressRegion: "東京都",
  addressDistrict: "江東区",
  addressCountry: "JP",
  telephone: "090-4391-8013",
  telephoneDisplay: "090-4391-8013",
  email: "naoxxx0320@gmail.com",
  // [営業時間]10:00〜翌5:00 [電話受付]9:30〜翌4:00
  openingHours: "Mo-Su 10:00-29:00",
  hoursBusiness: "10:00〜翌5:00", // 表示用（営業時間）
  hoursPhone: "9:30〜翌4:00", // 表示用（電話受付）
  priceRange: "¥13,000〜",
  // 最寄駅からの距離（表示を一元管理。変更時はここだけ直す）
  station: "JR亀戸駅",
  stationExit: "北口",
  walkMinutes: 4,
  // 開業予定（表示用）。開業後は openLabel を空にすると「オープン予定」表記が消える。
  openLabel: "2026年11月中旬オープン",
  description:
    "JR亀戸駅北口から徒歩4分のメンズエステ「AROMA DIAMOND（アロマダイヤモンド）」。完全個室のプライベート空間でアロマトリートメントをご案内します。2026年11月中旬オープン。料金・セラピスト紹介・出勤情報・WEB予約はこちら。",
  ogImage: "hero-banner.jpg",
  locale: "ja_JP",
};

// 電話番号ユーティリティ（表示とtelリンクを一元管理）。
//   表示：SITE.telephoneDisplay（例 090-4391-8013）
//   リンク：telHref()（例 tel:09043918013）ハイフン等を除去した安全な文字列
export const telDigits = (s = SITE.telephone) => String(s).replace(/\D/g, "");
export const telHref = (s = SITE.telephone) => `tel:${telDigits(s)}`;

// Google Tag Manager コンテナID（アクセス解析はGTMに一本化）。
export const GTM_ID = "GTM-M4CPNNDT";

// GA4 測定ID（例: G-XXXXXXXXXX）。
// このサイトは GA4 を gtag.js でコードから直接配信する（Analytics.jsx）。
// ※GTM 側に GA4 設定タグを作らないこと。作ると二重計測になる。
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-YDRYPPM122";
