"use client";

import { useEffect, useState } from "react";

type Dashboard = { cameras:{total:number;online:number}; incidents:{active:number;critical:number}; events_today:number; sectors:{name:string;status:string;incidents:number}[] };
type Incident = {id:string;type:string;camera_id:string;sector:string;timestamp:string;object_type:string;track_id:string;confidence:number;risk_score:number;severity:string;status:string;reason:string[]};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function Home(){
  const [dashboard,setDashboard]=useState<Dashboard|null>(null);
  const [incidents,setIncidents]=useState<Incident[]>([]);
  const [selected,setSelected]=useState<Incident|null>(null);
  const [apiOnline,setApiOnline]=useState(false);

  useEffect(()=>{
    const load=async()=>{
      try{
        const [d,i]=await Promise.all([fetch(`${API}/api/dashboard`),fetch(`${API}/api/incidents`)]);
        if(!d.ok||!i.ok) throw new Error();
        setDashboard(await d.json()); setIncidents(await i.json()); setApiOnline(true);
      }catch{setApiOnline(false)}
    };
    load(); const timer=setInterval(load,5000); return()=>clearInterval(timer);
  },[]);

  const acknowledge=async()=>{
    if(!selected) return;
    await fetch(`${API}/api/incidents/${selected.id}/status`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"ACKNOWLEDGED"})});
    setSelected({...selected,status:"ACKNOWLEDGED"});
    setIncidents(xs=>xs.map(x=>x.id===selected.id?{...x,status:"ACKNOWLEDGED"}:x));
  };

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">B</div><div><strong>BorderSight</strong><span>AI COMMAND CENTER</span></div></div>
      <nav className="nav"><a className="active" href="#">Overview</a><a href="#cameras">Cameras</a><a href="#incidents">Incidents</a><a href="#sectors">Sectors</a><a href="#analytics">Analytics</a></nav>
      <div className="sidebar-footer">SIH 2026 · PS 187<br/>Operational prototype</div>
    </aside>

    <main className="main">
      <header className="topbar"><div><div className="eyebrow">Border surveillance / Operations</div><div className="title">Command Center</div><div className="subtitle">Real-time situational awareness across monitored sectors.</div></div><div className="status"><span className="dot"/>{apiOnline?"SYSTEM ONLINE":"DEMO MODE"}</div></header>

      <section className="stats">
        <div className="card"><div className="stat-label">CAMERAS</div><div className="stat-value">{dashboard?.cameras.total??24}</div><div className="stat-meta">{dashboard?.cameras.online??21} online</div></div>
        <div className="card"><div className="stat-label">ACTIVE INCIDENTS</div><div className="stat-value">{dashboard?.incidents.active??3}</div><div className="stat-meta">requires attention</div></div>
        <div className="card"><div className="stat-label">CRITICAL</div><div className="stat-value">{dashboard?.incidents.critical??2}</div><div className="stat-meta">priority alerts</div></div>
        <div className="card"><div className="stat-label">EVENTS TODAY</div><div className="stat-value">{dashboard?.events_today??147}</div><div className="stat-meta">AI observations</div></div>
      </section>

      <section className="grid">
        <div className="panel" id="cameras"><div className="panel-head"><div className="panel-title">Live surveillance</div><div className="panel-meta">4 selected feeds · 16:42 IST</div></div><div className="feeds">{["CAM-01 · NORTH GATE","CAM-02 · BUFFER ZONE","CAM-03 · PATROL CORRIDOR","CAM-04 · SOUTH CHECKPOINT"].map((name,n)=><div className="feed" key={name}><div className="feed-label">{name}</div><div className="feed-state">● LIVE</div>{n===0&&<><div className="person"/><div className="zone"/><div className="zone-label">RESTRICTED LINE</div></>}</div>)}</div></div>
        <div className="panel" id="incidents"><div className="panel-head"><div className="panel-title">Priority incidents</div><div className="panel-meta">{incidents.length} records</div></div><div className="incident-list">{incidents.map(i=><button key={i.id} onClick={()=>setSelected(i)} style={{background:"none",border:0,color:"inherit",width:"100%",textAlign:"left",cursor:"pointer"}}><div className="incident"><div className="incident-row"><div><div className="incident-name">{i.type.replaceAll("_"," ")}</div><div className="incident-time">{i.id} · {i.camera_id}</div></div><span className={`severity ${i.severity!=="CRITICAL"?"medium":""}`}>{i.severity}</span></div><div className="incident-detail">{i.reason.join(" · ")}</div><div className="bar"><span style={{width:`${i.risk_score}%`}}/></div></div></button>)}</div></div>
      </section>

      <section className="lower"><div className="panel" id="sectors"><div className="panel-head"><div className="panel-title">Sector status</div><div className="panel-meta">Risk overview</div></div>{(dashboard?.sectors??[{name:"Sector A",status:"CRITICAL",incidents:5},{name:"Sector B",status:"ELEVATED",incidents:3},{name:"Sector C",status:"NORMAL",incidents:1}]).map(s=><div className="sector" key={s.name}><div><div className="sector-name">{s.name}</div><small>{s.incidents} active events</small></div><div className={`sector-status ${s.status.toLowerCase()}`}>● {s.status}</div></div>)}</div>
      <div className="panel" id="analytics"><div className="panel-head"><div className="panel-title">Detection activity</div><div className="panel-meta">Last 6 hours</div></div><div style={{padding:"20px"}}><div className="stat-label">EVENT DISTRIBUTION</div>{[["Person detection",82],["Vehicle detection",61],["Zone crossing",34],["Loitering",21]].map(([label,value])=><div key={String(label)} style={{marginTop:15}}><div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#78909f"}}><span>{label}</span><span>{value}</span></div><div className="bar"><span style={{width:`${value}%`}}/></div></div>)}</div></div></section>
      <div className="footer-note">AI observations are decision-support signals. Verify incidents against original video before operational action.</div>
    </main>

    {selected&&<div onClick={()=>setSelected(null)} style={{position:"fixed",inset:0,background:"#0008",display:"grid",placeItems:"center",padding:20}}><div onClick={e=>e.stopPropagation()} className="card" style={{width:"min(520px,100%)",background:"#0b1923",borderColor:"#294150"}}><div className="eyebrow">Incident investigation</div><h2 style={{margin:"8px 0",fontSize:21}}>{selected.type.replaceAll("_"," ")}</h2><div style={{color:"#718896",fontSize:12}}>{selected.id} · {selected.camera_id} · {selected.sector}</div><div style={{marginTop:20,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{[["Risk score",`${selected.risk_score}/100`],["Severity",selected.severity],["Object",selected.object_type],["Track",selected.track_id],["Confidence",`${Math.round(selected.confidence*100)}%`],["Status",selected.status]].map(([a,b])=><div key={a} className="card" style={{padding:12}}><div className="stat-label">{a}</div><div style={{marginTop:5,fontSize:13,fontWeight:600}}>{b}</div></div>)}</div><div style={{marginTop:16,fontSize:11,color:"#8095a2"}}>Why flagged</div><ul style={{color:"#b8c6ce",fontSize:12,lineHeight:1.8,paddingLeft:18}}>{selected.reason.map(r=><li key={r}>{r}</li>)}</ul><div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}}><button onClick={()=>setSelected(null)} style={{padding:"9px 13px",background:"transparent",border:"1px solid #294150",color:"#9db0bc",borderRadius:7}}>Close</button>{selected.status==="UNRESOLVED"&&<button onClick={acknowledge} style={{padding:"9px 13px",background:"#173c4d",border:"1px solid #2c647c",color:"#d8f5ff",borderRadius:7}}>Acknowledge</button>}</div></div></div>}
  </div>
}
