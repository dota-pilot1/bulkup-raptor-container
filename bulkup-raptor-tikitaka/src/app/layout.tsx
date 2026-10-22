import type { Metadata } from "next";
import "./styles.css";
import "./playbook.css";

export const metadata: Metadata = {
  title: "Bulkup Raptor",
  description: "엔터프라이즈 쇼핑몰 설계와 구현을 기록하는 프로젝트 노트",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
