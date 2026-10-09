import SiteChrome from "../../_components/SiteChrome";
import CardView from "./CardView";

export const metadata = {
  title: "デジタル会員証",
  description: "AROMA DIAMOND のデジタル会員証。",
  robots: { index: false, follow: false }, // ご本人専用ページ（検索に出さない）
};

export default function MemberCardPage() {
  return (
    <div className="stage">
      <div className="device" style={{ background: "#f4efe7 url(../../bg-marble.jpg) top center / 100% auto repeat" }}>
        <CardView />
        <SiteChrome base="../../" />
      </div>
    </div>
  );
}
