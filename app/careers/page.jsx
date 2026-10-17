import RecruitPage from "../_components/RecruitPage";
import { pageMetadata } from "../_lib/seo";

export const metadata = pageMetadata("careers");

export default function Careers() {
  return <RecruitPage role="staff" />;
}
