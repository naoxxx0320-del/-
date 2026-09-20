// /schedule はクライアントコンポーネントのため、メタデータはこの
// サーバー用レイアウトで付与する（canonical を自ページに向ける）。
import { abs } from "../_lib/site";

export const metadata = {
  title: "出勤情報",
  description:
    "AROMA DAIAMOND（アロマ ダイアモンド）亀戸 本日の出勤・案内状況。空き状況をリアルタイムに更新中。",
  alternates: { canonical: abs("schedule/") },
  openGraph: { url: abs("schedule/"), title: "出勤情報｜AROMA DAIAMOND 亀戸" },
};

export default function ScheduleLayout({ children }) {
  return children;
}
