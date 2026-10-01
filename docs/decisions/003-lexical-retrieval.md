# ADR 003: Lexical retrieval before embeddings

Status: accepted.

A small technical corpus contains meaningful shared terminology. Free demo setup and inspectable ranking matter more than speculative semantic-search infrastructure.

Use indexed PostgreSQL English full-text ranking, then a pure context selector with source diversity, deduplication, a passage cap, and an estimated token budget. Preserve source IDs and excerpt snapshots for citation inspection.

This can miss paraphrases and non-English queries. It does not rank by semantic similarity. Build a labeled retrieval benchmark first; introduce pgvector and hybrid ranking only when measured recall gains justify embedding cost and lifecycle complexity.
