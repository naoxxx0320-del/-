/* 会員制度ページのアイコン（線のみ・色は呼び出し側）。 */
export function DiamondIcon({ size = 40, color = "currentColor", sw = 1.3 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M4 9 L8 4 H16 L20 9 L12 20.5 Z" fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M4 9 H20 M8 4 L10 9 L12 20.5 M16 4 L14 9 L12 20.5 M10 9 L12 4 L14 9" fill="none" stroke={color} strokeWidth={sw * 0.75} strokeLinejoin="round" />
    </svg>
  );
}
export function CrownIcon({ size = 32, color = "currentColor" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M3.5 8 L8 12 L12 5 L16 12 L20.5 8 L19 17.5 H5 Z" fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M5 20 H19" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
export function RibbonIcon({ size = 30, color = "currentColor" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="8.5" r="5" fill="none" stroke={color} strokeWidth="1.5" />
      <path d="M8.8 12.5 L7.5 21 L12 18.5 L16.5 21 L15.2 12.5" fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
export function MedalIcon({ size = 30, color = "currentColor" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M7 3 L10.5 10 M17 3 L13.5 10 M9.5 3 L12 8 L14.5 3" fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="12" cy="15" r="5.5" fill="none" stroke={color} strokeWidth="1.5" />
      <path d="M12 12.3 L12.9 14.2 L15 14.4 L13.4 15.8 L13.9 17.8 L12 16.8 L10.1 17.8 L10.6 15.8 L9 14.4 L11.1 14.2 Z" fill={color} />
    </svg>
  );
}
export function ArrowDown({ size = 18, color = "currentColor" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 4 V19 M6.5 13.5 L12 19 L17.5 13.5" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function Glyph({ name, size = 26, color = "currentColor" }) {
  const p = { fill: "none", stroke: color, strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    clock: <><circle cx="12" cy="12" r="8.5" {...p} /><path d="M12 7.5 V12 L15 14" {...p} /></>,
    camera: <><path d="M4 8 H8 L9.5 5.5 H14.5 L16 8 H20 V18.5 H4 Z" {...p} /><circle cx="12" cy="13" r="3.4" {...p} /></>,
    bell: <><path d="M6.5 16.5 V11 A5.5 5.5 0 0 1 17.5 11 V16.5 L19 18 H5 Z" {...p} /><path d="M10 20.5 H14" {...p} /></>,
    leaf: <><path d="M5 19 C5 10 10 5 19 5 C19 14 14 19 5 19 Z" {...p} /><path d="M5 19 L13 11" {...p} /></>,
    card: <><rect x="3.5" y="6" width="17" height="12" rx="2" {...p} /><path d="M3.5 10 H20.5 M7 14.5 H11" {...p} /></>,
  };
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">{paths[name]}</svg>
  );
}
