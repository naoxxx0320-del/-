// よくある質問・お問い合わせ（/faq/）。
// 回答はサイト内の既存情報（料金表・ご利用規約・アクセス・会員制度）と同じ内容だけを載せる。
// 料金や条件を変えたときは、元のページとあわせてここも更新すること。
// ※FAQPage の構造化データは付けない（現在の Google 検索では表示対象が限られるため）。
import SiteChrome from "../_components/SiteChrome";
import NavGrid from "../_components/NavGrid";
import Breadcrumbs from "../_components/Breadcrumbs";
import { SITE, telHref } from "../_lib/site";
import { pageMetadata } from "../_lib/seo";
import links from "../../data/links.json";

export const metadata = pageMetadata("faq");

const WALK = `${SITE.station}${SITE.stationExit}から徒歩${SITE.walkMinutes}分`;

const GROUPS = [
  {
    h: "ご予約について",
    items: [
      {
        q: "予約方法を教えてください。",
        a: (
          <>
            <a href="../reserve/">WEB予約</a>・公式LINE・お電話（受付 {SITE.hoursPhone}）で承っています。
            WEB予約はご予約リクエストの送信となり、当店から日時と内容を確認してご案内した時点で確定となります。
          </>
        ),
      },
      {
        q: "営業時間と定休日は？",
        a: (
          <>
            営業時間は{SITE.hoursBusiness}、年中無休です{SITE.openLabel ? `（${SITE.openLabel}予定）` : ""}。
            お電話の受付は{SITE.hoursPhone}です。
          </>
        ),
      },
      {
        q: "キャンセルや遅刻をする場合は？",
        a: (
          <>
            ご予約時間の3時間以内のキャンセルは、施術代金を請求させていただきます。やむを得ない場合は3時間前までにご連絡ください。
            ご連絡なく10分以上ご予約時間を過ぎた場合、キャンセル扱いになることがあります。詳しくは
            <a href="../terms/#cancel">ご利用規約</a>をご確認ください。
          </>
        ),
      },
      {
        q: "はじめてでも利用できますか？",
        a: (
          <>
            はい。ご予約からご来店、お帰りまでの流れを<a href="../first/">はじめての方へ</a>・
            <a href="../flow/">ご利用の流れ</a>でご案内しています。
          </>
        ),
      },
    ],
  },
  {
    h: "料金・お支払いについて",
    items: [
      {
        q: "料金はいくらですか？",
        a: (
          <>
            60分コース13,000円（当日予約・空き枠限定）から、70分あおむけ・90分・120分・150分コースをご用意しています。
            指名料・オプション料金とあわせて<a href="../system/">料金・コース案内</a>をご覧ください。表示価格はすべて税込です。
          </>
        ),
      },
      {
        q: "指名料はかかりますか？",
        a: "写真指名・本指名は1,000円、姫指名（セラピスト経由のご予約）は2,000円です。姫指名と本指名の料金は重複しません。",
      },
      {
        q: "延長はできますか？",
        a: "延長30分6,000円で承ります。担当セラピストに直接お申し出ください。ご予約状況によりお受けできない場合があります。",
      },
      {
        q: "支払い方法は？",
        a: "現金・クレジットカードがご利用いただけます（お支払いは前払いです）。PayPayは現在準備中です。",
      },
    ],
  },
  {
    h: "アクセス・サービスについて",
    items: [
      {
        q: "お店の場所はどこですか？",
        a: (
          <>
            東京都江東区亀戸、{WALK}です。プライバシー保護のため、詳しい所在地はご予約確定後にLINEまたはお電話でご案内します。
            <a href="../access/">アクセス・店舗案内</a>もご覧ください。
          </>
        ),
      },
      {
        q: "どのようなサービスですか？",
        a: (
          <>
            完全個室で、アロマオイルを使用したトリートメントによるリラクゼーションをご提供します。
            医療機関ではなく、疾病の治療を目的としたサービスや、性的なサービスは一切行っておりません。
          </>
        ),
      },
      {
        q: "会員制度はありますか？",
        a: (
          <>
            入会金・年会費無料の会員制度「DIAMOND MEMBERSHIP」があります。オープン記念のOPENING VIPは先着100名様限定です。
            詳しくは<a href="../membership/">会員制度・VIP特典</a>をご覧ください。
          </>
        ),
      },
      {
        q: "外国語での案内はありますか？",
        a: (
          <>
            英語でのご案内を<a href="../foreigners/">外国人の方へ / For Foreign Customers</a>に掲載しています。
          </>
        ),
      },
    ],
  },
];

export default function Faq() {
  return (
    <div className="stage">
      <div
        className="device"
        style={{ background: "#f4efe7 url(../bg-marble.jpg) top center / 100% auto repeat" }}
      >
        <Breadcrumbs items={[{ name: "よくある質問", path: "faq/" }]} />

        <div className="page-head">
          <div className="ph-en">Q &amp; A</div>
          <h1 className="ph-jp">よくある質問</h1>
        </div>

        <NavGrid base="../" />

        {GROUPS.map((g) => (
          <section className="terms-sec" key={g.h}>
            <h2 className="terms-h">{g.h}</h2>
            <div className="mb-faq">
              {g.items.map((f) => (
                <details className="mb-faq-item" key={f.q}>
                  <summary>
                    <span className="mb-q">Q.</span>
                    {f.q}
                  </summary>
                  <p>
                    <span className="mb-a">A.</span>
                    {f.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        ))}

        {/* お問い合わせ（フッターの「お問い合わせ」からここへ移動） */}
        <section className="terms-sec" id="contact">
          <h2 className="terms-h">お問い合わせ</h2>
          <p className="terms-p">
            ご予約・ご質問は、公式LINEまたはお電話でお気軽にお問い合わせください。
            お電話の受付は{SITE.hoursPhone}です。
          </p>
          <div className="acc-cta">
            <a className="acc-btn" href={telHref()}>
              <span className="ab-en">Tel</span>
              <span className="ab-jp">{SITE.telephoneDisplay}</span>
            </a>
            <a className="acc-btn" href={links.line} target="_blank" rel="noopener noreferrer">
              <span className="ab-en">LINE</span>
              <span className="ab-jp">LINEで問い合わせ</span>
            </a>
            <a className="acc-btn" href="../reserve/">
              <span className="ab-en">Web</span>
              <span className="ab-jp">WEB予約</span>
            </a>
          </div>
          <p className="terms-p">
            セラピスト求人へのご応募・ご質問は<a href="../recruit/">セラピスト求人</a>ページからお願いします。
          </p>
        </section>

        <SiteChrome base="../" />
      </div>
    </div>
  );
}
