import CopyInstall from "../lottery-setup/CopyInstall";
import styles from "../lottery-setup/page.module.css";

export const metadata = {
  title: "最新の抽選コードを一括コピー",
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default function LotteryCodePage() {
  return <main className={styles.page}><div className={styles.card}>
    <p className={styles.brand}>AROMA DAIAMOND</p>
    <p className={styles.badge}>管理者向け・URL抽選の更新</p>
    <h1>最新コードを一括コピー</h1>
    <p className={styles.lead}>下のボタンを押すと、Apps Scriptに貼り付けるコード全文をコピーできます。</p>
    <CopyInstall copyLabel="最新コードを一括コピー" />
    <p className={styles.notice}>コピーできない場合は「コード全文を選択」を押して、スマホの「コピー」を選んでください。</p>
    <ol className={styles.steps}>
      <li><h2>抽選用のApps Scriptに貼り付ける</h2><p>抽選用スプレッドシートの「拡張機能 → Apps Script」を開き、現在の抽選コードを全文置き換えて保存します。</p></li>
      <li><h2>新しいバージョンを公開</h2><p>「デプロイ → デプロイを管理 → 鉛筆マーク」から「新バージョン」を選び、デプロイします。参加者に送るURLはそのまま使えます。</p></li>
    </ol>
    <p className={styles.notice}>既存の抽選台帳は削除せず、そのまま使ってください。</p>
    <a className={styles.back} href="../lottery-setup/">初めて公開する場合の手順を見る ↗</a>
  </div></main>;
}
