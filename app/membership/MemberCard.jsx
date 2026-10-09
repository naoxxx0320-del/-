/* デジタル会員証（ブラック×ゴールド）。VIP は有効期限つき。 */
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
        {vip && until && <span className="mb-card-exp">有効期限：{until}</span>}
      </div>
    </div>
  );
}
