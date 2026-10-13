/* デジタル会員証（ブラック×ゴールド）。VIP の有効期限は設定がなければ「無期限」。 */
import { DiamondIcon } from "./icons";

export default function MemberCard({ memberNo, kind, nickname, validUntil }) {
  const vip = kind === "VIP";
  const until = String(validUntil || "").replace(/\//g, ".");
  return (
    <div className="mb-card" role="img" aria-label={`${vip ? "OPENING VIP MEMBER" : "MEMBER"} No.${memberNo}`}>
      <div className="mb-card-top">
        <DiamondIcon size={22} color="#d9bf86" sw={1.2} />
        <span className="mb-card-brand">AROMA DIAMOND</span>
      </div>
      <p className="mb-card-kind">{vip ? "OPENING VIP MEMBER" : "DIAMOND MEMBERSHIP"}</p>
      <p className="mb-card-no">MEMBER No.{memberNo}</p>
      <div className="mb-card-foot">
        <span className="mb-card-name">{nickname ? `${nickname} 様` : ""}</span>
        {vip && <span className="mb-card-exp">有効期限：{until || "無期限"}</span>}
      </div>
    </div>
  );
}
