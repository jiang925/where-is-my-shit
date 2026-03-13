import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool

from src.app.core.auth import verify_api_key
from src.app.db.client import db_client
from src.app.db.compaction import compaction_manager
from src.app.schemas.message import IngestRequest
from src.app.services.embedding import EmbeddingService

router = APIRouter(dependencies=[Depends(verify_api_key)])


@router.post("/ingest", status_code=status.HTTP_201_CREATED)
async def ingest_document(request: IngestRequest):
    """
    Ingest a document into the knowledge base.
    Generates an ID if not provided.
    Generates embedding for the content.
    Stores the document and vector in LanceDB.
    """
    # 1. Generate ID if missing
    if not request.id:
        request.id = str(uuid.uuid4())

    # 2. Embed content (CPU intensive, run in threadpool)
    embedding_service = EmbeddingService()
    try:
        # embed_text returns a list of floats
        vector = await run_in_threadpool(embedding_service.embed_text, request.content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding generation failed: {str(e)}")

    # 3. Build record dict (avoids hardcoded Vector(384) in Message model)
    record = {
        "id": request.id,
        "conversation_id": request.conversation_id,
        "platform": request.platform,
        "title": request.title,
        "content": request.content,
        "role": request.role,
        "timestamp": request.timestamp,
        "url": request.url,
        "vector": vector,
        "embedding_model": embedding_service.get_model_name(),
    }

    # 4. Insert into LanceDB
    try:
        table = db_client.get_table("messages")
        await run_in_threadpool(table.add, [record])

        # Record write for compaction tracking
        compaction_manager.record_write()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database insertion failed: {str(e)}")

    return {"id": request.id, "status": "created"}
