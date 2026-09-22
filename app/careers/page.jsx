import RecruitPage from "../_components/RecruitPage";
import { abs } from "../_lib/site";

export const metadata = {
  title: "スタッフ求人｜受付・店舗運営",
  description:
    "AROMA DAIAMOND（アロマ ダイアモンド）亀戸 の受付・店舗運営スタッフ求人。仕事内容と募集条件をご確認のうえご応募ください。",
  alternates: { canonical: abs("careers/") },
  openGraph: {
    url: abs("careers/"),
    title: "スタッフ求人｜受付・店舗運営｜AROMA DAIAMOND 亀戸",
  },
};

export default function Careers() {
  return <RecruitPage role="staff" />;
}
