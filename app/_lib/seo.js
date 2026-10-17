// ページ別SEO設定（title・description・canonical・OGP・X カード・index可否）を一元管理する。
// 各ページは `export const metadata = pageMetadata("system")` のように呼ぶだけでよい。
// 文言を変えるときはこのファイルの PAGES だけを直す。
//   - title は「検索意図＋店名」。キーワードを連呼しない。
//   - Google は検索結果のタイトル・説明文を書き換えることがある（設定値どおりに出るとは限らない）。
import { SITE, abs } from "./site";

const BRAND = "AROMA DIAMOND";
const KAMEIDO = "亀戸 メンズエステ";
const WALK = `${SITE.station}${SITE.stationExit}から徒歩${SITE.walkMinutes}分`;

export const PAGES = {
  home: {
    path: "",
    title: "亀戸のメンズエステ｜アロマダイヤモンド【公式】",
    description: SITE.description,
  },
  system: {
    path: "system/",
    title: `料金・コース案内｜${KAMEIDO} ${BRAND}`,
    description:
      "亀戸のメンズエステ AROMA DIAMOND の料金・コース案内。60分13,000円から、70分あおむけ・90分・120分・150分コースをご用意。指名料・オプション料金、お支払い方法もご案内します。表示価格はすべて税込です。",
  },
  therapist: {
    path: "therapist/",
    title: `セラピスト紹介｜亀戸のメンズエステ ${BRAND}`,
    description:
      "AROMA DIAMOND（アロマダイヤモンド）亀戸の在籍セラピスト紹介。プロフィールと出勤予定をご確認のうえ、WEB・LINE・お電話でご予約いただけます。",
  },
  schedule: {
    path: "schedule/",
    title: `セラピスト出勤情報｜${KAMEIDO} ${BRAND}`,
    description:
      "AROMA DIAMOND（アロマダイヤモンド）亀戸のセラピスト出勤スケジュール。日別の出勤予定と案内状況を掲載しています。ご希望のセラピストを選んでWEB予約へお進みください。",
  },
  access: {
    path: "access/",
    title: `アクセス・店舗案内｜亀戸駅徒歩${SITE.walkMinutes}分｜${BRAND}`,
    description: `AROMA DIAMOND（アロマダイヤモンド）は${WALK}、東京都江東区亀戸のメンズエステです。プライバシー保護のため、詳しい所在地はご予約確定後にご案内します。`,
  },
  flow: {
    path: "flow/",
    title: `ご利用の流れ｜${KAMEIDO} ${BRAND}`,
    description:
      "AROMA DIAMOND（アロマダイヤモンド）亀戸のご利用の流れ。ご予約からご来店、駅からの道順、施術、退店までを分かりやすくご案内します。",
  },
  first: {
    path: "first/",
    title: `はじめての方へ｜${KAMEIDO} ${BRAND}`,
    description:
      "AROMA DIAMOND（アロマダイヤモンド）亀戸をはじめてご利用の方へ。ご予約・お問い合わせ方法とご利用の流れ（STEP1〜5）をご案内します。",
  },
  faq: {
    path: "faq/",
    title: `よくある質問・お問い合わせ｜${KAMEIDO} ${BRAND}`,
    description:
      "AROMA DIAMOND（アロマダイヤモンド）亀戸のよくある質問。ご予約方法、料金とお支払い、アクセス、施術内容、会員制度についてお答えします。お問い合わせはLINE・お電話で受け付けています。",
  },
  reserve: {
    path: "reserve/",
    title: `WEB予約｜${KAMEIDO} ${BRAND}`,
    description:
      "AROMA DIAMOND（アロマダイヤモンド）亀戸のWEB予約。セラピスト・日時・コースを選んで、空き状況を確認しながらご予約リクエストを送信できます。",
  },
  membership: {
    path: "membership/",
    title: `無料VIP会員・会員特典｜${KAMEIDO} ${BRAND}`,
    description:
      "AROMA DIAMOND（アロマダイヤモンド）亀戸の会員制度「DIAMOND MEMBERSHIP」。オープン記念 OPENING VIP は先着100名様限定・入会金年会費無料。ご来店回数に応じて SILVER・GOLD・DIAMOND の特典が受けられます。",
    ogDescription: "OPENING VIP 先着100名様限定。来店するほど、特別な待遇へ。",
  },
  recruit: {
    path: "recruit/",
    title: `亀戸のメンズエステ求人｜セラピスト募集｜${BRAND}`,
    description:
      "亀戸のメンズエステ「AROMA DIAMOND」でオープニングセラピスト募集中。未経験歓迎、デビュー前の研修あり。コース料金の歩合60〜75%、指名料・オプション料は100%バック。仕事内容・待遇・応募方法をご案内します。",
  },
  careers: {
    path: "careers/",
    title: `受付・運営スタッフ求人｜${KAMEIDO} ${BRAND}`,
    description:
      "AROMA DIAMOND（アロマダイヤモンド）亀戸の受付・店舗運営スタッフ求人のご案内。仕事内容をご紹介しています。募集条件は確定次第このページに掲載します。",
  },
  foreigners: {
    path: "foreigners/",
    title: `外国人の方へ / For Foreign Customers｜${BRAND} 亀戸`,
    description:
      "For foreign customers of AROMA DIAMOND, a men's aroma relaxation salon near JR Kameido Station, Tokyo. Reservation guide in English.",
  },
  gallery: {
    path: "gallery/",
    title: `フォトギャラリー｜${KAMEIDO} ${BRAND}`,
    description: "AROMA DIAMOND（アロマダイヤモンド）亀戸の空間・セラピストのフォトギャラリー。",
  },
  links: {
    path: "links/",
    title: `リンク集｜${BRAND} 亀戸`,
    description:
      "AROMA DIAMOND（アロマダイヤモンド）亀戸の掲載サイト・提携サイトのご紹介。お客様向けの店舗情報サイトと、セラピスト求人サイトに分けてご案内します。",
  },
  terms: {
    path: "terms/",
    title: `ご利用規約｜${BRAND} 亀戸`,
    description:
      "AROMA DIAMOND（アロマダイヤモンド）亀戸のご利用規約。サービス内容・ご予約・体調と安全・禁止事項・キャンセル/遅刻についてご案内します。",
  },
  privacy: {
    path: "privacy/",
    title: `プライバシーポリシー｜${BRAND} 亀戸`,
    description:
      "AROMA DIAMOND（アロマダイヤモンド）亀戸のプライバシーポリシー（個人情報保護方針）。個人情報の取り扱い・収集・第三者提供・開示等についてご案内します。",
  },
};

const OG_IMAGE = { url: abs(SITE.ogImage), width: 1600, height: 698, alt: `${SITE.name}（${SITE.nameJa}）${SITE.area}` };

// ページ用の metadata を組み立てる。openGraph / twitter は Next.js の仕様上
// 親レイアウトと「丸ごと置き換え」になるため、画像も含めて毎回すべて指定する。
export function buildMetadata({ path, title, description, ogDescription, image, index = true }) {
  const url = abs(path);
  const images = image ? [{ url: abs(image), alt: title }] : [OG_IMAGE];
  return {
    title: { absolute: title },
    description,
    alternates: index ? { canonical: url } : { canonical: null },
    robots: index ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      type: "website",
      locale: SITE.locale,
      siteName: SITE.name,
      url,
      title,
      description: ogDescription || description,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: ogDescription || description,
      images: images.map((i) => i.url),
    },
  };
}

export function pageMetadata(key, extra = {}) {
  const p = PAGES[key];
  if (!p) throw new Error(`unknown page key: ${key}`);
  return buildMetadata({ ...p, ...extra });
}
