from fastapi import FastAPI, APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Header, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import json
import random
import string
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Set
import uuid
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# ---------------------- Helpers ----------------------

def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def date_key(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%d")


def new_code(length: int = 6) -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))


DEFAULT_SUBJECT_COLORS = ["#FF5B22", "#C96442", "#E4A951", "#7EA172", "#5D9EA1", "#B084CC"]


# ---------------------- Models ----------------------

class LoginIn(BaseModel):
    username: str


class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    username: str
    created_at: str


class SubjectIn(BaseModel):
    name: str
    color: Optional[str] = None


class Subject(BaseModel):
    id: str
    user_id: str
    name: str
    color: str


class TaskIn(BaseModel):
    title: str
    subject_id: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    done: Optional[bool] = None
    subject_id: Optional[str] = None


class Task(BaseModel):
    id: str
    user_id: str
    title: str
    subject_id: Optional[str] = None
    done: bool = False
    created_at: str


class TimerStartIn(BaseModel):
    subject_id: str
    mode: Optional[str] = "lecture"
    group_id: Optional[str] = None


class TaskReorderIn(BaseModel):
    ordered_ids: List[str]


class StudyLog(BaseModel):
    id: str
    user_id: str
    subject_id: str
    subject_name: str
    subject_color: str
    start_time: str
    end_time: str
    duration_seconds: int
    date_key: str


class GroupIn(BaseModel):
    name: str
    is_public: bool = True


class JoinIn(BaseModel):
    code: str


class Group(BaseModel):
    id: str
    name: str
    code: str
    is_public: bool
    owner_id: str
    created_at: str
    member_count: int = 0


# ---------------------- Auth helper ----------------------

async def get_user(x_user_id: Optional[str] = Header(default=None)) -> dict:
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-Id header")
    user = await db.users.find_one({"id": x_user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid user")
    return user


# ---------------------- WebSocket manager ----------------------

class RoomManager:
    def __init__(self):
        self.rooms: Dict[str, Set[WebSocket]] = {}

    async def connect(self, group_id: str, ws: WebSocket):
        await ws.accept()
        self.rooms.setdefault(group_id, set()).add(ws)

    def disconnect(self, group_id: str, ws: WebSocket):
        if group_id in self.rooms:
            self.rooms[group_id].discard(ws)
            if not self.rooms[group_id]:
                del self.rooms[group_id]

    async def broadcast(self, group_id: str, payload: dict):
        if group_id not in self.rooms:
            return
        stale = []
        for ws in list(self.rooms[group_id]):
            try:
                await ws.send_json(payload)
            except Exception:
                stale.append(ws)
        for ws in stale:
            self.rooms[group_id].discard(ws)


manager = RoomManager()


async def broadcast_group_update(group_id: str):
    """Send fresh member state to all sockets in the room."""
    members = await get_group_members_state(group_id)
    await manager.broadcast(group_id, {"type": "members", "members": members})


async def get_group_members_state(group_id: str) -> List[dict]:
    grp = await db.groups.find_one({"id": group_id}, {"_id": 0})
    if not grp:
        return []
    users = await db.users.find({"id": {"$in": grp.get("members", [])}}, {"_id": 0}).to_list(500)
    sessions = await db.active_sessions.find({"user_id": {"$in": grp.get("members", [])}}, {"_id": 0}).to_list(500)
    session_map = {s["user_id"]: s for s in sessions}
    out = []
    for u in users:
        s = session_map.get(u["id"])
        out.append({
            "user_id": u["id"],
            "username": u["username"],
            "is_studying": bool(s),
            "subject_name": s.get("subject_name") if s else None,
            "subject_color": s.get("subject_color") if s else None,
            "mode": s.get("mode") if s else None,
            "start_time": s.get("start_time") if s else None,
        })
    out.sort(key=lambda x: (not x["is_studying"], x["username"].lower()))
    return out


# ---------------------- Auth ----------------------

@api_router.post("/auth/login")
async def login(payload: LoginIn):
    username = payload.username.strip()
    if not username or len(username) > 30:
        raise HTTPException(status_code=400, detail="Username must be 1-30 characters")
    existing = await db.users.find_one({"username_lower": username.lower()}, {"_id": 0})
    if existing:
        return {"id": existing["id"], "username": existing["username"], "created_at": existing["created_at"]}
    doc = {
        "id": str(uuid.uuid4()),
        "username": username,
        "username_lower": username.lower(),
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(doc)
    # Seed a default subject
    subj = {
        "id": str(uuid.uuid4()),
        "user_id": doc["id"],
        "name": "General",
        "color": DEFAULT_SUBJECT_COLORS[0],
    }
    await db.subjects.insert_one(subj)
    return {"id": doc["id"], "username": doc["username"], "created_at": doc["created_at"]}


# ---------------------- Subjects ----------------------

@api_router.get("/subjects")
async def list_subjects(user=None, x_user_id: Optional[str] = Header(default=None)):
    user = await get_user(x_user_id)
    items = await db.subjects.find({"user_id": user["id"]}, {"_id": 0}).to_list(200)
    return items


@api_router.post("/subjects")
async def create_subject(payload: SubjectIn, x_user_id: Optional[str] = Header(default=None)):
    user = await get_user(x_user_id)
    count = await db.subjects.count_documents({"user_id": user["id"]})
    color = payload.color or DEFAULT_SUBJECT_COLORS[count % len(DEFAULT_SUBJECT_COLORS)]
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": payload.name.strip(),
        "color": color,
    }
    await db.subjects.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api_router.delete("/subjects/{subject_id}")
async def delete_subject(subject_id: str, x_user_id: Optional[str] = Header(default=None)):
    user = await get_user(x_user_id)
    await db.subjects.delete_one({"id": subject_id, "user_id": user["id"]})
    return {"ok": True}


# ---------------------- Tasks ----------------------

@api_router.get("/tasks")
async def list_tasks(x_user_id: Optional[str] = Header(default=None)):
    user = await get_user(x_user_id)
    items = await db.tasks.find({"user_id": user["id"]}, {"_id": 0}).sort([("order", 1), ("created_at", -1)]).to_list(500)
    return items


@api_router.post("/tasks")
async def create_task(payload: TaskIn, x_user_id: Optional[str] = Header(default=None)):
    user = await get_user(x_user_id)
    top = await db.tasks.find_one({"user_id": user["id"]}, {"_id": 0}, sort=[("order", 1)])
    top_order = top.get("order", 0) if top else 0
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "title": payload.title.strip(),
        "subject_id": payload.subject_id,
        "done": False,
        "order": top_order - 1,
        "created_at": iso(now_utc()),
    }
    await db.tasks.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api_router.post("/tasks/reorder")
async def reorder_tasks(payload: TaskReorderIn, x_user_id: Optional[str] = Header(default=None)):
    user = await get_user(x_user_id)
    for idx, tid in enumerate(payload.ordered_ids):
        await db.tasks.update_one({"id": tid, "user_id": user["id"]}, {"$set": {"order": idx}})
    return {"ok": True}


@api_router.patch("/tasks/{task_id}")
async def update_task(task_id: str, payload: TaskUpdate, x_user_id: Optional[str] = Header(default=None)):
    user = await get_user(x_user_id)
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if not updates:
        return {"ok": True}
    await db.tasks.update_one({"id": task_id, "user_id": user["id"]}, {"$set": updates})
    doc = await db.tasks.find_one({"id": task_id, "user_id": user["id"]}, {"_id": 0})
    return doc


@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, x_user_id: Optional[str] = Header(default=None)):
    user = await get_user(x_user_id)
    await db.tasks.delete_one({"id": task_id, "user_id": user["id"]})
    return {"ok": True}


# ---------------------- Timer ----------------------

@api_router.get("/timer/current")
async def current_timer(x_user_id: Optional[str] = Header(default=None)):
    user = await get_user(x_user_id)
    s = await db.active_sessions.find_one({"user_id": user["id"]}, {"_id": 0})
    return s or None


@api_router.post("/timer/start")
async def start_timer(payload: TimerStartIn, x_user_id: Optional[str] = Header(default=None)):
    user = await get_user(x_user_id)
    subject = await db.subjects.find_one({"id": payload.subject_id, "user_id": user["id"]}, {"_id": 0})
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    # If existing session, stop it first
    existing = await db.active_sessions.find_one({"user_id": user["id"]}, {"_id": 0})
    if existing:
        await _stop_and_log(user, existing)
    mode = (payload.mode or "lecture").lower()
    if mode not in ("lecture", "practice", "revision"):
        mode = "lecture"
    session = {
        "user_id": user["id"],
        "subject_id": subject["id"],
        "subject_name": subject["name"],
        "subject_color": subject["color"],
        "mode": mode,
        "start_time": iso(now_utc()),
        "group_id": payload.group_id,
    }
    await db.active_sessions.insert_one(session)
    # broadcast to any group the user is in
    groups = await db.groups.find({"members": user["id"]}, {"_id": 0, "id": 1}).to_list(50)
    for g in groups:
        await broadcast_group_update(g["id"])
    return {k: v for k, v in session.items() if k != "_id"}


async def _stop_and_log(user: dict, session: dict) -> Optional[dict]:
    start_dt = datetime.fromisoformat(session["start_time"])
    end_dt = now_utc()
    duration = int((end_dt - start_dt).total_seconds())
    await db.active_sessions.delete_one({"user_id": user["id"]})
    if duration <= 0:
        return None
    log = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "subject_id": session["subject_id"],
        "subject_name": session["subject_name"],
        "subject_color": session["subject_color"],
        "mode": session.get("mode", "lecture"),
        "start_time": session["start_time"],
        "end_time": iso(end_dt),
        "duration_seconds": duration,
        "date_key": date_key(start_dt),
    }
    await db.study_logs.insert_one(log)
    return {k: v for k, v in log.items() if k != "_id"}


@api_router.post("/timer/stop")
async def stop_timer(x_user_id: Optional[str] = Header(default=None)):
    user = await get_user(x_user_id)
    session = await db.active_sessions.find_one({"user_id": user["id"]}, {"_id": 0})
    if not session:
        return None
    log = await _stop_and_log(user, session)
    groups = await db.groups.find({"members": user["id"]}, {"_id": 0, "id": 1}).to_list(50)
    for g in groups:
        await broadcast_group_update(g["id"])
    return log


# ---------------------- Logs ----------------------

@api_router.get("/logs")
async def get_logs(
    range: str = Query("day"),
    date: Optional[str] = Query(None),
    x_user_id: Optional[str] = Header(default=None),
):
    user = await get_user(x_user_id)
    ref = datetime.fromisoformat(date) if date else now_utc()
    ref = ref.astimezone(timezone.utc) if ref.tzinfo else ref.replace(tzinfo=timezone.utc)
    if range == "day":
        start = ref.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=1)
    elif range == "week":
        start = ref.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=ref.weekday())
        end = start + timedelta(days=7)
    elif range == "month":
        start = ref.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        next_month = (start + timedelta(days=32)).replace(day=1)
        end = next_month
    else:
        raise HTTPException(status_code=400, detail="Invalid range")

    start_key = date_key(start)
    end_key = date_key(end - timedelta(seconds=1))
    logs = await db.study_logs.find(
        {"user_id": user["id"], "date_key": {"$gte": start_key, "$lte": end_key}},
        {"_id": 0}
    ).sort("start_time", -1).to_list(2000)

    # aggregate by subject
    by_subject: Dict[str, dict] = {}
    total = 0
    for entry in logs:
        total += entry["duration_seconds"]
        key = entry["subject_id"]
        if key not in by_subject:
            by_subject[key] = {"subject_id": key, "subject_name": entry["subject_name"], "subject_color": entry["subject_color"], "duration_seconds": 0}
        by_subject[key]["duration_seconds"] += entry["duration_seconds"]

    # per-day totals
    by_day: Dict[str, int] = {}
    for entry in logs:
        by_day[entry["date_key"]] = by_day.get(entry["date_key"], 0) + entry["duration_seconds"]

    # by mode
    by_mode: Dict[str, int] = {}
    for entry in logs:
        m = entry.get("mode", "lecture")
        by_mode[m] = by_mode.get(m, 0) + entry["duration_seconds"]

    return {
        "range": range,
        "start": iso(start),
        "end": iso(end),
        "total_seconds": total,
        "by_subject": list(by_subject.values()),
        "by_day": by_day,
        "by_mode": by_mode,
        "logs": logs,
    }


# ---------------------- Groups ----------------------

@api_router.post("/groups")
async def create_group(payload: GroupIn, x_user_id: Optional[str] = Header(default=None)):
    user = await get_user(x_user_id)
    code = new_code()
    while await db.groups.find_one({"code": code}):
        code = new_code()
    doc = {
        "id": str(uuid.uuid4()),
        "name": payload.name.strip()[:40],
        "code": code,
        "is_public": payload.is_public,
        "owner_id": user["id"],
        "created_at": iso(now_utc()),
        "members": [user["id"]],
    }
    await db.groups.insert_one(doc)
    return _serialize_group(doc)


def _serialize_group(g: dict) -> dict:
    return {
        "id": g["id"],
        "name": g["name"],
        "code": g["code"],
        "is_public": g["is_public"],
        "owner_id": g["owner_id"],
        "created_at": g["created_at"],
        "member_count": len(g.get("members", [])),
    }


@api_router.get("/groups/public")
async def list_public_groups():
    items = await db.groups.find({"is_public": True}, {"_id": 0}).to_list(200)
    return [_serialize_group(g) for g in items]


@api_router.get("/groups/mine")
async def list_my_groups(x_user_id: Optional[str] = Header(default=None)):
    user = await get_user(x_user_id)
    items = await db.groups.find({"members": user["id"]}, {"_id": 0}).to_list(200)
    return [_serialize_group(g) for g in items]


@api_router.post("/groups/join")
async def join_group(payload: JoinIn, x_user_id: Optional[str] = Header(default=None)):
    user = await get_user(x_user_id)
    code = payload.code.strip().upper()
    grp = await db.groups.find_one({"code": code}, {"_id": 0})
    if not grp:
        raise HTTPException(status_code=404, detail="Group not found")
    if user["id"] not in grp.get("members", []):
        await db.groups.update_one({"id": grp["id"]}, {"$addToSet": {"members": user["id"]}})
    grp = await db.groups.find_one({"id": grp["id"]}, {"_id": 0})
    await broadcast_group_update(grp["id"])
    return _serialize_group(grp)


@api_router.post("/groups/{group_id}/join")
async def join_group_by_id(group_id: str, x_user_id: Optional[str] = Header(default=None)):
    user = await get_user(x_user_id)
    grp = await db.groups.find_one({"id": group_id}, {"_id": 0})
    if not grp:
        raise HTTPException(status_code=404, detail="Group not found")
    if not grp["is_public"] and user["id"] not in grp.get("members", []):
        raise HTTPException(status_code=403, detail="Group is private")
    if user["id"] not in grp.get("members", []):
        await db.groups.update_one({"id": group_id}, {"$addToSet": {"members": user["id"]}})
    grp = await db.groups.find_one({"id": group_id}, {"_id": 0})
    await broadcast_group_update(group_id)
    return _serialize_group(grp)


@api_router.post("/groups/{group_id}/leave")
async def leave_group(group_id: str, x_user_id: Optional[str] = Header(default=None)):
    user = await get_user(x_user_id)
    await db.groups.update_one({"id": group_id}, {"$pull": {"members": user["id"]}})
    await broadcast_group_update(group_id)
    return {"ok": True}


@api_router.get("/groups/{group_id}")
async def get_group(group_id: str, x_user_id: Optional[str] = Header(default=None)):
    user = await get_user(x_user_id)
    grp = await db.groups.find_one({"id": group_id}, {"_id": 0})
    if not grp:
        raise HTTPException(status_code=404, detail="Group not found")
    if not grp["is_public"] and user["id"] not in grp.get("members", []):
        raise HTTPException(status_code=403, detail="Not a member")
    members = await get_group_members_state(group_id)
    return {**_serialize_group(grp), "members": members}


# ---------------------- WebSocket ----------------------

@api_router.websocket("/ws/group/{group_id}")
async def ws_group(websocket: WebSocket, group_id: str, user_id: str = Query(...)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        await websocket.close(code=4401)
        return
    grp = await db.groups.find_one({"id": group_id}, {"_id": 0})
    if not grp:
        await websocket.close(code=4404)
        return
    await manager.connect(group_id, websocket)
    try:
        # send initial state
        members = await get_group_members_state(group_id)
        await websocket.send_json({"type": "members", "members": members})
        while True:
            msg = await websocket.receive_text()
            # ignore incoming; used only as heartbeat
            _ = msg
    except WebSocketDisconnect:
        manager.disconnect(group_id, websocket)
    except Exception as e:
        logger.warning(f"ws error: {e}")
        manager.disconnect(group_id, websocket)


# ---------------------- Root ----------------------

@api_router.get("/")
async def root():
    return {"ok": True, "service": "study-app"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
