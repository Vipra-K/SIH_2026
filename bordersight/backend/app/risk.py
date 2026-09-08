from __future__ import annotations

WEIGHTS = {"intrusion": 75, "loitering": 45, "vehicle": 20}


def score_event(event_type: str, confidence: float, zone: str = "restricted") -> int:
    base = WEIGHTS.get(event_type, 10)
    zone_bonus = 15 if zone == "restricted" else 5 if zone == "buffer" else 0
    return min(100, round(base * confidence + zone_bonus))


def severity(score: int) -> str:
    if score >= 80:
        return "critical"
    if score >= 60:
        return "high"
    if score >= 35:
        return "medium"
    return "low"
