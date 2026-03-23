# Implementation Plan: WIMS Intelligence Layer

## Sprint/Iteration Breakdown

---

### Sprint 1: Foundation & Infrastructure
**Duration**: Week 1
**Goal**: Set up data models, migrations, and background job infrastructure

#### Tasks
- [ ] **T1**: Design Knowledge data model → *Tech Design already done, just review*
- [ ] **T2**: Create `knowledge_items` table migration
- [ ] **T17**: Background job queue system (arq setup)
- [ ] **T13**: Add conversation threading model
- [ ] **T10**: Add saved searches data model

#### Definition of Done
- [ ] All new tables created in LanceDB
- [ ] Migration script runs successfully on fresh install
- [ ] arq worker can start and process test jobs
- [ ] Database backup/restore tested

#### Dependencies
None

---

### Sprint 2: Knowledge Extraction Pipeline
**Duration**: Week 2
**Goal**: Build extraction pipeline for code, prompts, and decisions

#### Tasks
- [ ] **T3**: Build code extraction pipeline
- [ ] **T4**: Build prompt extraction pipeline
- [ ] **T5**: Build decision extraction pipeline
- [ ] **T18**: Migration for existing conversations (batch processor)

#### Definition of Done
- [ ] Code extraction identifies language correctly for Python, JS, TS, Go, Rust, Bash
- [ ] Prompt extraction correctly identifies high-quality prompts (test with 20 samples)
- [ ] Decision extraction finds messages with "decided", "conclusion", "let's go with"
- [ ] Batch processor can handle 1000 conversations without memory issues
- [ ] Extraction progress visible in logs

#### Dependencies
- T2 (knowledge_items table)
- T17 (background queue)

---

### Sprint 3: Knowledge API & UI
**Duration**: Week 3
**Goal**: Expose knowledge via API and build browser UI

#### Tasks
- [ ] **T6**: Create knowledge API endpoints
- [ ] **T7**: Build knowledge browser UI

#### Definition of Done
- [ ] GET /api/v1/knowledge returns paginated results
- [ ] Filtering by type (code/prompt/decision) works
- [ ] Search within knowledge works (semantic + text)
- [ ] UI has tabs for Code / Prompts / Decisions
- [ ] Copy to clipboard works for all content types
- [ ] Usage count increments on copy

#### Dependencies
- T3, T4, T5 (extraction pipelines)

---

### Sprint 4: Smart Context
**Duration**: Week 4
**Goal**: Implement related conversation suggestions

#### Tasks
- [ ] **T8**: Implement Smart Context query logic
- [ ] **T9**: Build Smart Context UI components

#### Definition of Done
- [ ] Related conversations found via vector similarity
- [ ] Results filtered by platform if needed
- [ ] UI shows up to 3 related conversations in search results
- [ ] Clicking suggestion navigates to conversation
- [ ] Latency < 200ms for p95 (test with 5000 conversations)
- [ ] Shows conversation title, platform, message count, last activity

#### Dependencies
- T2 (knowledge_items table)

---

### Sprint 5: Saved Searches & Digests
**Duration**: Week 5
**Goal**: Allow users to save and monitor searches

#### Tasks
- [ ] **T11**: Build saved searches UI
- [ ] **T12**: Implement digest generation

#### Definition of Done
- [ ] "Save Search" button appears in search UI
- [ ] Named searches appear in sidebar
- [ ] Click saved search re-runs with filters
- [ ] Digest job runs weekly (configurable)
- [ ] Digest shows count of new matches + preview

#### Dependencies
- T10 (saved_searches model)

---

### Sprint 6: Conversation Threads
**Duration**: Week 6
**Goal**: Link related conversations

#### Tasks
- [ ] **T14**: Build thread linking UI
- [ ] Auto-suggest thread relationships (bonus)

#### Definition of Done
- [ ] UI to link conversation to thread
- [ ] Create new thread from link dialog
- [ ] Thread view shows all conversations in order
- [ ] Visual indicator in conversation list for threaded convs
- [ ] "Fork" option creates new thread with link to original

#### Dependencies
- T13 (threading model)

---

### Sprint 7: Polish Features
**Duration**: Week 7
**Goal**: Summaries, analytics, and additional polish

#### Tasks
- [ ] **T15**: Implement conversation summarization
- [ ] **T16**: Build analytics dashboard

#### Definition of Done
- [ ] Summary button generates key points
- [ ] Summary editable by user
- [ ] Analytics shows conversations by platform (chart)
- [ ] Analytics shows volume over time
- [ ] Export analytics as CSV

#### Dependencies
- T7 (knowledge UI for summary display)

---

### Sprint 8: Testing & Documentation
**Duration**: Week 8
**Goal**: Ensure quality and document features

#### Tasks
- [ ] **T19**: E2E tests for knowledge extraction
- [ ] **T20**: Performance testing for Smart Context
- [ ] **T21**: Documentation update

#### Definition of Done
- [ ] 80% test coverage for new code
- [ ] E2E tests pass for code/prompt/decision extraction
- [ ] Smart Context latency < 200ms verified
- [ ] README updated with new features
- [ ] API documentation updated
- [ ] User guide created for knowledge features

#### Dependencies
- All implementation tasks

---

## Task Dependencies Graph

```
T1 (Design)
  └── T2 (knowledge_items table)
        ├── T3 (code extraction)
        ├── T4 (prompt extraction)
        ├── T5 (decision extraction)
        │     └── T6 (knowledge API)
        │           └── T7 (knowledge UI)
        │
        └── T8 (Smart Context logic)
              └── T9 (Smart Context UI)

T17 (Background queue)
  ├── T3, T4, T5 (extraction pipelines)
  └── T18 (batch migration)

T10 (saved_searches table)
  ├── T11 (saved searches UI)
  └── T12 (digest generation)

T13 (threading model)
  └── T14 (thread linking UI)

T15 (summarization) → T7
T16 (analytics) → (none)

All → T19, T20, T21 (Testing/Docs)
```

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| LanceDB migration complexity | High | Test migrations thoroughly; keep backups |
| Extraction performance | Medium | Process in background; show progress |
| Vector similarity quality | Medium | Tune thresholds; allow user feedback |
| UI complexity | Low | Reuse existing components; follow patterns |

## Definition of Done (Global)

For the entire release:
- [ ] All P0 features implemented
- [ ] Test coverage ≥ 80%
- [ ] Smart Context latency p95 < 200ms
- [ ] No P0/P1 bugs open
- [ ] Documentation complete
- [ ] Migration tested on production-like data
