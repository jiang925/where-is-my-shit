# Product Requirements Document: WIMS Intelligence Layer

## 1. Overview

### Problem Statement
Users accumulate thousands of AI conversations across multiple platforms but have no systematic way to:
- Discover relevant past conversations when they need them
- Extract reusable knowledge (code, prompts, decisions) from ephemeral chats
- See patterns and connections across their AI usage

### Solution Overview
Add an "Intelligence Layer" to WIMS that:
1. **Surfaces relevant context proactively** via Smart Context Cards
2. **Extracts structured knowledge** (snippets, prompts, decisions) from conversations
3. **Connects related conversations** via threading and relationship mapping
4. **Enables monitoring** via saved searches and digest emails

### Target Audience
- Primary: Developers and knowledge workers using AI tools daily
- Secondary: Team leads wanting to capture and share institutional knowledge

## 2. Goals & Success Metrics

### Goals
1. Reduce time to find relevant historical context by 50%
2. Enable reuse of 30% of extracted code snippets/prompts
3. Increase user engagement to 3+ sessions per week

### Success Metrics
| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Smart Context displayed | 0% | 30% of searches | Backend tracking |
| Knowledge items viewed | 0 | 5+/user/week | Analytics |
| Saved searches per user | 0 | 20% have ≥1 | DB query |
| Search sessions/week | TBD | 3+ | Analytics |
| User satisfaction | TBD | 4.5/5 | Survey |

## 3. Functional Requirements

### Feature 1: Smart Context Cards ⭐ P0

**Description**: Automatically suggest related conversations and insights when users search or view conversations.

**Acceptance Criteria**:
- [ ] When viewing search results, show up to 3 "Related Conversations" cards
- [ ] Related conversations determined by semantic similarity + shared keywords
- [ ] Show "You also discussed this with {platform}" cross-platform insights
- [ ] Display last activity date and message count for each suggestion
- [ ] Clicking suggestion opens that conversation
- [ ] Works within 200ms of search results loading

**Priority**: P0

### Feature 2: Knowledge Extraction Engine ⭐ P0

**Description**: Background processing that extracts reusable knowledge from conversations.

**Acceptance Criteria**:
- [ ] Auto-extract code blocks with metadata (language, context, source conversation)
- [ ] Identify and extract effective prompts (messages with good responses)
- [ ] Extract "decisions" (messages containing "decided", "conclusion", "let's go with")
- [ ] Store in new `knowledge_items` table with type, content, source, tags
- [ ] Background processing with progress tracking
- [ ] Search integration: `type:code python asyncio` queries
- [ ] UI panel to browse extracted knowledge by type

**Priority**: P0

### Feature 3: Conversation Threads ⭐ P1

**Description**: Link related conversations to maintain context across sessions.

**Acceptance Criteria**:
- [ ] UI to mark conversation B as "continues from" conversation A
- [ ] Visual indicator in conversation list showing thread relationships
- [ ] Thread view showing all linked conversations in chronological order
- [ ] Auto-suggest thread relationships based on title similarity + time proximity
- [ ] "Fork" option to start related but separate thread

**Priority**: P1

### Feature 4: Saved Searches & Digests ⭐ P1

**Description**: Allow users to save queries and receive updates.

**Acceptance Criteria**:
- [ ] Save current search filters/query as named search
- [ ] List saved searches in sidebar
- [ ] Click saved search to re-run with one click
- [ ] Weekly digest option: email/notification of new matches
- [ ] Digest includes count of new conversations and preview of top 3

**Priority**: P1

### Feature 5: Prompt Library ⭐ P1

**Description**: Curated collection of effective prompts extracted from history.

**Acceptance Criteria**:
- [ ] Auto-identify high-quality prompts (heuristic: length, follow-up engagement, code in response)
- [ ] Allow manual save/tagging of prompts
- [ ] Browse prompts by tag/category
- [ ] Copy prompt to clipboard with one click
- [ ] Search prompts by content or tag
- [ ] Show usage count (how many times prompt led to saved code/decision)

**Priority**: P1

### Feature 6: Conversation Summaries ⭐ P2

**Description**: One-click TL;DR generation for long conversations.

**Acceptance Criteria**:
- [ ] Summary button in conversation view
- [ ] Extract key points, decisions, action items
- [ ] Summary stored and editable by user
- [ ] Show summary in search results preview
- [ ] Bulk summarize option for backlog

**Priority**: P2

### Feature 7: Usage Analytics ⭐ P2

**Description**: Personal dashboard showing AI usage patterns.

**Acceptance Criteria**:
- [ ] Total conversations by platform (pie/bar chart)
- [ ] Conversation volume over time (line chart)
- [ ] Most active topics (word cloud or tag list)
- [ ] Peak usage hours/days
- [ ] Export analytics as image/CSV

**Priority**: P2

## 4. Non-Functional Requirements

### Performance
- Smart Context query: < 200ms (measured from API request to response)
- Knowledge extraction: background async, < 5s per conversation on average
- UI remains responsive during background processing
- Database queries for related content: < 100ms

### Privacy & Security
- All processing remains local (no external LLM APIs required)
- Optional: allow user to disable knowledge extraction entirely
- Extracted knowledge inherits conversation visibility settings
- No analytics sent to external servers

### Compatibility
- Database schema: backward compatible migration
- API: new endpoints are additive only
- Extension: works with existing capture flow
- UI: graceful degradation if features disabled

### Scalability
- Support up to 100,000 conversations without performance degradation
- Knowledge extraction should be incremental (process new conversations only)
- Background queue for extraction tasks

## 5. Out of Scope

- Real-time collaboration (multiple users on same instance)
- Cloud sync/backup (remains local-first)
- Natural language query interface ("find me that bug fix from last month")
- Automatic prompt optimization/suggestion during AI conversations
- Mobile app (web UI responsive only)
- Third-party integrations beyond MCP

## 6. Task Breakdown

| ID | Task | Phase | Priority | Dependencies |
|----|------|-------|----------|--------------|
| T1 | Design Knowledge data model | Tech Design | P0 | None |
| T2 | Create `knowledge_items` table migration | Implementation | P0 | T1 |
| T3 | Build code extraction pipeline | Implementation | P0 | T2 |
| T4 | Build prompt extraction pipeline | Implementation | P0 | T2 |
| T5 | Build decision extraction pipeline | Implementation | P0 | T2 |
| T6 | Create knowledge API endpoints | Implementation | P0 | T3,T4,T5 |
| T7 | Build knowledge browser UI | Implementation | P0 | T6 |
| T8 | Implement Smart Context query logic | Implementation | P0 | T1 |
| T9 | Build Smart Context UI components | Implementation | P0 | T8 |
| T10 | Add saved searches data model | Implementation | P1 | None |
| T11 | Build saved searches UI | Implementation | P1 | T10 |
| T12 | Implement digest generation | Implementation | P1 | T10 |
| T13 | Add conversation threading model | Implementation | P1 | None |
| T14 | Build thread linking UI | Implementation | P1 | T13 |
| T15 | Implement conversation summarization | Implementation | P2 | T1 |
| T16 | Build analytics dashboard | Implementation | P2 | None |
| T17 | Background job queue system | Implementation | P0 | None |
| T18 | Migration for existing conversations | Implementation | P0 | T2,T17 |
| T19 | E2E tests for knowledge extraction | Testing | P0 | T7 |
| T20 | Performance testing for Smart Context | Testing | P0 | T9 |
| T21 | Documentation update | Verification | P1 | All |

## 7. Open Questions

1. **LLM for extraction**: Use local LLM (Ollama) vs rule-based heuristics?
   - *Decision*: Start with rule-based, add LLM option later
   
2. **Batch processing**: Process all existing conversations at once vs on-demand?
   - *Decision*: Background batch for recent 90 days, lazy for older
   
3. **Storage**: How long to keep extracted knowledge if source deleted?
   - *Decision*: Cascade delete (knowledge is derivative)
   
4. **Sharing**: Allow exporting/sharing prompt library?
   - *Decision*: Phase 2 feature, export as JSON

## 8. Release Criteria

- [ ] All P0 features implemented and tested
- [ ] Smart Context latency < 200ms (p95)
- [ ] Knowledge extraction works for 10+ conversation platforms
- [ ] UI responsive on screens 1280px+
- [ ] Documentation updated with new features
- [ ] No P0/P1 bugs open

## 9. Appendix

### A. Data Model Sketch

```
knowledge_items:
  - id: UUID
  - type: "code" | "prompt" | "decision" | "summary"
  - content: text
  - source_conversation_id: FK
  - source_message_id: FK
  - metadata: JSON (language, tags, etc.)
  - extracted_at: timestamp
  - usage_count: int

conversation_threads:
  - id: UUID
  - root_conversation_id: FK
  - name: string
  - created_at: timestamp

thread_conversations:
  - thread_id: FK
  - conversation_id: FK
  - position: int (order in thread)
  - relationship_type: "continues" | "forks" | "related"

saved_searches:
  - id: UUID
  - name: string
  - query: string
  - filters: JSON
  - digest_enabled: bool
  - digest_frequency: "daily" | "weekly"
  - last_sent_at: timestamp
```

### B. API Endpoints

```
GET /api/v1/knowledge?type=code&language=python
POST /api/v1/knowledge/{id}/increment-usage
GET /api/v1/conversations/{id}/related
GET /api/v1/conversations/{id}/thread
POST /api/v1/conversations/{id}/link
GET /api/v1/saved-searches
POST /api/v1/saved-searches
GET /api/v1/stats/usage
```
