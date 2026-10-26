import type { Metadata } from "next";

import "./globals.css";


export const metadata: Metadata = {
  title: "AI 私人廚師",
  description: "從現有食材出發的聊天食譜助手",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
