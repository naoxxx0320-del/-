/* Relaxi（メンズエステ専用SNS）の公式タイムライン埋め込み（トップページ・リンク集で共用）。
   埋め込みは Relaxi 指定のコード（幅550・高さ800、スマホでは画面幅に合わせて縮む）。 */
const SRC = "https://rx-sns.jp/embed/timeline/aromadiamond?resize=fixed&limit=10";

export default function RelaxiTimeline({ heading = true }) {
  return (
    <section className="relaxi-tl" aria-labelledby="relaxi-tl-h">
      {heading && (
        <div className="section-head">
          <div className="sh-en">Relaxi</div>
          <h2 className="sh-jp" id="relaxi-tl-h">
            最新情報
          </h2>
        </div>
      )}
      <div className="relaxi-tl-frame">
        <iframe
          src={SRC}
          width="550"
          height="800"
          title="@aromadiamond の Relaxi タイムライン"
          loading="lazy"
          style={{ border: "none", borderRadius: 12, maxWidth: "100%" }}
        />
      </div>
    </section>
  );
}
