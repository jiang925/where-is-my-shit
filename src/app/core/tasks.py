"""Background task definitions for WIMS Intelligence Layer.

Uses a simple in-process async queue for background jobs.
For production scale, this can be replaced with arq + Redis.
"""

import asyncio
import uuid
from collections.abc import Callable, Coroutine
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import structlog

logger = structlog.get_logger()


@dataclass
class Task:
    """Represents a background task."""

    id: str
    name: str
    func: Callable[..., Coroutine[Any, Any, Any]]
    args: tuple[Any, ...]
    kwargs: dict[str, Any]
    created_at: datetime
    retry_count: int = 0
    max_retries: int = 3


@dataclass
class TaskResult:
    """Result of a task execution."""

    task_id: str
    success: bool
    result: Any = None
    error: str | None = None
    completed_at: datetime = field(default_factory=lambda: datetime.now(UTC))


class TaskQueue:
    """Simple async task queue for background processing."""

    _instance: "TaskQueue | None" = None
    _initialized: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not self._initialized:
            self.queue: asyncio.Queue[Task] = asyncio.Queue()
            self.results: dict[str, TaskResult] = {}
            self.running: bool = False
            self._worker_task: asyncio.Task | None = None
            self._initialized = True

    async def start(self) -> None:
        """Start the background worker."""
        if not self.running:
            self.running = True
            self._worker_task = asyncio.create_task(self._worker())
            logger.info("task_queue.started")

    async def stop(self) -> None:
        """Stop the background worker."""
        if self.running:
            self.running = False
            if self._worker_task:
                self._worker_task.cancel()
                try:
                    await self._worker_task
                except asyncio.CancelledError:
                    pass
            logger.info("task_queue.stopped")

    async def enqueue(
        self,
        func: Callable[..., Coroutine[Any, Any, Any]],
        *args: Any,
        **kwargs: Any
    ) -> str:
        """Add a task to the queue."""
        task = Task(
            id=str(uuid.uuid4()),
            name=func.__name__,
            func=func,
            args=args,
            kwargs=kwargs,
            created_at=datetime.now(UTC),
        )
        await self.queue.put(task)
        logger.info("task_queue.enqueued", task_id=task.id, name=task.name)
        return task.id

    async def get_result(self, task_id: str, timeout: float = 30.0) -> TaskResult | None:
        """Get the result of a task (waits if not complete)."""
        start = asyncio.get_event_loop().time()
        while task_id not in self.results:
            elapsed = asyncio.get_event_loop().time() - start
            if elapsed > timeout:
                return None
            await asyncio.sleep(0.1)
        return self.results.get(task_id)

    async def _worker(self) -> None:
        """Background worker that processes tasks."""
        logger.info("task_queue.worker.started")
        
        while self.running:
            try:
                # Wait for a task with timeout to allow checking running flag
                try:
                    task = await asyncio.wait_for(self.queue.get(), timeout=1.0)
                except asyncio.TimeoutError:
                    continue

                await self._process_task(task)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("task_queue.worker.error", error=str(e))

    async def _process_task(self, task: Task) -> None:
        """Execute a single task with retry logic."""
        logger.info("task_queue.processing", task_id=task.id, name=task.name)
        
        try:
            result = await task.func(*task.args, **task.kwargs)
            self.results[task.id] = TaskResult(
                task_id=task.id,
                success=True,
                result=result
            )
            logger.info("task_queue.completed", task_id=task.id, name=task.name)
            
        except Exception as e:
            if task.retry_count < task.max_retries:
                task.retry_count += 1
                logger.warning(
                    "task_queue.retry",
                    task_id=task.id,
                    name=task.name,
                    retry=task.retry_count,
                    error=str(e)
                )
                await self.queue.put(task)
            else:
                self.results[task.id] = TaskResult(
                    task_id=task.id,
                    success=False,
                    error=str(e)
                )
                logger.error(
                    "task_queue.failed",
                    task_id=task.id,
                    name=task.name,
                    error=str(e)
                )


# Global task queue instance
task_queue = TaskQueue()


# Convenience functions for common task types

async def enqueue_extraction(conversation_id: str) -> str:
    """Enqueue knowledge extraction for a conversation."""
    from src.app.services.knowledge_extraction import extract_knowledge_from_conversation
    return await task_queue.enqueue(extract_knowledge_from_conversation, conversation_id)


async def enqueue_batch_extraction(conversation_ids: list[str]) -> str:
    """Enqueue batch knowledge extraction."""
    from src.app.services.knowledge_extraction import extract_knowledge_batch
    return await task_queue.enqueue(extract_knowledge_batch, conversation_ids)


async def enqueue_digest_generation() -> str:
    """Enqueue digest generation for all saved searches."""
    from src.app.services.digest_generator import generate_digests
    return await task_queue.enqueue(generate_digests)
