// セラピスト本人用のシフト入力ページ（/shift/?k=専用の鍵）。
// 管理画面で発行した専用URLからだけ使う。検索には出さず、URLの鍵が外部に送られないようにする。
import ShiftClient from "./ShiftClient";

export const metadata = {
  title: { absolute: "シフト入力｜AROMA DIAMOND" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  alternates: { canonical: null },
};

export default function ShiftPage() {
  return <ShiftClient />;
}
