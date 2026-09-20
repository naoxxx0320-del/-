/* 全ページ共通のアイコンナビ（8ボタン）。トップと同じ見た目。
   `base` はサイトルートへの相対プレフィックス：
     ""     … トップページ（例: "schedule/"）
     "../"  … 1階層下のページ（例: "../schedule/"）
     "../../"… 2階層下（therapist/[id] 等）
   リンクの解決方法は SiteChrome と揃えている。 */
import NavIcon, { NavGoldDef } from "./NavIcon";

const NAV = [
  { jp: "トップ", en: "Top", slug: "", icon: "crown" },
  { jp: "出勤情報", en: "Schedule", slug: "schedule", icon: "calendar" },
  { jp: "セラピスト", en: "Therapist", slug: "therapist", icon: "therapist" },
  { jp: "料金システム", en: "System", slug: "system", icon: "yen" },
  { jp: "アクセス", en: "Access", slug: "access", icon: "building" },
  { jp: "外国人の方へ", en: "Foreigner", slug: "foreigners", icon: "globe" },
  { jp: "スタッフ求人", en: "Careers", slug: null, icon: "group" },
  { jp: "セラピスト求人", en: "Recruit", slug: null, icon: "envelope" },
];

export default function NavGrid({ base = "" }) {
  const home = base === "" ? "./" : base;
  const href = (slug) =>
    slug === null ? "#" : slug === "" ? home : `${base}${slug}/`;

  return (
    <nav className="navgrid">
      <NavGoldDef />
      {NAV.map((n, i) => (
        <a className="nav-btn" href={href(n.slug)} key={i}>
          <span className="nav-ic">
            <NavIcon name={n.icon} />
          </span>
          <span className="jp">{n.jp}</span>
          <span className="nav-en">
            <span className="en">{n.en}</span>
            <span className="nav-chev" aria-hidden="true">
              ›
            </span>
          </span>
        </a>
      ))}
    </nav>
  );
}
