import SiteChrome from "../_components/SiteChrome";
import NavGrid from "../_components/NavGrid";
import Breadcrumbs from "../_components/Breadcrumbs";
import { SITE, abs } from "../_lib/site";
import links from "../../data/links.json";

export const metadata = {
  title: "はじめての方へ",
  description:
    "AROMA DAIAMOND（アロマ ダイアモンド）亀戸 をはじめてご利用の方へ。ご予約・お問い合わせ方法とご利用の流れ（STEP1〜5）をご案内します。",
  alternates: { canonical: abs("first/") },
  openGraph: { url: abs("first/"), title: "はじめての方へ｜AROMA DAIAMOND 亀戸" },
};

const TEL_DIGITS = SITE.telephone.replace(/\D/g, "");

export default function FirstVisit() {
  return (
    <div className="stage">
      <div
        className="device"
        style={{
          background: "#f4efe7 url(../bg-marble.jpg) top center / 100% auto repeat",
        }}
      >
        <Breadcrumbs items={[{ name: "はじめての方", path: "first/" }]} />

        <div className="page-head">
          <div className="ph-en">First Visit</div>
          <h1 className="ph-jp">はじめての方へ</h1>
        </div>

        <NavGrid base="../" />

        <section className="first-page fv">
          <h2 className="fv-title">当店ご利用初めてのお客さまへ</h2>
          <p className="fv-lead">
            お問い合わせ・ご予約は
            <br />
            お電話、またはWEBで承ります。
          </p>

          {/* 電話・WEB予約 */}
          <a className="fv-btn-brown" href={`tel:${TEL_DIGITS}`}>
            <small>お電話でのご予約・お問い合わせ</small>
            <b>{SITE.telephoneDisplay}</b>
          </a>
          <a className="fv-btn-brown" href="../reserve/">
            <small>24時間受付中</small>
            <b>WEB予約はこちら</b>
          </a>

          {/* 新規割引 */}
          <div className="fv-campaign">
            <div className="fv-campaign-h">
              <span aria-hidden="true">🎁</span> 新規割引についてはこちら
            </div>
            <div className="fv-campaign-body">
              <b>【ご利用条件】</b>
              <br />
              ご利用時にはLINEのご登録が必要です
              <br />
              既存の会員様はご利用になれません
              <br />
              <span className="muted">（ご新規のお客様限定となります）</span>
              <br />
              <br />
              <span className="note">
                ※現在CAMPAIGN中につき、ご新規・会員さま向けにクーポン発行中です！
              </span>
            </div>
          </div>

          {/* LINE友だち追加 */}
          <a
            className="fv-btn-green"
            href={links.line}
            target="_blank"
            rel="noopener noreferrer"
          >
            LINE友だち追加はこちら
          </a>

          {/* キャンセルポリシー */}
          <div className="fv-cancel">
            <h3>ご予約のキャンセルポリシー</h3>
            <p>ご予約変更・キャンセルは下記をご確認ください。</p>
            <a className="fv-btn-outline" href="../terms/#cancel">
              キャンセルポリシーを見る &gt;
            </a>
          </div>

          {/* ご利用の流れ */}
          <div className="fv-band">ご利用の流れ</div>

          <div className="fv-step">
            <div className="fv-step-h">
              <span className="no">STEP.1</span> セラピストの選択
            </div>
            <p>
              お好みのセラピストをお選びください。
              <br />
              「誰を選べばいいか分からない」という場合は、
              <b>「フリー（指名なし）」</b>でのご案内も可能です。当店おすすめのセラピストをご紹介いたします。
              <br />
              <span className="muted">
                ※セラピストにより待機ルームが異なる場合がございますので、事前にプロフィール等でご確認ください。
              </span>
            </p>
          </div>

          <div className="fv-step">
            <div className="fv-step-h">
              <span className="no">STEP.2</span> ご予約
            </div>
            <p>お電話、または24時間対応のWEB予約フォームよりご予約ください。</p>
          </div>

          <div className="fv-step">
            <div className="fv-step-h">
              <span className="no">STEP.3</span> 確認メールへのご返信
            </div>
            <p>
              ご予約当日の約1時間前に、店舗より確認のショートメール（SMS）をお送りします。
              内容をご確認の上、<span className="em">必ずSMSにてご返信をお願いいたします。</span>
            </p>
          </div>

          <div className="fv-step">
            <div className="fv-step-h">
              <span className="no">STEP.4</span> ご到着前の連絡
            </div>
            <p>
              ご予約時間の<b>10分前</b>（ルームにより5分前）になりましたら、
              指定の場所より店舗へお電話またはSMSにてご連絡ください。
              詳細な入室方法をご案内いたします。
            </p>
          </div>

          <div className="fv-step">
            <div className="fv-step-h">
              <span className="no">STEP.5</span> ご入室・施術開始
            </div>
            <p>
              ご予約のお時間ちょうどになりましたら、ルームのインターホン（チャイム）を鳴らしてご入室ください。
              セラピストとの素敵な癒やしの時間をお楽しみください。
            </p>
          </div>

          <a className="fv-btn-green" href="../">
            トップへ戻る
          </a>
        </section>

        <SiteChrome base="../" />
      </div>
    </div>
  );
}
