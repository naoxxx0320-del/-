/* ナビゲーション用のゴールドアイコン（SVG）。
   全アイコン共通のゴールドグラデーションは NavGoldDef を一度だけ描画して参照する。 */

export function NavGoldDef() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
      <defs>
        <linearGradient id="navGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7e6b4" />
          <stop offset="0.5" stopColor="#e2c17f" />
          <stop offset="1" stopColor="#b7894b" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const G = "url(#navGold)";

const ICONS = {
  crown: (
    <path d="M2.8 8.2l4.4 3L12 3.8l4.8 7.4 4.4-3-1.9 9.8H4.7L2.8 8.2z" fill={G} />
  ),
  calendar: (
    <>
      <g fill="none" stroke={G} strokeWidth="1.6" strokeLinejoin="round">
        <rect x="3.5" y="5" width="17" height="15" rx="2" />
        <path d="M3.5 9.2h17M8 3.2v3.4M16 3.2v3.4" strokeLinecap="round" />
      </g>
      <g fill={G}>
        <circle cx="8" cy="13" r="1.1" />
        <circle cx="12" cy="13" r="1.1" />
        <circle cx="16" cy="13" r="1.1" />
        <circle cx="8" cy="16.6" r="1.1" />
        <circle cx="12" cy="16.6" r="1.1" />
      </g>
    </>
  ),
  therapist: (
    <g fill={G}>
      <circle cx="12" cy="7" r="3.3" />
      <path d="M5.4 20.5c0-3.6 2.95-6.4 6.6-6.4s6.6 2.8 6.6 6.4z" />
    </g>
  ),
  yen: (
    <>
      <circle cx="12" cy="12" r="9" fill="none" stroke={G} strokeWidth="1.6" />
      <path
        d="M12 8.2l-2.6-4M12 8.2l2.6-4M9.2 9.6h5.6M9.2 12h5.6M12 8.2V17"
        fill="none"
        stroke={G}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  building: (
    <>
      <rect x="6" y="3.4" width="12" height="17.2" rx="1.2" fill="none" stroke={G} strokeWidth="1.5" />
      <g fill={G}>
        <rect x="8.4" y="6" width="2.2" height="2.2" rx="0.3" />
        <rect x="13.4" y="6" width="2.2" height="2.2" rx="0.3" />
        <rect x="8.4" y="10" width="2.2" height="2.2" rx="0.3" />
        <rect x="13.4" y="10" width="2.2" height="2.2" rx="0.3" />
        <rect x="10.7" y="15.5" width="2.6" height="5.1" rx="0.3" />
      </g>
    </>
  ),
  globe: (
    <g fill="none" stroke={G} strokeWidth="1.5">
      <circle cx="12" cy="12" r="8.6" />
      <ellipse cx="12" cy="12" rx="3.9" ry="8.6" />
      <path d="M3.5 12h17M5 7.2h14M5 16.8h14" />
    </g>
  ),
  group: (
    <g fill={G}>
      <circle cx="8" cy="9" r="2.5" />
      <circle cx="16" cy="9" r="2.5" />
      <path d="M2.8 18.4c0-2.7 2.1-4.7 4.7-4.7 1.2 0 2.3.4 3.1 1.2-.9 1-1.4 2.2-1.4 3.5z" />
      <path d="M11.4 18.4c0-2.7 2.1-4.7 4.7-4.7s4.7 2 4.7 4.7z" />
    </g>
  ),
  envelope: (
    <g fill="none" stroke={G} strokeWidth="1.6" strokeLinejoin="round">
      <rect x="3" y="5.8" width="18" height="12.4" rx="1.6" />
      <path d="M3.6 7l8.4 6 8.4-6" />
    </g>
  ),
};

export default function NavIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
      {ICONS[name] || null}
    </svg>
  );
}
