import styles from "./page.module.css";

export const metadata = {
  title: "抽選ゲーム体験版のダウンロード",
  description: "スマホ向け宝石抽選ゲーム体験版の単体HTMLファイル。",
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default function LotteryDownloadPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.brand}>AROMA DAIAMOND</p>
        <p className={styles.badge}>体験版 · 実際の応募・当選は発生しません</p>
        <h1>宝石の抽選ゲーム<br />スマホ版</h1>
        <p className={styles.lead}>宝石を選ぶと、その場で結果の演出を楽しめます。スタイルとゲームの処理をまとめた、単体のHTMLファイルです。</p>
        <a className={styles.primary} href="../lottery-mobile.html" download="aroma-lottery-mobile.html">スマホ版HTMLをダウンロード ↓</a>
        <p className={styles.size}>HTML形式 · 約16KB · 外部ライブラリの読み込み不要</p>
        <a className={styles.secondary} href="../lottery-mobile.html">ダウンロードせずブラウザーで遊ぶ ↗</a>
        <section className={styles.help}>
          <h2>保存するには</h2>
          <p>ダウンロード後、ブラウザーのダウンロード一覧からファイルを確認できます。端末によっては保存先を選ぶ画面が表示されます。</p>
          <p>スマホのファイルプレビューでゲームが動かない場合は、上の「ブラウザーで遊ぶ」からお楽しみください。</p>
        </section>
        <a className={styles.back} href="../">サイトトップへ戻る</a>
      </div>
    </main>
  );
}
