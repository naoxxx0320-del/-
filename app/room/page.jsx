// ルーム紹介（/room/）。写真はすべて実際のルーム（2026年11月撮影・オーナー提供）。
// ※設備は写真で確認できるものだけを書く。推測で設備・アメニティを足さないこと。
// ※色気のある表現はOK。ただし性的なサービスを連想させる表現は書かない
//   （ご利用規約・FAQの「性的なサービスは一切行っておりません」と食い違うため）。
// ※シャワーの利用時間（コース時間に含むか）は書かない（オーナー指示）。
import SiteChrome from "../_components/SiteChrome";
import NavGrid from "../_components/NavGrid";
import Breadcrumbs from "../_components/Breadcrumbs";
import { photoSrc } from "../_components/photo";
import { SITE } from "../_lib/site";
import { pageMetadata } from "../_lib/seo";

export const metadata = pageMetadata("room");

const SPACES = [
  {
    en: "Lounge",
    h: "ふたりきりの、くつろぎ空間",
    photo: "room-lounge.jpg",
    w: 880,
    h2: 660,
    alt: "グレーのソファとラウンドテーブルのあるくつろぎスペース｜AROMA DIAMOND 亀戸",
    p: [
      "扉を閉めた瞬間から、ここはあなたとセラピストだけの時間。",
      "壁に輝く DIAMOND のロゴに迎えられ、やわらかなソファに深く身を沈めれば、張りつめていた心がふっとほどけていきます。お着替え用のハンガーラックもご用意しています。",
    ],
  },
  {
    en: "Treatment",
    h: "肌で感じる、とろける施術スペース",
    photo: "room-bed.jpg",
    w: 900,
    h2: 1076,
    alt: "ワイドなマットと黒いタオルで整えた施術スペース｜AROMA DIAMOND 亀戸",
    p: [
      "ゆったりと身体を伸ばせるワイドなマットに、黒で統一したタオル。",
      "温めたアロマオイルがじんわりと肌になじみ、セラピストの指先がゆっくりと全身をたどるたびに、日々の疲れが溶けていく——。誰にも邪魔されない、大人のひとときをお愉しみください。",
    ],
  },
  {
    en: "Bath Room",
    h: "シャワー完備のバスルーム",
    photo: "room-bath.jpg",
    w: 900,
    h2: 1107,
    alt: "シャワー・浴槽・洗面台のあるバスルーム｜AROMA DIAMOND 亀戸",
    p: [
      "清潔に整えた、シャワー・浴槽付きのバスルーム。",
      "お仕事帰りでも、さっぱりとリフレッシュしていただけます。",
    ],
  },
];

const FACILITIES = [
  ["ルーム", "1室のみの完全個室"],
  ["くつろぎスペース", "ソファ・ラウンドテーブル・ハンガーラック"],
  ["施術スペース", "ワイドマット・タオル"],
  ["バスルーム", "シャワー・浴槽・洗面台"],
  ["場所", `${SITE.station}${SITE.stationExit}から徒歩${SITE.walkMinutes}分（詳しい場所はご予約確定後にご案内）`],
];

export default function Room() {
  return (
    <div className="stage">
      <div
        className="device"
        style={{ background: "#f4efe7 url(../bg-marble.jpg) top center / 100% auto repeat" }}
      >
        <Breadcrumbs items={[{ name: "ルーム紹介", path: "room/" }]} />

        <div className="page-head">
          <div className="ph-en">Room</div>
          <h1 className="ph-jp">ルーム紹介</h1>
        </div>

        <NavGrid base="../" />

        <section className="room-lead">
          <p className="room-lead-catch">
            1室だけの、
            <br />
            秘密の完全個室へ。
          </p>
          <p className="room-lead-p">
            ブラックとホワイトで仕立てた、大人のためのプライベートルーム。
            {SITE.station}{SITE.stationExit}から徒歩{SITE.walkMinutes}分、ほかの誰の目も気にせず、
            アロマの香りとセラピストのぬくもりに身を委ねる——そんな贅沢な時間をご用意しています。
          </p>
        </section>

        {SPACES.map((s, i) => (
          <section className="room-space" key={s.photo}>
            <div className="section-head">
              <div className="sh-en">{s.en}</div>
              <h2 className="sh-jp room-h">{s.h}</h2>
            </div>
            <div className="concept">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="concept-img"
                src={photoSrc(s.photo, "../")}
                alt={s.alt}
                width={s.w}
                height={s.h2}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
              />
              {s.p.map((t) => (
                <p className="concept-p room-p" key={t}>
                  {t}
                </p>
              ))}
            </div>
          </section>
        ))}

        <section className="rec-sec room-facts" aria-labelledby="room-facts-h">
          <div className="rec-sec-h">
            <span className="rec-sec-en">Facility</span>
            <h2 className="rec-sec-jp" id="room-facts-h">ルーム設備</h2>
          </div>
          <table className="rec-table">
            <tbody>
              {FACILITIES.map(([k, v]) => (
                <tr key={k}>
                  <th>{k}</th>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="img-note">※写真は実際のルームです</p>
          <div className="hp-links">
            <a className="hp-link" href="../system/">料金・コース</a>
            <a className="hp-link" href="../flow/">ご利用の流れ</a>
            <a className="hp-link" href="../schedule/">出勤情報</a>
            <a className="hp-link hp-link-dark" href="../reserve/">WEB予約へ進む</a>
          </div>
        </section>

        <SiteChrome base="../" />
      </div>
    </div>
  );
}
