import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "../components/sidebar";
export const metadata: Metadata={title:"BorderSight AI — Command Center",description:"AI-powered border surveillance and situational awareness"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><div className="shell"><Sidebar/>{children}</div></body></html>}
