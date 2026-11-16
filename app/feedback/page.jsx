// ご意見フォーム（/feedback/）。内容は店舗へメールし、予約管理の「ご意見」シートに記録する。
// 検索結果に出す必要のないフォームなので noindex（サイトマップにも載せない）。
import SiteChrome from "../_components/SiteChrome";
import NavGrid from "../_components/NavGrid";
import Breadcrumbs from "../_components/Breadcrumbs";
import FeedbackForm from "./FeedbackForm";
import { buildMetadata } from "../_lib/seo";
import { byRank } from "../_components/rank";
import roster from "../../data/roster.json";
import price from "../../data/price.json";

export const metadata = buildMetadata({
  path: "feedback/",
  title: "ご意見フォーム｜AROMA DIAMOND 亀戸",
  description: "AROMA DIAMOND（アロマダイヤモンド）亀戸をご利用いただいたお客様のご意見・ご評価をお寄せください。",
  index: false,
});

// 担当セラピストの選択肢：在籍中の名簿（表示順）。値は名簿の名前（照合キー）、表示は表示名。
const THERAPISTS = byRank(roster.filter((t) => t && t.name)).map((t) => ({
  value: t.name,
  label: t.nameFull || t.name,
}));
const COURSES = price.courses.map((c) => c.title);

export default function Feedback() {
  return (
    <div className="stage">
      <div
        className="device"
        style={{ background: "#f4efe7 url(../bg-marble.jpg) top center / 100% auto repeat" }}
      >
        <Breadcrumbs items={[{ name: "ご意見フォーム", path: "feedback/" }]} />

        <div className="page-head">
          <div className="ph-en">Feedback</div>
          <h1 className="ph-jp">ご意見フォーム</h1>
        </div>

        <NavGrid base="../" />

        <FeedbackForm therapists={THERAPISTS} courses={COURSES} />

        <SiteChrome base="../" />
      </div>
    </div>
  );
}
