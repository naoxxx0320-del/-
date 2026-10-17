// /schedule はクライアントコンポーネントのため、メタデータはこの
// サーバー用レイアウトで付与する（canonical を自ページに向ける）。
import Breadcrumbs from "../_components/Breadcrumbs";
import { pageMetadata } from "../_lib/seo";

export const metadata = pageMetadata("schedule");

export default function ScheduleLayout({ children }) {
  return (
    <>
      <Breadcrumbs items={[{ name: "出勤情報", path: "schedule/" }]} visible={false} />
      {children}
    </>
  );
}
