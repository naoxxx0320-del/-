import SiteChrome from "../_components/SiteChrome";

export const metadata = {
  title: "外国人の方へ｜AROMA DAIAMOND 亀戸 メンズエステ",
  description:
    "For foreign customers of AROMA DAIAMOND (Kameido). Reservation guide in English.",
};

const STEPS = [
  {
    n: "01",
    en: "Choose a therapist & course",
    jp: "セラピストとコースをお選びください",
  },
  {
    n: "02",
    en: "Contact us by phone, LINE or the web form",
    jp: "お電話・LINE・WEBフォームでご連絡ください",
  },
  {
    n: "03",
    en: "We confirm availability and reply to you",
    jp: "空き状況を確認しご返信します",
  },
  {
    n: "04",
    en: "After confirmation, we send the room address",
    jp: "予約確定後、お部屋の住所をご案内します",
  },
];

export default function Foreigners() {
  return (
    <div className="stage">
      <div
        className="device"
        style={{
          background:
            "#f4efe7 url(../bg-marble.jpg) top center / 100% auto repeat",
        }}
      >
        <div className="page-head">
          <div className="ph-en">For foreign customers</div>
          <div className="ph-jp">外国人の方へ</div>
        </div>

        <section className="fgn">
          <p className="fgn-lead">
            Our salon is a relaxation oil-massage shop, <b>not an adult shop</b>.
            Because very few of our staff and therapists speak English, prices
            may differ for guests who cannot communicate in Japanese. Services
            for foreign guests are available only with therapists marked
            <b> [FGN&nbsp;WELCOME]</b> on their photo. Payment is accepted in
            Japanese yen only, and we cannot accept overseas credit cards.
            Please make a reservation only if you understand and agree with the
            above.
          </p>

          <div className="fgn-box">
            <div className="fgn-box-head">
              <span className="fgn-dia" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path d="M4.5 9 L12 2.5 L19.5 9 L12 21.5 Z" fill="none" stroke="#b18e46" strokeWidth="1.1" strokeLinejoin="round" />
                  <path d="M4.5 9 H19.5 M9 9 L12 21.5 M15 9 L12 21.5 M9 9 L12 2.5 M15 9 L12 2.5" fill="none" stroke="#b18e46" strokeWidth="0.8" />
                </svg>
              </span>
              Steps to make a reservation
            </div>
            <ul className="fgn-steps">
              {STEPS.map((s, i) => (
                <li key={i}>
                  <span className="fs-n">{s.n}</span>
                  <span className="fs-txt">
                    <b>{s.en}</b>
                    <small>{s.jp}</small>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="fgn-note">
            If you can speak Japanese, please contact us by phone — we can take
            your reservation at the Japanese price.
            <br />
            日本語が話せる方はお電話ください。日本人料金でご案内いたします。
          </p>

          <a className="fgn-tel" href="tel:05054449830">
            Tel : 050-5444-9830
          </a>
        </section>

        <SiteChrome base="../" />
      </div>
    </div>
  );
}
