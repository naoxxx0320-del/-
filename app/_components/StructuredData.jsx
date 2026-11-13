// 構造化データ（JSON-LD）。トップページにだけ出力し、店舗とサイトの情報を検索エンジンに伝える。
// 住所は方針によりエリア（東京都江東区亀戸）レベルまで。番地・座標は含めない
// （駅の座標を店舗の位置として登録しない）。口コミ・評価点（Review/AggregateRating）は付けない。
// 開業前（SITE.openLabel が入っている間）は営業時間を出さず、営業中と誤解されないようにする。
import { SITE, SITE_URL, abs } from "../_lib/site";
import reserveConfig from "../../data/reserve-config.json";

export default function StructuredData() {
  const courses = Array.isArray(reserveConfig?.courses) ? reserveConfig.courses : [];

  const business = {
    "@context": "https://schema.org",
    "@type": "HealthAndBeautyBusiness",
    "@id": `${SITE_URL}#business`,
    name: SITE.name,
    alternateName: SITE.nameJa,
    description: SITE.description,
    url: SITE_URL,
    telephone: SITE.telephone,
    image: abs(SITE.ogImage),
    logo: abs("icon-512.png"),
    priceRange: SITE.priceRange,
    currenciesAccepted: "JPY",
    // 準備中の支払い方法は「受付可能」として構造化データに含めない。
    paymentAccepted: (reserveConfig?.pays || ["現金", "クレジットカード"])
      .filter((p) => !p.includes("準備中"))
      // 予約フォームの短い表記「カード」を、公開ページと同じ「クレジットカード」にそろえる
      .map((p) => (p === "カード" ? "クレジットカード" : p))
      .join(", "),
    address: {
      "@type": "PostalAddress",
      addressCountry: SITE.addressCountry,
      addressRegion: SITE.addressRegion,
      addressLocality: `${SITE.addressDistrict}${SITE.addressLocality}`,
    },
    areaServed: { "@type": "Place", name: `${SITE.addressRegion}${SITE.addressDistrict}${SITE.area}` },
    // 毎日 10:00〜翌5:00（年中無休）。閉店が開店より前の時刻＝翌日にまたがる営業。
    ...(SITE.openLabel
      ? {}
      : {
          openingHoursSpecification: [
            {
              "@type": "OpeningHoursSpecification",
              dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
              opens: SITE.opens,
              closes: SITE.closes,
            },
          ],
        }),
    ...(courses.length
      ? {
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "コース料金",
            itemListElement: courses.map((c) => ({
              "@type": "Offer",
              name: c.label,
              price: String(c.price),
              priceCurrency: "JPY",
            })),
          },
        }
      : {}),
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}#website`,
    url: SITE_URL,
    name: SITE.name,
    alternateName: SITE.nameJa,
    inLanguage: "ja",
    publisher: { "@id": `${SITE_URL}#business` },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(business) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
    </>
  );
}
