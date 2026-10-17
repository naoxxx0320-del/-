import RecruitPage from "../_components/RecruitPage";
import { pageMetadata } from "../_lib/seo";

export const metadata = pageMetadata("recruit");

export default function Recruit() {
  return <RecruitPage role="therapist" />;
}
