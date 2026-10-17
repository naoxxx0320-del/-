// トップページ（サーバー側）。title・description・canonical はここで付与し、
// 画面本体はクライアントコンポーネント（HomeClient）で描画する。
// 店舗・サイトの構造化データ（JSON-LD）はトップページにだけ出力する。
import HomeClient from "./HomeClient";
import StructuredData from "./_components/StructuredData";
import { pageMetadata } from "./_lib/seo";

export const metadata = pageMetadata("home");

export default function Home() {
  return (
    <>
      <StructuredData />
      <HomeClient />
    </>
  );
}
