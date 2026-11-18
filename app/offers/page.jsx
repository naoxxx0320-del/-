// 割引・キャンペーン（/offers/）。内容は data/offers.json（料金ページの総額例と共通）。
// 終了日（until）を過ぎた割引は、公開時（毎朝の作り直しを含む）に自動で外れる。
import SiteChrome from "../_components/SiteChrome";
import NavGrid from "../_components/NavGrid";
import Breadcrumbs from "../_components/Breadcrumbs";
import { pageMetadata } from "../_lib/seo";
import { activeOffers, offerExample } from "../_lib/offers";
import offers from "../../data/offers.json";

export const metadata = pageMetadata("offers");

const yen = (n) => n.toLocaleString("ja-JP") + "円";

export default function Offers() {
  const items = activeOffers();
  return (
    <div className="stage">
      <div
        className="device"
        style={{ background: "#f4efe7 url(../bg-marble.jpg) top center / 100% auto repeat" }}
      >
        <Breadcrumbs items={[{ name: "割引・キャンペーン", path: "offers/" }]} />

        <div className="page-head">
          <div className="ph-en">Campaign</div>
          <h1 className="ph-jp">割引・キャンペーン</h1>
        </div>

        <NavGrid base="../" />

        <section className="rec-sec of-sec">
          <p className="of-lead">
            AROMA DIAMOND（アロマダイヤモンド）亀戸で、現在ご利用いただける割引のご案内です。
            金額はすべて税込です。ご利用の際は、ご予約時にお申し出ください。
          </p>

          {items.length === 0 && <p className="of-lead">現在実施中の割引はありません。</p>}

          {items.map((o) => {
            const ex = offerExample(o);
            return (
              <article className="of-card" key={o.id} id={o.id}>
                <div className="of-head">
                  <span className="of-badge">{o.badge}</span>
                  <h2 className="of-name">{o.name}</h2>
                  <p className="of-amount">
                    {yen(o.amount)}
                    <small>OFF</small>
                  </p>
                </div>
                <dl className="of-dl">
                  <div>
                    <dt>対象</dt>
                    <dd>{o.target}</dd>
                  </div>
                  <div>
                    <dt>対象コース</dt>
                    <dd>{o.courses}</dd>
                  </div>
                  {ex && (
                    <div>
                      <dt>ご利用例</dt>
                      <dd>
                        {ex.course} {yen(ex.price)} → <b>{yen(ex.after)}</b>（指名なしの場合）
                      </dd>
                    </div>
                  )}
                </dl>
                {o.note && <p className="of-note">※{o.note}</p>}
              </article>
            );
          })}

          <article className="of-card of-card-member">
            <div className="of-head">
              <span className="of-badge">会員様</span>
              <h2 className="of-name">DIAMOND MEMBERSHIP</h2>
            </div>
            <p className="of-note-plain">
              入会金・年会費無料の会員制度です。ご来店回数に応じたランク特典があります。特典の内容と条件は
              <a href="../membership/">会員制度・VIP特典</a>のページをご覧ください。
            </p>
          </article>
        </section>

        <section className="rec-sec of-sec">
          <div className="rec-sec-h">
            <span className="rec-sec-en">Rules</span>
            <h2 className="rec-sec-jp">ご利用の条件</h2>
          </div>
          <ul className="of-rules">
            {offers.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="of-updated">掲載内容の更新日：{offers.updated.replace(/-/g, "/")}</p>
          <div className="hp-links">
            <a className="hp-link" href="../system/">料金・コース</a>
            <a className="hp-link" href="../schedule/">出勤情報</a>
            <a className="hp-link" href="../first/">はじめての方へ</a>
            <a className="hp-link hp-link-dark" href="../reserve/">WEB予約へ進む</a>
          </div>
        </section>

        <SiteChrome base="../" />
      </div>
    </div>
  );
}
