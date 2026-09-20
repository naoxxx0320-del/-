// 構造化データ（JSON-LD）。検索エンジンに店舗情報を正しく認識させ、
// 「営業時間」「エリア」「料金」などをリッチに表示させるための埋め込み。
// 住所は方針によりエリア（東京都江東区亀戸）レベルまで。番地は含めない。
import { SITE, SITE_URL, abs } from "../_lib/site";
import reserveConfig from "../../data/reserve-config.json";

export default function StructuredData() {
  const courses = Array.isArray(reserveConfig?.courses) ? reserveConfig.courses : [];

  const business = {
    "@context": "https://schema.org",
    "@type": "HealthAndBeautyBusiness",
    "@id": `${SITE_URL}#business`,
    name: `${SITE.name}（${SITE.nameJa}）`,
    description: SITE.description,
    url: SITE_URL,
    telephone: SITE.telephone,
    email: SITE.email,
    image: abs(SITE.ogImage),
    priceRange: SITE.priceRange,
    currenciesAccepted: "JPY",
    paymentAccepted: (reserveConfig?.pays || ["現金", "クレジットカード", "PayPay"]).join(", "),
    address: {
      "@type": "PostalAddress",
      addressCountry: SITE.addressCountry,
      addressRegion: SITE.addressRegion,
      addressLocality: `${SITE.addressDistrict}${SITE.addressLocality}`,
    },
    areaServed: { "@type": "Place", name: `${SITE.addressRegion}${SITE.area}` },
    openingHours: SITE.openingHours,
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
    name: `${SITE.name}｜${SITE.nameJa}｜${SITE.area} メンズエステ`,
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
