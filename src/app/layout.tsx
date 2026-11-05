import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Code Caper — Crack the code",
  description: "A pass-and-play code-breaking game for two sharp minds.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
