import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BorderSight AI — Command Center",
  description: "AI-powered border surveillance and situational awareness",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
