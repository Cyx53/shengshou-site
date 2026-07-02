import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "圣兽祇园",
  description: "文以载道、谦爱集、心路、观道观与圣兽祇园",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
