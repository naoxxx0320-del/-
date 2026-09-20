import SiteChrome from "../../_components/SiteChrome";
import { SnsBadge } from "../../_components/TherapistCard";
import { photoSrc } from "../../_components/photo";
import roster from "../../../data/roster.json";
import TherapistGallery from "./TherapistGallery";
import { abs } from "../../_lib/site";
import Breadcrumbs from "../../_components/Breadcrumbs";

const BASE = "../../"; // /therapist/[id]/ はルートから2階層下

// 各セラピストを静的ページとして書き出す
export function generateStaticParams() {
  return roster.map((t, i) => ({ id: String(t.id ?? i + 1) }));
}

function pick(id) {
  return roster.find((t, i) => String(t.id ?? i + 1) === String(id));
}

export function generateMetadata({ params }) {
  const t = pick(params.id);
  const nm = (t && (t.nameFull || t.name)) || "セラピスト";
  const url = abs(`therapist/${params.id}/`);
  return {
    title: nm,
    description: `AROMA DAIAMOND（アロマ ダイアモンド）亀戸 セラピスト「${nm}」のプロフィール。`,
    alternates: { canonical: url },
    openGraph: { url, title: `${nm}｜AROMA DAIAMOND 亀戸` },
  };
}

// stats(["T.158","B.86(D)",...]) から値を取り出す
function stat(t, p) {
  return (t.stats || []).find((s) => s.startsWith(p + "."))?.slice(p.length + 1) || "";
}

// 「27歳　身長 165cm　B 87 (F)　W 57　H 85」形式のスペック行
function specParts(t) {
  const parts = [];
  if (t.age) parts.push(`${t.age}歳`);
  if (t.height) parts.push(`身長 ${t.height}cm`);
  const b = stat(t, "B").replace(/\(.*\)/, "").trim();
  if (b) parts.push(`B ${b}${t.cup ? ` (${t.cup})` : ""}`);
  const w = stat(t, "W");
  if (w) parts.push(`W ${w}`);
  const h = stat(t, "H");
  if (h) parts.push(`H ${h}`);
  return parts;
}

export default function TherapistDetail({ params }) {
  const t = pick(params.id);
  if (!t) return null;

  const photos = (t.photos && t.photos.length
    ? t.photos
    : t.photo
    ? [t.photo]
    : []
  ).map((p) => photoSrc(p, BASE));

  const parts = specParts(t);
  const sns = t.sns || [];
  const paragraphs = (t.profile || "")
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="stage">
      <div
        className="device"
        style={{
          background: "#f4efe7 url(../../bg-marble.jpg) top center / 100% auto repeat",
        }}
      >
        <Breadcrumbs
          items={[
            { name: "セラピスト", path: "therapist/" },
            { name: t.nameFull || t.name, path: `therapist/${params.id}/` },
          ]}
        />
        <div className="page-head">
          <div className="ph-en">Therapist</div>
          <div className="ph-jp">セラピスト紹介</div>
        </div>

        <section className="td-wrap">
          <TherapistGallery
            photos={photos}
            name={t.name}
            ribbon={t.ribbon || (t.absent ? null : "出勤")}
            heart={t.heart === "diamond" ? "dia" : "aj"}
            heartLabel={t.heartLabel || "◆"}
          />

          {/* 名前ヘッダー */}
          <h1 className="td-title">
            {t.nameFull || t.name}
            {t.isNew && <span className="td-new">NEW</span>}
          </h1>

          {/* スペック行 */}
          {parts.length > 0 && (
            <div className="td-spec">
              {parts.map((p, i) => (
                <span className="td-spec-item" key={i}>
                  {p}
                </span>
              ))}
            </div>
          )}

          {/* タグ */}
          {(t.tags || []).length > 0 && (
            <div className="td-tags">
              {t.tags.map((tag, j) => (
                <span className="tp-tag" key={j}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* SNS バッジ */}
          {sns.length > 0 && (
            <div className="sns inline">
              {sns.map((k) => (
                <SnsBadge kind={k} key={k} />
              ))}
            </div>
          )}

          {/* スケジュール／空き状況 */}
          {t.sched && (
            <div className="td-sched">
              <span className="clock">🕐</span>
              <span>{t.sched}</span>
              {t.status && (
                <span className={`td-status ${t.status === "満員" ? "full" : ""}`}>
                  {t.status}
                </span>
              )}
            </div>
          )}

          {/* お店コメント */}
          {paragraphs.length > 0 && (
            <div className="td-comment">
              <span className="tdc-corner tl" aria-hidden="true" />
              <span className="tdc-corner tr" aria-hidden="true" />
              <span className="tdc-corner bl" aria-hidden="true" />
              <span className="tdc-corner br" aria-hidden="true" />
              <div className="tdc-head">
                <span className="tdc-dia">◆</span>
                お店コメント
                <span className="tdc-dia">◆</span>
              </div>
              {paragraphs.map((p, i) => (
                <p className="tdc-p" key={i}>
                  {p.split("\n").map((line, k) => (
                    <span key={k}>
                      {line}
                      {k < p.split("\n").length - 1 && <br />}
                    </span>
                  ))}
                </p>
              ))}
            </div>
          )}

          <a className="td-back" href="../">
            ← セラピスト一覧へ戻る
          </a>
        </section>

        <SiteChrome base={BASE} />
      </div>
    </div>
  );
}
