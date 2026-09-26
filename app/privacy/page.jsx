import SiteChrome from "../_components/SiteChrome";
import NavGrid from "../_components/NavGrid";
import Breadcrumbs from "../_components/Breadcrumbs";
import { abs } from "../_lib/site";
import links from "../../data/links.json";

export const metadata = {
  title: "プライバシーポリシー",
  description:
    "AROMA DAIAMOND（アロマ ダイアモンド）亀戸 のプライバシーポリシー（個人情報保護方針）。個人情報の取り扱い・収集・第三者提供・開示等についてご案内します。",
  alternates: { canonical: abs("privacy/") },
  openGraph: {
    url: abs("privacy/"),
    title: "プライバシーポリシー｜AROMA DAIAMOND 亀戸",
  },
};

export default function Privacy() {
  return (
    <div className="stage">
      <div
        className="device"
        style={{
          background: "#f4efe7 url(../bg-marble.jpg) top center / 100% auto repeat",
        }}
      >
        <Breadcrumbs items={[{ name: "プライバシーポリシー", path: "privacy/" }]} />

        <div className="page-head">
          <div className="ph-en">Privacy</div>
          <h1 className="ph-jp">プライバシーポリシー</h1>
        </div>

        <NavGrid base="../" />

        <p className="terms-intro">
          AROMA DAIAMOND（アロマ ダイアモンド）はお客様のプライバシーを第一に考え運営しております。
          個人情報に対する取り扱いにあたり、以下の事項のプライバシーポリシー（個人情報保護方針）を公表いたします。
        </p>

        <div className="terms-band">個人情報保護の方針</div>

        {/* 1 法律の遵守 */}
        <section className="terms-sec" id="law">
          <h2 className="terms-h">1. 個人情報の保護に関する法律の遵守</h2>
          <p className="terms-p">
            「個人情報の保護に関する法律」に関する関係諸法令その他の規範を遵守するとともに、
            厳正に管理いたします。
          </p>
        </section>

        {/* 2 収集 */}
        <section className="terms-sec" id="collect">
          <h2 className="terms-h">2. 個人情報の収集に関して</h2>
          <p className="terms-p">
            個人情報を収集する場合は、収集目的や利用範囲を明らかにした上で、
            必要な範囲の個人情報を収集いたします。お客様の個人情報は、
            業務上必要な範囲でのご連絡等のために利用いたします。
          </p>
        </section>

        {/* 3 第三者提供 */}
        <section className="terms-sec" id="third">
          <h2 className="terms-h">3. 個人情報の第三者への提供に関して</h2>
          <p className="terms-p">
            個人情報の管理等を第三者に委託する場合は、当該委託会社に対し、
            当該情報が当社の個人情報に関するポリシーに準拠して管理される様、
            適切な措置をとるものとします。また、法令に基づき、国の機関、
            警察からの提供を求められた場合は、お客様の個人情報を提出する場合があります。
          </p>
        </section>

        {/* 4 開示・訂正・利用停止 */}
        <section className="terms-sec" id="disclose">
          <h2 className="terms-h">4. 個人情報の開示・訂正・利用停止について</h2>
          <p className="terms-p">
            お客様から、ご自身の個人情報の開示、訂正、利用停止のご請求があった場合には、
            ご本人であることを確認した上で、速やかに対応いたします。
          </p>
        </section>

        {/* 5 お問い合わせ */}
        <section className="terms-sec" id="contact">
          <h2 className="terms-h">5. お問い合わせ</h2>
          <p className="terms-p">
            上記各項の内容は、継続的に見直し、常にその改善に努めてまいります。
            当サイトのプライバシーポリシーに関するお問い合わせは、下記よりご連絡ください。
          </p>
          <div className="pp-contact" role="note">
            <a className="pp-btn line" href={links.line} target="_blank" rel="noopener noreferrer">
              <span className="pp-btn-ic" aria-hidden="true">
                <svg viewBox="0 0 32 32" width="22" height="22">
                  <rect x="2" y="2" width="28" height="28" rx="8" fill="#06c755" />
                  <path d="M16 8.2c-5 0-9 3.1-9 6.9 0 3.4 3.1 6.3 7.4 6.85.28.06.66.19.76.43.08.22.05.55.03.77l-.12.72c-.04.22-.18.86.77.47.95-.4 5.1-3 6.96-5.14C21.9 24.9 25 22.1 25 15.1c0-3.8-4-6.9-9-6.9z" fill="#fff" />
                </svg>
              </span>
              LINEでお問い合わせ
            </a>
            <a className="pp-btn mail" href="mailto:naoxxx0320@gmail.com">
              <span className="pp-btn-ic" aria-hidden="true">✉</span>
              メールでお問い合わせ
            </a>
          </div>
        </section>

        <p className="pp-meta">
          制定：2026年9月<br />
          AROMA DAIAMOND（アロマ ダイアモンド）／亀戸
        </p>

        <SiteChrome base="../" />
      </div>
    </div>
  );
}
