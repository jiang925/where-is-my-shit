# Requirements Brainstorm: WIMS Next Features

## Vision
Transform WIMS from a conversation search tool into an intelligent AI memory system that proactively surfaces relevant context, identifies patterns across conversations, and helps users build cumulative knowledge from their AI interactions.

## Current State Analysis

### Existing Features (Strong Foundation)
- **Capture**: 13 web platforms + 9 dev tools, bulk import, file watcher daemon
- **Search**: Hybrid semantic + full-text with unified reranking, search operators, filters
- **Organization**: Bookmarks, pins, annotations, conversation titles
- **Export/Import**: Markdown, ZIP, HTML, ChatGPT/Claude data imports
- **UI**: Dark mode, compact view, keyboard navigation, timeline browsing
- **Integrations**: MCP server, multi-device sync, deep links
- **Tech**: FastAPI + LanceDB, React frontend, Chrome extension

### Current Gaps (User Pain Points)
1. **No proactive insights** - Users must search; system doesn't surface relevant past conversations
2. **No pattern recognition** - Can't see "you've asked similar questions 5 times"
3. **Limited conversation context** - No threading, no relationship between conversations
4. **No knowledge extraction** - Code snippets, decisions, insights buried in conversations
5. **Static search** - No saved searches, no alerts for new relevant content
6. **No collaboration** - Personal tool only, no sharing insights with team

## Target Users

### Primary: Power AI Users
- Developers using multiple AI tools daily (Claude Code, Cursor, ChatGPT, etc.)
- Knowledge workers researching across platforms
- AI-native professionals building with AI

### Secondary: Team Leads
- Want to capture and share team knowledge
- Need visibility into common questions/blockers
- Want to build reusable prompt libraries

## Core Features (Next Release)

### 1. Smart Context Cards ⭐ P0
**What**: When user searches, show "Related Conversations" and "You also discussed this with..."
**Why**: Users forget they already solved similar problems; prevent reinventing the wheel
**Value**: Save time, build on past learning

### 2. Knowledge Extraction Engine ⭐ P0
**What**: Auto-extract code snippets, decisions, key insights from conversations; create searchable knowledge base
**Why**: Conversations are ephemeral; knowledge should be persistent and reusable
**Value**: Turn chats into reusable assets

### 3. Conversation Threads & Forking ⭐ P1
**What**: Link related conversations, show "continued from..." relationships, allow forking
**Why**: Complex problems span multiple sessions; current flat structure loses context
**Value**: Maintain continuity across sessions

### 4. Saved Searches & Alerts ⭐ P1
**What**: Save search queries, get notified when new conversations match
**Why**: Users want to track topics over time without manual checking
**Value**: Passive monitoring of interests

### 5. Prompt Library (from history) ⭐ P1
**What**: Auto-identify effective prompts, allow saving/tagging, searchable prompt templates
**Why**: Users reuse prompts but lose them in conversation history
**Value**: Build personal prompt library effortlessly

### 6. Conversation Summaries ⭐ P2
**What**: One-click TL;DR of long conversations, key takeaways extraction
**Why**: Quickly recall what a conversation was about without re-reading
**Value**: Faster information retrieval

### 7. Usage Analytics Dashboard ⭐ P2
**What**: Visualize AI usage patterns, most-used platforms, topic trends over time
**Why**: Users curious about their own AI usage patterns
**Value**: Self-awareness, productivity insights

## User Stories

### Smart Context
- As a developer, I want to see that I solved a similar bug 2 months ago so that I don't waste time re-debugging
- As a researcher, I want to see all conversations about "React performance" across platforms so that I have complete context

### Knowledge Extraction
- As a developer, I want my code snippets from conversations auto-saved and searchable so that I can reuse them
- As a team lead, I want to extract architectural decisions from discussions so that we have a decision log

### Conversation Threads
- As a user, I want to mark conversation B as a follow-up to conversation A so that I can track problem-solving progression
- As a user, I want to see "you returned to this topic 3 times" so that I understand my learning patterns

### Saved Searches
- As a developer, I want to save "platform:claude-code has:code typescript" and get weekly digests so that I track my TypeScript learnings
- As a product manager, I want alerts when conversations mention "competitor X" so that I stay informed

### Prompt Library
- As a user, I want my most effective prompts auto-suggested when I start typing so that I get consistent results
- As a team member, I want to share vetted prompts with my team so that we standardize outputs

## Non-Functional Requirements

### Performance
- Context card suggestions: < 200ms (after search results)
- Knowledge extraction: background async, < 5s per conversation
- UI remains responsive during processing

### Privacy
- All processing local (no external APIs for extraction)
- Optional: user can disable specific extraction features

### Compatibility
- Works with existing LanceDB schema (migrations if needed)
- Extension updates backward compatible

## Constraints & Assumptions

### Constraints
- Must remain local-first (no cloud dependencies)
- Must work offline
- Embedding models must run locally or via user-configured endpoints

### Assumptions
- Users have enough disk space for additional indices
- Users willing to wait for initial knowledge extraction backlog processing
- Most valuable conversations are from recent 90 days (prioritize)

## Success Metrics

### User Engagement
- Smart Context shown in 30%+ of searches
- Knowledge extraction viewed 5+ times per user per week
- 20%+ of users have saved at least one search

### Retention
- Users return to WIMS 3+ times per week (up from current baseline)
- Search queries per session increases by 25%

### Efficiency
- Time to find relevant past conversation: < 30 seconds (measured via UI telemetry)
- User-reported "found what I needed" satisfaction: 4.5/5

## Open Questions

1. Should knowledge extraction use local LLM (e.g., via Ollama) or rule-based heuristics?
2. How to handle knowledge extraction for existing large conversation history (batch vs lazy)?
3. Should Smart Context require explicit trigger or auto-appear on every search?
4. What's the retention policy for extracted knowledge (indefinite vs LRU)?
5. Should we support team/organization features or remain strictly personal?

## Next Steps

1. Validate feature priority with user feedback
2. Design Knowledge Extraction data model
3. Prototype Smart Context with rule-based matching
4. Define MCP integration for context surfacing in Claude Code
