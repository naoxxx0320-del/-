import RecruitPage from "../_components/RecruitPage";
import { abs } from "../_lib/site";

export const metadata = {
  title: "セラピスト求人",
  description:
    "AROMA DAIAMOND（アロマ ダイアモンド）亀戸 のセラピスト求人。施術・接客のお仕事です。報酬の仕組みや勤務条件をご確認のうえご応募ください。",
  alternates: { canonical: abs("recruit/") },
  openGraph: {
    url: abs("recruit/"),
    title: "セラピスト求人｜AROMA DAIAMOND 亀戸",
  },
};

export default function Recruit() {
  return <RecruitPage role="therapist" />;
}
