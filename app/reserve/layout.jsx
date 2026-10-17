// /reserve はクライアントコンポーネントのため、メタデータはこの
// サーバー用レイアウトで付与する（canonical を自ページに向ける）。
import Breadcrumbs from "../_components/Breadcrumbs";
import { pageMetadata } from "../_lib/seo";

export const metadata = pageMetadata("reserve");

export default function ReserveLayout({ children }) {
  return (
    <>
      <Breadcrumbs items={[{ name: "WEB予約", path: "reserve/" }]} visible={false} />
      <h1 className="sr-only">WEB予約｜AROMA DIAMOND（アロマダイヤモンド）亀戸</h1>
      {children}
    </>
  );
}
