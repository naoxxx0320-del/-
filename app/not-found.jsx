// 存在しないURL用の404ページ（GitHub Pages は 404.html を HTTP 404 で返す）。
// 検索には出さず（noindex）、主要ページへの導線だけを置く。
export const metadata = {
  title: { absolute: "ページが見つかりません｜AROMA DIAMOND 亀戸" },
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="stage">
      <div className="device" style={{ background: "#f4efe7 url(/bg-marble.jpg) top center / 100% auto repeat" }}>
        <div className="page-head">
          <div className="ph-en">404</div>
          <h1 className="ph-jp ph-long">ページが見つかりません</h1>
        </div>
        <section className="terms-sec">
          <p className="terms-p">
            お探しのページは移動または削除された可能性があります。お手数ですが、以下のページからお探しください。
          </p>
          <nav className="home-intro-links" aria-label="主要ページ">
            <a href="/">トップページ</a>
            <a href="/system/">料金・コース</a>
            <a href="/therapist/">セラピスト紹介</a>
            <a href="/reserve/">WEB予約</a>
          </nav>
        </section>
      </div>
    </div>
  );
}
