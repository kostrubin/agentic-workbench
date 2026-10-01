# ADR 002: One PostgreSQL database

Status: accepted.

The product needs transactions, ownership boundaries, durable execution records, and source retrieval. PostgreSQL can provide these together without introducing a vector database or queue prematurely.

Use Drizzle for typed queries and versioned SQL migrations for reviewed DDL. Native full-text search provides a real indexed retrieval path. A partial unique index prevents concurrent active runs per task. Citation excerpts are immutable JSONB run snapshots.

Local setup requires Docker; this is a deliberate cost for testing the same relational behavior used by the application. Request-bound execution is not a durable job queue. A future worker can retain this database as its source of truth.
