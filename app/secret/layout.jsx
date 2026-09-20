// /secret（パスワード付き裏メニュー）は検索対象外にする。
export const metadata = {
  title: "SECRET SPACE",
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default function SecretLayout({ children }) {
  return children;
}
