"""Knowledge extraction pipeline for conversations.

Extracts code snippets, prompts, and decisions from conversation messages.
"""

import json
import re
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import structlog

from src.app.db.client import db_client
from src.app.schemas.knowledge import KnowledgeItem
from src.app.services.embedding import EmbeddingService

logger = structlog.get_logger()


@dataclass
class CodeBlock:
    """Extracted code block."""

    language: str
    code: str
    line_count: int


@dataclass
class ExtractedPrompt:
    """Extracted prompt with quality metrics."""

    content: str
    quality_score: float
    has_follow_up: bool
    response_length: int


@dataclass
class ExtractedDecision:
    """Extracted decision with context."""

    text: str
    keywords: list[str]
    confidence: float


# Patterns for decision extraction
DECISION_PATTERNS = [
    r"(?i)(?:we |i )?(?:decided|decision)\s+(?:to |on |that )?(.{10,200})",
    r"(?i)(?:let['']s|let us)\s+(\w+[\s\w]{10,150})",
    r"(?i)conclusion\s*:?\s*(.{10,200})",
    r"(?i)(?:agreed|agreement)\s+(?:to |that )?(.{10,200})",
    r"(?i)(?:settled on|going with|chose)\s+(.{10,150})",
]

# Language detection from code block headers
LANGUAGE_MAP = {
    "py": "python",
    "js": "javascript",
    "ts": "typescript",
    "jsx": "jsx",
    "tsx": "tsx",
    "go": "go",
    "rs": "rust",
    "java": "java",
    "cpp": "cpp",
    "c": "c",
    "cs": "csharp",
    "rb": "ruby",
    "php": "php",
    "swift": "swift",
    "kt": "kotlin",
    "scala": "scala",
    "r": "r",
    "sql": "sql",
    "sh": "bash",
    "bash": "bash",
    "zsh": "zsh",
    "fish": "fish",
    "ps1": "powershell",
    "yaml": "yaml",
    "yml": "yaml",
    "json": "json",
    "toml": "toml",
    "xml": "xml",
    "html": "html",
    "css": "css",
    "scss": "scss",
    "sass": "sass",
    "less": "less",
    "dockerfile": "dockerfile",
    "makefile": "makefile",
    "cmake": "cmake",
}


def detect_language(lang_hint: str | None, code: str) -> str:
    """Detect programming language from hint or code content."""
    if lang_hint:
        hint_lower = lang_hint.lower().strip()
        if hint_lower in LANGUAGE_MAP:
            return LANGUAGE_MAP[hint_lower]
        return hint_lower
    
    # Simple heuristics based on code content
    code_start = code[:500].lower()
    
    if re.search(r'^\s*(def |class |import |from \w+ import)', code, re.MULTILINE):
        return "python"
    if re.search(r'^\s*(function|const|let|var|=>)', code, re.MULTILINE):
        return "javascript"
    if re.search(r'^\s*(interface|type |:\s*(string|number|boolean))', code, re.MULTILINE):
        return "typescript"
    if re.search(r'^\s*(func |package |import \()', code, re.MULTILINE):
        return "go"
    if re.search(r'^\s*(fn |let |mut |impl |use )', code, re.MULTILINE):
        return "rust"
    if re.search(r'^\s*(public class|private|protected)', code, re.MULTILINE):
        return "java"
    
    return "text"


def extract_code_blocks(content: str) -> list[CodeBlock]:
    """Extract fenced code blocks from markdown content."""
    # Match code blocks with optional language hint
    pattern = r'```(\w*)\n(.*?)```'
    matches = re.findall(pattern, content, re.DOTALL)
    
    blocks = []
    for lang_hint, code in matches:
        code = code.strip()
        if len(code) < 10:  # Skip very small snippets
            continue
            
        language = detect_language(lang_hint if lang_hint else None, code)
        line_count = len(code.split('\n'))
        
        blocks.append(CodeBlock(
            language=language,
            code=code,
            line_count=line_count
        ))
    
    return blocks


def calculate_prompt_quality(message: dict[str, Any], next_message: dict[str, Any] | None) -> float:
    """Calculate quality score for a potential prompt."""
    content = message.get("content", "")
    
    # Base score
    score = 0.5
    
    # Length factor (longer prompts often more detailed)
    length = len(content)
    if 100 <= length <= 1000:
        score += 0.1
    elif length > 1000:
        score += 0.05  # Very long might be too specific
    
    # Has structure (bullet points, numbers)
    if re.search(r'^[\s]*[-*\d]', content, re.MULTILINE):
        score += 0.1
    
    # Contains specific instructions
    instruction_words = ['create', 'build', 'implement', 'write', 'generate', 'explain', 'analyze']
    if any(word in content.lower() for word in instruction_words):
        score += 0.1
    
    # Check response quality if available
    if next_message:
        response = next_message.get("content", "")
        response_len = len(response)
        
        # Good response length
        if response_len > 500:
            score += 0.1
        
        # Response has code (good sign)
        if '```' in response:
            score += 0.1
        
        # Has follow-up engagement
        if next_message.get("role") == "user":
            score += 0.05
    
    return min(score, 1.0)


def is_high_quality_prompt(message: dict[str, Any], next_message: dict[str, Any] | None) -> bool:
    """Determine if a message is a high-quality prompt worth saving."""
    content = message.get("content", "")
    
    # Must be a user message
    if message.get("role") != "user":
        return False
    
    # Minimum length
    if len(content) < 50:
        return False
    
    # Calculate quality
    quality = calculate_prompt_quality(message, next_message)
    return quality >= 0.7


def extract_prompts(messages: list[dict[str, Any]]) -> list[ExtractedPrompt]:
    """Extract high-quality prompts from messages."""
    prompts = []
    
    for i, msg in enumerate(messages):
        if msg.get("role") != "user":
            continue
        
        # Look at next message for context
        next_msg = messages[i + 1] if i + 1 < len(messages) else None
        
        if is_high_quality_prompt(msg, next_msg):
            content = msg.get("content", "")
            quality = calculate_prompt_quality(msg, next_msg)
            
            prompts.append(ExtractedPrompt(
                content=content,
                quality_score=quality,
                has_follow_up=next_msg is not None and next_msg.get("role") == "assistant",
                response_length=len(next_msg.get("content", "")) if next_msg else 0
            ))
    
    return prompts


def extract_decisions(content: str) -> list[ExtractedDecision]:
    """Extract decision statements from content."""
    decisions = []
    
    for pattern in DECISION_PATTERNS:
        matches = re.finditer(pattern, content)
        for match in matches:
            text = match.group(1).strip()
            if len(text) < 10:
                continue
            
            # Extract keywords
            words = re.findall(r'\b[A-Za-z]{4,}\b', text)
            keywords = list(set(words))[:5]  # Top 5 unique keywords
            
            # Confidence based on pattern match quality
            confidence = 0.7
            if any(word in text.lower() for word in ['will', 'should', 'must', 'need to']):
                confidence = 0.85
            
            decisions.append(ExtractedDecision(
                text=text,
                keywords=keywords,
                confidence=confidence
            ))
    
    return decisions


async def extract_knowledge_from_conversation(conversation_id: str) -> dict[str, int]:
    """Extract all knowledge types from a conversation.
    
    Args:
        conversation_id: The conversation to process
        
    Returns:
        Dict with counts of extracted items by type
    """
    logger.info("knowledge_extraction.start", conversation_id=conversation_id)
    
    try:
        # Get all messages for this conversation
        table = db_client.get_table("messages")
        
        # Query messages for this conversation
        results = (
            table.search([0.0] * 384, query_type="vector")  # Dummy vector
            .where(f"conversation_id = '{conversation_id}'")
            .limit(10000)
            .to_list()
        )
        
        if not results:
            logger.warning("knowledge_extraction.no_messages", conversation_id=conversation_id)
            return {"code": 0, "prompt": 0, "decision": 0}
        
        # Get platform from first message
        platform = results[0].get("platform", "unknown")
        
        counts = {"code": 0, "prompt": 0, "decision": 0}
        
        # Extract code blocks from all messages
        for msg in results:
            content = msg.get("content", "")
            msg_id = msg.get("id", "")
            
            # Code extraction
            code_blocks = extract_code_blocks(content)
            for block in code_blocks:
                await save_knowledge_item(
                    type="code",
                    content=block.code,
                    conversation_id=conversation_id,
                    message_id=msg_id,
                    platform=platform,
                    metadata={
                        "language": block.language,
                        "line_count": block.line_count,
                    }
                )
                counts["code"] += 1
            
            # Decision extraction
            decisions = extract_decisions(content)
            for decision in decisions:
                await save_knowledge_item(
                    type="decision",
                    content=decision.text,
                    conversation_id=conversation_id,
                    message_id=msg_id,
                    platform=platform,
                    metadata={
                        "keywords": decision.keywords,
                        "confidence": decision.confidence,
                    }
                )
                counts["decision"] += 1
        
        # Prompt extraction (needs all messages for context)
        prompts = extract_prompts(results)
        for prompt in prompts:
            # Find the message ID for this prompt
            msg = next((m for m in results if m.get("content") == prompt.content), None)
            msg_id = msg.get("id", "") if msg else ""
            
            await save_knowledge_item(
                type="prompt",
                content=prompt.content,
                conversation_id=conversation_id,
                message_id=msg_id,
                platform=platform,
                metadata={
                    "quality_score": prompt.quality_score,
                    "has_follow_up": prompt.has_follow_up,
                    "response_length": prompt.response_length,
                }
            )
            counts["prompt"] += 1
        
        logger.info(
            "knowledge_extraction.complete",
            conversation_id=conversation_id,
            **counts
        )
        return counts
        
    except Exception as e:
        logger.error(
            "knowledge_extraction.error",
            conversation_id=conversation_id,
            error=str(e)
        )
        raise


async def save_knowledge_item(
    type: str,
    content: str,
    conversation_id: str,
    message_id: str,
    platform: str,
    metadata: dict[str, Any]
) -> str:
    """Save a knowledge item to the database.
    
    Returns:
        The ID of the created knowledge item
    """
    embedding_service = EmbeddingService()
    vector = embedding_service.embed_text(content)
    
    item_id = str(uuid.uuid4())
    now = datetime.now(UTC)
    
    item = KnowledgeItem(
        id=item_id,
        type=type,
        content=content,
        conversation_id=conversation_id,
        message_id=message_id,
        platform=platform,
        metadata=json.dumps(metadata),
        vector=vector,
        usage_count=0,
        created_at=now,
        updated_at=now,
    )
    
    # Get or create table
    db = db_client.connect()
    if "knowledge_items" not in db.table_names():
        table = db.create_table("knowledge_items", schema=KnowledgeItem)
    else:
        table = db.open_table("knowledge_items")
    
    # Convert to dict for insertion
    item_dict = {
        "id": item.id,
        "type": item.type,
        "content": item.content,
        "conversation_id": item.conversation_id,
        "message_id": item.message_id,
        "platform": item.platform,
        "metadata": item.metadata,
        "vector": item.vector.tolist() if hasattr(item.vector, 'tolist') else list(item.vector),
        "usage_count": item.usage_count,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }
    
    table.add([item_dict])
    
    return item_id


async def extract_knowledge_batch(conversation_ids: list[str]) -> dict[str, dict[str, int]]:
    """Extract knowledge from multiple conversations.
    
    Returns:
        Dict mapping conversation_id to extraction counts
    """
    results = {}
    for conv_id in conversation_ids:
        try:
            counts = await extract_knowledge_from_conversation(conv_id)
            results[conv_id] = counts
        except Exception as e:
            logger.error("knowledge_extraction.batch_error", conversation_id=conv_id, error=str(e))
            results[conv_id] = {"error": str(e)}
    
    return results
