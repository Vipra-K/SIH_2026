from datetime import datetime, timezone
from enum import Enum
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.stream_api import router as stream_router
from app.video_api import router as video_router
from app.camera_api import router as camera_source_router

app = FastAPI(title="BorderSight AI API", version="0.2.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(stream_router)
app.include_router(video_router)
app.include_router(camera_source_router)

class Severity(str, Enum):
    low="LOW"; medium="MEDIUM"; high="HIGH"; critical="CRITICAL"
class IncidentStatus(str, Enum):
    unresolved="UNRESOLVED"; acknowledged="ACKNOWLEDGED"; resolved="RESOLVED"
class Camera(BaseModel):
    id:str; name:str; sector:str; source_type:Literal["video","local","rtsp"]; status:Literal["ONLINE","OFFLINE"]="ONLINE"
class Incident(BaseModel):
    id:str; type:str; camera_id:str; sector:str; timestamp:str; object_type:str; track_id:str
    confidence:float=Field(ge=0,le=1); risk_score:int=Field(ge=0,le=100); severity:Severity; status:IncidentStatus; reason:list[str]

cameras=[Camera(id="CAM-01",name="North Gate",sector="Sector A",source_type="video"),Camera(id="CAM-02",name="Buffer Zone",sector="Sector A",source_type="local"),Camera(id="CAM-03",name="Patrol Corridor",sector="Sector B",source_type="video"),Camera(id="CAM-04",name="South Checkpoint",sector="Sector C",source_type="video")]
incidents=[Incident(id="INC-1042",type="BORDER_INTRUSION",camera_id="CAM-01",sector="Sector A",timestamp="2026-09-08T16:41:08+05:30",object_type="PERSON",track_id="P-021",confidence=.96,risk_score=92,severity=Severity.critical,status=IncidentStatus.unresolved,reason=["Restricted-zone crossing","Movement toward border","Low-light period"]),Incident(id="INC-1041",type="LOITERING",camera_id="CAM-03",sector="Sector B",timestamp="2026-09-08T16:32:44+05:30",object_type="PERSON",track_id="P-018",confidence=.91,risk_score=68,severity=Severity.medium,status=IncidentStatus.acknowledged,reason=["Extended dwell time","Sensitive observation zone"])]

@app.get("/api/health")
def health(): return {"status":"ok","service":"bordersight-api"}
@app.get("/api/dashboard")
def dashboard():
    active=[i for i in incidents if i.status!=IncidentStatus.resolved]
    return {"cameras":{"total":len(cameras),"online":sum(c.status=="ONLINE" for c in cameras)},"incidents":{"active":len(active),"critical":sum(i.severity==Severity.critical for i in active)},"events_today":147,"sectors":[{"name":"Sector A","status":"CRITICAL","incidents":5},{"name":"Sector B","status":"ELEVATED","incidents":3},{"name":"Sector C","status":"NORMAL","incidents":1}]}
@app.get("/api/cameras",response_model=list[Camera])
def list_cameras(): return cameras
@app.get("/api/incidents",response_model=list[Incident])
def list_incidents(status:IncidentStatus|None=None): return incidents if status is None else [i for i in incidents if i.status==status]
@app.get("/api/incidents/{incident_id}",response_model=Incident)
def get_incident(incident_id:str):
    for i in incidents:
        if i.id==incident_id:return i
    raise HTTPException(404,"Incident not found")
class StatusUpdate(BaseModel): status:IncidentStatus
@app.patch("/api/incidents/{incident_id}/status",response_model=Incident)
def update_incident_status(incident_id:str,body:StatusUpdate):
    for n,i in enumerate(incidents):
        if i.id==incident_id: incidents[n]=i.model_copy(update={"status":body.status}); return incidents[n]
    raise HTTPException(404,"Incident not found")
class EventInput(BaseModel):
    camera_id:str; object_type:str="PERSON"; track_id:str; confidence:float=Field(ge=0,le=1); crossed_restricted_boundary:bool=False; loiter_seconds:int=Field(default=0,ge=0); toward_border:bool=False; low_light:bool=False
@app.post("/api/events",response_model=Incident|None)
def ingest_event(event:EventInput):
    camera=next((c for c in cameras if c.id==event.camera_id),None)
    if camera is None: raise HTTPException(404,"Camera not found")
    score=0; reasons=[]; kind="ANOMALY"
    if event.crossed_restricted_boundary: score+=50; reasons.append("Restricted-zone crossing"); kind="BORDER_INTRUSION"
    if event.loiter_seconds>=60: score+=20; reasons.append("Extended dwell time"); kind="LOITERING"
    if event.toward_border: score+=20; reasons.append("Movement toward border")
    if event.low_light: score+=10; reasons.append("Low-light period")
    if score<30:return None
    severity=Severity.critical if score>=80 else Severity.high if score>=60 else Severity.medium
    i=Incident(id=f"INC-{1000+len(incidents)+1}",type=kind,camera_id=camera.id,sector=camera.sector,timestamp=datetime.now(timezone.utc).isoformat(),object_type=event.object_type,track_id=event.track_id,confidence=event.confidence,risk_score=min(score,100),severity=severity,status=IncidentStatus.unresolved,reason=reasons)
    incidents.insert(0,i); return i
