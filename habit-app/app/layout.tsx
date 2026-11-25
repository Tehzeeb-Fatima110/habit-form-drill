import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Systema — AI Habit Coach & System Builder",
  description:
    "Build sustainable habit systems across Health, Finance, and Academics with AI skip analysis and adaptive plan updates.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
