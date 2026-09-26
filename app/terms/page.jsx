import SiteChrome from "../_components/SiteChrome";
import NavGrid from "../_components/NavGrid";
import Breadcrumbs from "../_components/Breadcrumbs";
import { abs } from "../_lib/site";

export const metadata = {
  title: "ご利用規約",
  description:
    "AROMA DAIAMOND（アロマ ダイアモンド）亀戸 のご利用規約。サービス内容・ご予約・体調と安全・禁止事項・キャンセル/遅刻についてご案内します。",
  alternates: { canonical: abs("terms/") },
  openGraph: { url: abs("terms/"), title: "ご利用規約｜AROMA DAIAMOND 亀戸" },
};

const PROHIBITED = [
  "18歳未満の方、および高校生の方のご利用",
  "性的サービスの要求、セラピストの身体に触れる行為",
  "暴言、威圧、暴力、ハラスメントなど、セラピストの安全を脅かす行為",
  "薬物を使用した状態、または著しく泥酔した状態でのご利用",
  "セラピストや店内の無断撮影・録音・録画、盗撮・盗聴",
  "セラピストの個人的な連絡先の要求や、店外での面会の強要",
  "スカウト、引き抜き、営業妨害を目的とする行為",
  "反社会的勢力に該当する方、またはこれらと関係を有する方のご利用",
  "その他、他のお客様、セラピスト、近隣の方の安全や営業を妨げる行為",
];

export default function Terms() {
  return (
    <div className="stage">
      <div
        className="device"
        style={{
          background: "#f4efe7 url(../bg-marble.jpg) top center / 100% auto repeat",
        }}
      >
        <Breadcrumbs items={[{ name: "ご利用規約", path: "terms/" }]} />

        <div className="page-head">
          <div className="ph-en">Terms</div>
          <h1 className="ph-jp">ご利用規約</h1>
        </div>

        <NavGrid base="../" />

        <p className="terms-intro">
          AROMA DAIAMOND では、すべてのお客様とセラピストが安心して過ごせるよう、
          以下のご利用規約を設けています。ご予約前にご確認ください。
        </p>

        <div className="terms-band">ご利用にあたって</div>

        {/* 1 サービス */}
        <section className="terms-sec" id="service">
          <h2 className="terms-h">1. 当店のサービスについて</h2>
          <p className="terms-p">
            当店は、オイルトリートメントによるリラクゼーションを提供するサロンです。
            医療機関や、あん摩マッサージ指圧・はり・きゅう等の施術所ではありません。
            疾病の診断・治療や医療上の効果を目的としたサービスは提供しておりません。
          </p>
          <p className="terms-p">
            性的なサービスは一切提供しておりません。性的なサービスを目的としたご利用や、
            セラピストへの要求はお断りします。
          </p>
        </section>

        {/* 2 予約 */}
        <section className="terms-sec" id="reserve">
          <h2 className="terms-h">2. ご予約・ご案内について</h2>
          <p className="terms-p">
            公衆電話や非通知設定からのお電話は、お受けできない場合がございます。
          </p>
          <p className="terms-p">
            ご指名いただいたセラピストが体調不良等により対応できなくなった場合は、
            速やかにご連絡し、予約の取り消し、別日時への変更、または指名なしでのご案内を
            相談させていただきます。代替案をお客様に無断で確定することはいたしません。
          </p>
          <p className="terms-p">
            ご来店後のコース変更、キャンセル、担当セラピストの変更は、原則としてお受けできません。
            ただし、当店側の事情による変更や、法令上必要な対応については個別にご案内します。
          </p>
        </section>

        {/* 3 体調・安全 */}
        <section className="terms-sec" id="safety">
          <h2 className="terms-h">3. 体調・安全について</h2>
          <p className="terms-p">
            発熱、強い咳、感染症が疑われる症状、施術を受ける部位の皮膚症状、けがなどがある場合は、
            事前にご相談ください。安全上の理由から、施術内容の変更やご利用の見合わせをお願いする
            場合があります。
          </p>
          <p className="terms-p">
            持病がある方、妊娠中の方、施術を受けてよいか不安のある方は、事前に医師等へご相談ください。
            当店は診断や治療の可否を判断しません。
          </p>
          <p className="terms-p">
            持病・アレルギー・服薬など、施術にあたり配慮が必要な事項は、ご予約時またはご来店時に
            申告制でお知らせください。
          </p>
          <p className="terms-p">
            施術中に痛み、かゆみ、気分の悪さなどを感じた場合は、すぐにセラピストへお知らせください。
          </p>
          <p className="terms-p">
            お手回り品はお客様ご自身でも管理をお願いいたします。紛失・破損や施術に伴う体調の変化などが
            生じた場合は、状況を確認のうえ、法令に従って対応します。
          </p>
        </section>

        {/* 4 禁止事項 */}
        <section className="terms-sec" id="prohibited">
          <h2 className="terms-h">4. 禁止事項</h2>
          <p className="terms-p">
            以下の行為や状態が確認された場合は、ご利用をお断りし、施術中であっても中止を
            お願いすることがあります。
          </p>
          <ul className="terms-list">
            {PROHIBITED.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p className="terms-p">
            違反が認められた場合は、施術を中止し、退出をお願いすることがあります。
            料金・返金については事情を確認し、法令に従って個別に対応します。
            悪質な行為については、警察に相談する場合があります。
          </p>
        </section>

        {/* 5 キャンセル・遅刻 */}
        <section className="terms-sec" id="cancel">
          <h2 className="terms-h">5. キャンセル・遅刻について</h2>
          <p className="terms-p">
            ご予約後のキャンセル・変更はご遠慮いただいております。
          </p>
          <div className="terms-cancel-box" role="note">
            <div className="terms-cancel-h">キャンセル料について</div>
            <p>
              ご予約時間の3時間以内のキャンセルは、施術代金を請求させていただきます。
              やむを得ずキャンセルなさる場合には、3時間前までにご連絡いただきますようお願いいたします。
            </p>
          </div>
          <p className="terms-p">
            ご連絡なく10分以上ご予約時間を過ぎてしまうと、キャンセル扱いになる場合がございます。
            ご連絡があったとしても、コースのお時間を短縮させていただく場合がございます。
          </p>
          <p className="terms-p">
            キャンセルされたお客様につきましては、今後のご予約をお断りする場合がございます。
          </p>
          <p className="terms-p">
            ご連絡なしのキャンセルの場合、以降一切当店のご利用をお断りさせていただきます。
            ご承知おきくださいませ。
          </p>
        </section>

        <SiteChrome base="../" />
      </div>
    </div>
  );
}
