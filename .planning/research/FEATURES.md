# Feature Landscape

**Domain:** Personal Search / Knowledge Management
**Researched:** 2026-02-05

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Full-Text Search** | Basic keyword matching is the baseline. | Medium | SQLite FTS5 handles this well. |
| **Semantic Search** | "Find me that thing about the dog" -> Matches "Puppy article". | High | Requires Vector DB + Embedding Model. |
| **Ingest from Browser** | "Save this page" button. | Low | Extension content script. |
| **Dark Mode** | Developer audience requirement. | Low | Tailwind classes. |

## Differentiators

Features that set product apart.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **"Time Travel" Context** | "Show me what I was looking at yesterday morning". | Medium | Requires tracking visit history timestamps. |
| **App Integrations** | Search Notion, Slack, Discord alongside web history. | High | OAuth dances + API rate limits. |
| **Local-Only Privacy** | "My data never leaves my machine". | N/A | Architectural decision, major selling point. |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Cloud Sync (MVP)** | Complex, expensive, privacy risks. | Build robust Local Import/Export first. |
| **Social Sharing** | It's a *personal* search engine. | Focus on individual utility. |
| **Full Web Crawling** | You are not Google. Disk space/bandwidth killer. | Only index pages the user explicitly visits or bookmarks. |

## MVP Recommendation

For MVP, prioritize:
1.  **Ingest API:** Receive HTML/Text.
2.  **Vector Pipeline:** Text -> Embedding -> LanceDB.
3.  **Search UI:** Simple list of results.
4.  **Extension Capture:** "Save Page" button.

Defer to post-MVP:
- Auto-ingest history (too noisy).
- Chat with your data (RAG) - focus on *retrieval* first.
