import type { Metadata } from "next";
import { Sora, Space_Grotesk } from "next/font/google";

import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "HR Resume Ranking Engine",
  description: "Upload up to 100 resumes and rank candidates by hiring criteria.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sora.variable} ${spaceGrotesk.variable}`}>
      <body>{children}</body>
    </html>
  );
}
