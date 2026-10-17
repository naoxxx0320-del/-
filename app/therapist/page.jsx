import SiteChrome from "../_components/SiteChrome";
import NavGrid from "../_components/NavGrid";
import roster from "../../data/roster.json";
import Breadcrumbs from "../_components/Breadcrumbs";
import TherapistDirectory from "./TherapistDirectory";
import { pageMetadata } from "../_lib/seo";

export const metadata = pageMetadata("therapist");

export default function Therapist() {
  return (
    <div className="stage">
      <div
        className="device"
        style={{
          background:
            "#f4efe7 url(../bg-marble.jpg) top center / 100% auto repeat",
        }}
      >
        <Breadcrumbs items={[{ name: "セラピスト紹介", path: "therapist/" }]} />

        {/* ヘッダーバナー（既存画像を仮置き） */}
        <section
          className="staff-hero"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(30,8,10,.86) 0%, rgba(40,10,14,.55) 45%, rgba(40,10,14,.25) 100%), url(../therapist-intro.jpg)",
          }}
        >
          <div className="staff-hero-en">Staff</div>
          <h1 className="staff-hero-jp">在籍セラピスト紹介</h1>
          <div className="staff-hero-rule" aria-hidden="true" />
          <div className="staff-hero-sub">美しさと癒しを、最高の形で——</div>
          <div className="staff-hero-badge">Special Girls</div>
        </section>

        <NavGrid base="../" />

        {roster.length === 0 ? (
          <p className="therapists-empty">セラピスト情報は準備中です。</p>
        ) : (
          <TherapistDirectory roster={roster} />
        )}

        <SiteChrome base="../" />
      </div>
    </div>
  );
}
