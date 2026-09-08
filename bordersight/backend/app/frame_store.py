"""Small bounded in-memory frame store used by the surveillance demo."""
from collections import deque
from threading import Lock

MAX_FRAMES = 24
_store: dict[str, deque[dict]] = {}
_locks: dict[str, Lock] = {}

def _lock(job_id: str) -> Lock:
    return _locks.setdefault(job_id, Lock())

def reset(job_id: str) -> None:
    with _lock(job_id):
        _store[job_id] = deque(maxlen=MAX_FRAMES)

def append(job_id: str, sequence: int, jpeg: bytes) -> None:
    with _lock(job_id):
        _store.setdefault(job_id, deque(maxlen=MAX_FRAMES)).append({"sequence": sequence, "jpeg": jpeg})

def after(job_id: str, sequence: int) -> list[dict]:
    with _lock(job_id):
        return [frame for frame in _store.get(job_id, ()) if frame["sequence"] > sequence]
