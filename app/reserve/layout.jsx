// /reserve はクライアントコンポーネントのため、メタデータはこの
// サーバー用レイアウトで付与する（canonical を自ページに向ける）。
import { abs } from "../_lib/site";

export const metadata = {
  title: "WEB予約",
  description:
    "AROMA DAIAMOND（アロマ ダイアモンド）亀戸 のWEB予約。空き状況を確認しながら24時間ご予約いただけます。",
  alternates: { canonical: abs("reserve/") },
  openGraph: { url: abs("reserve/"), title: "WEB予約｜AROMA DAIAMOND 亀戸" },
};

export default function ReserveLayout({ children }) {
  return children;
}
