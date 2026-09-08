"""In-process realtime event hub for the MVP dashboard."""
from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator


class EventHub:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[str]] = set()

    async def publish(self, payload: dict) -> None:
        message = json.dumps(payload)
        for queue in list(self._subscribers):
            await queue.put(message)

    async def subscribe(self) -> AsyncIterator[str]:
        queue: asyncio.Queue[str] = asyncio.Queue(maxsize=50)
        self._subscribers.add(queue)
        try:
            while True:
                yield await queue.get()
        finally:
            self._subscribers.discard(queue)


hub = EventHub()
