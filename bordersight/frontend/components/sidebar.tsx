"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";

const items=[['/','Overview'],['/operate','Surveillance']];

export default function Sidebar(){
  const path=usePathname();
  return <aside className="sidebar">
    <div className="brand">
      <div className="brand-mark">B</div>
      <div><strong>BorderSight</strong><span>AI COMMAND CENTER</span></div>
    </div>
    <nav className="nav">
      {items.map(([href,label])=><Link key={href} className={path===href?'active':''} href={href}>{label}</Link>)}
    </nav>
    <div className="sidebar-footer">SIH 2026 · PS 187<br/>Surveillance prototype</div>
  </aside>
}
