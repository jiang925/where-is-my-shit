# Technical Design Document: WIMS Intelligence Layer

## 1. Architecture Overview

### System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        WIMS Server                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Knowledge  │  │    Smart    │  │    Background Queue     │  │
│  │  Extraction │  │   Context   │  │  (taskiq/arq/celery)    │  │
│  │  Pipeline   │  │   Engine    │  │                         │  │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────────┘  │
│         │                │                   │                  │
│         ▼                ▼                   ▼                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    LanceDB (Extended)                     │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │  │
│  │  │  messages   │  │knowledge_    │  │  conversation_  │  │  │
│  │  │  (existing) │  │  items       │  │    threads      │  │  │
│  │  └─────────────┘  └──────────────┘  └─────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
   ┌──────────┐        ┌──────────┐        ┌──────────┐
   │React UI  │        │ Chrome   │        │  Watcher │
   │(New pages│        │ Extension│        │  (daemon)│
   │ + comps) │        │(existing)│        │(existing)│
   └──────────┘        └──────────┘        └──────────┘
```

### Component Breakdown

1. **Knowledge Extraction Pipeline**: Rule-based extractor that processes conversation content
2. **Smart Context Engine**: Query module that finds related conversations using vector similarity
3. **Background Queue**: Async task processor for extraction jobs
4. **Extended Database**: New tables for knowledge items and conversation threads

## 2. Technology Stack

### Existing (unchanged)
- **Backend**: FastAPI + Python 3.11+
- **Database**: LanceDB (vector + document store)
- **Frontend**: React 19 + TypeScript + Tailwind CSS
- **Extension**: TypeScript + Webpack

### New Additions
- **Task Queue**: `arq` (async Redis-based, lightweight)
- **Background Jobs**: Asyncio + arq workers
- **Schema Migration**: Custom migration script (LanceDB doesn't have Alembic)

### Why arq over Celery?
- Native asyncio support (matches FastAPI)
- Simpler configuration
- Redis-based (we can use file-based SQLite for simplicity if Redis not available)
- Lower overhead for our use case

## 3. Data Models

### knowledge_items Table

```python
class KnowledgeItem(LanceModel):
    """Extracted knowledge from conversations."""
    
    id: str  # UUID
    type: str  # "code" | "prompt" | "decision" | "summary"
    content: str  # The extracted content
    
    # Source tracking
    conversation_id: str
    message_id: str  # Specific message within conversation
    platform: str
    
    # Metadata (stored as JSON string for LanceDB compatibility)
    metadata: str  # JSON: {language, tags, confidence, etc.}
    
    # Vector for semantic search
    vector: Vector(384)  # Same dim as messages table
    
    # Usage tracking
    usage_count: int = 0
    created_at: datetime
    updated_at: datetime
```

### conversation_threads Table

```python
class ConversationThread(LanceModel):
    """Groups of related conversations."""
    
    id: str  # UUID
    name: str  # User-defined thread name
    description: str = ""
    created_at: datetime
    updated_at: datetime
```

### thread_conversations Table (Junction)

```python
class ThreadConversation(LanceModel):
    """Links conversations to threads with ordering."""
    
    id: str  # UUID
    thread_id: str
    conversation_id: str
    position: int  # Order in thread (0, 1, 2...)
    relationship_type: str  # "continues" | "forks" | "related"
    linked_at: datetime
    linked_by: str = "user"  # "user" | "auto"
```

### saved_searches Table

```python
class SavedSearch(LanceModel):
    """User-saved search queries."""
    
    id: str  # UUID
    name: str
    query: str  # Search text
    
    # Filters stored as JSON
    filters: str  # JSON: {platforms, date_range, has_code, etc.}
    
    # Digest settings
    digest_enabled: bool = False
    digest_frequency: str = "weekly"  # "daily" | "weekly"
    last_digest_at: datetime | None = None
    
    created_at: datetime
```

## 4. API Design

### Knowledge Endpoints

```python
# GET /api/v1/knowledge
# Query params: type, platform, tags, query (semantic), limit, offset
{
  "items": [
    {
      "id": "uuid",
      "type": "code",
      "content": "def hello(): ...",
      "metadata": {"language": "python", "tags": ["asyncio"]},
      "source": {
        "conversation_id": "...",
        "platform": "claude-code",
        "title": "..."
      },
      "usage_count": 5,
      "created_at": "2026-03-22T..."
    }
  ],
  "total": 42,
  "has_more": true
}

# POST /api/v1/knowledge/{id}/increment-usage
# Response: 200 OK with updated usage_count

# DELETE /api/v1/knowledge/{id}
# Soft delete or hard delete based on preference
```

### Smart Context Endpoints

```python
# GET /api/v1/conversations/{id}/related?limit=3
{
  "conversation_id": "...",
  "related": [
    {
      "conversation_id": "...",
      "platform": "chatgpt",
      "title": "Similar topic discussion",
      "similarity_score": 0.85,
      "message_count": 12,
      "last_activity": "2026-03-20T..."
    }
  ]
}

# POST /api/v1/search/with-context
# Same as regular search but includes "related_conversations" in response
```

### Thread Endpoints

```python
# POST /api/v1/threads
{
  "name": "Project X Architecture",
  "description": "Architecture decisions for Project X"
}

# POST /api/v1/threads/{id}/conversations
{
  "conversation_id": "...",
  "relationship_type": "continues",
  "position": 0
}

# GET /api/v1/threads/{id}
{
  "id": "...",
  "name": "...",
  "conversations": [
    {
      "conversation_id": "...",
      "platform": "...",
      "title": "...",
      "position": 0,
      "relationship_type": "continues"
    }
  ]
}

# GET /api/v1/conversations/{id}/threads
# Returns threads this conversation belongs to
```

### Saved Search Endpoints

```python
# GET /api/v1/saved-searches
[
  {
    "id": "...",
    "name": "Python Asyncio Patterns",
    "query": "asyncio patterns",
    "filters": {"platforms": ["claude-code"], "has_code": true},
    "digest_enabled": true,
    "digest_frequency": "weekly"
  }
]

# POST /api/v1/saved-searches
{
  "name": "...",
  "query": "...",
  "filters": {...},
  "digest_enabled": false
}

# DELETE /api/v1/saved-searches/{id}
```

## 5. Directory Structure

```
src/
├── app/
│   ├── api/v1/endpoints/
│   │   ├── knowledge.py      # Knowledge CRUD endpoints
│   │   ├── threads.py        # Conversation threading
│   │   ├── saved_searches.py # Saved search management
│   │   └── search.py         # Extended with Smart Context
│   ├── core/
│   │   └── tasks.py          # Background task definitions
│   ├── db/
│   │   ├── migrations/
│   │   │   └── v2_intelligence_layer.py
│   │   └── client.py         # Extended with new tables
│   ├── schemas/
│   │   ├── knowledge.py      # Pydantic models
│   │   ├── thread.py
│   │   └── saved_search.py
│   └── services/
│       ├── knowledge_extraction.py  # Extraction pipeline
│       ├── smart_context.py         # Related content finder
│       └── background_worker.py     # arq worker setup
ui/src/
├── pages/
│   ├── KnowledgePage.tsx     # Browse extracted knowledge
│   └── ThreadPage.tsx        # View conversation threads
├── components/
│   ├── SmartContextPanel.tsx # Related conversations sidebar
│   ├── KnowledgeCard.tsx     # Code/prompt/decision cards
│   └── SaveSearchDialog.tsx  # Save current search
└── hooks/
    ├── useKnowledge.ts
    ├── useThreads.ts
    └── useSavedSearches.ts
```

## 6. Key Algorithms

### Knowledge Extraction Pipeline

```python
async def extract_knowledge_from_conversation(conversation_id: str):
    messages = get_messages(conversation_id)
    
    for message in messages:
        # Extract code blocks
        code_blocks = extract_code_blocks(message.content)
        for block in code_blocks:
            await save_knowledge_item(
                type="code",
                content=block.code,
                metadata={"language": block.language},
                source=message
            )
        
        # Extract prompts (heuristic-based)
        if is_high_quality_prompt(message):
            await save_knowledge_item(
                type="prompt",
                content=message.content,
                metadata={"response_quality_score": score},
                source=message
            )
        
        # Extract decisions
        decisions = extract_decisions(message.content)
        for decision in decisions:
            await save_knowledge_item(
                type="decision",
                content=decision.text,
                metadata={"keywords": decision.keywords},
                source=message
            )
```

### Smart Context Query

```python
async def find_related_conversations(conversation_id: str, limit: int = 3):
    # Get conversation vector (average of message vectors)
    conv_vector = get_conversation_vector(conversation_id)
    
    # Vector search for similar conversations
    similar = await vector_search(
        vector=conv_vector,
        filter=f"conversation_id != '{conversation_id}'",
        limit=limit * 2  # Get extra for reranking
    )
    
    # Get conversation metadata for each
    results = []
    for item in similar:
        conv_meta = get_conversation_metadata(item.conversation_id)
        results.append({
            **conv_meta,
            "similarity_score": item.score
        })
    
    # Return top N
    return results[:limit]
```

### Code Block Extraction

```python
def extract_code_blocks(content: str) -> list[CodeBlock]:
    """Extract fenced code blocks from markdown."""
    pattern = r'```(\w+)?\n(.*?)```'
    matches = re.findall(pattern, content, re.DOTALL)
    
    blocks = []
    for lang, code in matches:
        blocks.append(CodeBlock(
            language=lang or "text",
            code=code.strip()
        ))
    return blocks
```

## 7. Error Handling Strategy

### Background Jobs
- Failed extractions logged to `~/.wims/extraction_errors.log`
- Retry with exponential backoff (3 attempts)
- Dead letter queue for persistent failures

### API Errors
- 400: Invalid parameters (e.g., unknown knowledge type)
- 404: Knowledge item not found
- 500: Extraction pipeline failure (return 202 for async ops)

### Database
- LanceDB schema migrations are additive only
- Backup before migration: `cp -r data/wims.lance data/wims.lane.backup.$(date)`

## 8. Security Considerations

- All extraction happens locally (no external LLM calls unless user-configured)
- Knowledge items inherit conversation visibility (no additional auth needed)
- API endpoints use existing API key authentication
- No PII detection/removal (user responsibility)

## 9. Testing Strategy

### Unit Tests
- Code extraction: test various markdown formats
- Prompt quality scoring: test heuristic accuracy
- Vector similarity: test with known similar conversations

### Integration Tests
- End-to-end extraction pipeline
- API endpoint testing
- Database migration testing

### Performance Tests
- Smart Context latency < 200ms with 10k conversations
- Background extraction throughput (conversations/minute)

## 10. Migration Strategy

### Phase 1: Schema Migration (on server start)
1. Check current schema version
2. Create new tables if not exist
3. Add columns to existing tables if needed
4. Mark migration complete

### Phase 2: Backfill (background)
1. Queue all existing conversations for extraction
2. Process in batches of 100
3. Progress tracked in `~/.wims/migration_progress.json`
4. Can pause/resume

### Rollback Plan
- Keep backup of pre-migration database
- Rollback script to drop new tables
- Feature flags to disable new UI if needed
