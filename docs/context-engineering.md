# Context engineering

## Ingestion

The server checks both body length and actual received bytes, allows only TXT/MD/PDF uploads, and sanitizes display filenames. Files are never written to arbitrary filesystem paths. PDF headers must match; encrypted/unreadable PDFs fail with a useful error. The PDF parser extracts text, with a maximum of 100 pages and 150,000 resulting characters. It does not OCR scanned pages or preserve spatial table structure. Parser isolation and hard memory budgets remain deployment work.

Normalization applies Unicode NFKC, normalizes newlines, removes control characters, and preserves paragraphs. Chunks combine paragraphs up to 1,200 characters. Long paragraphs split at whitespace, or at the hard boundary for unbroken text. Chunks do not overlap, avoiding repeated evidence; that choice can lose context across a boundary. Ordinals allow future adjacent-section expansion.

A transaction persists a document and all of its chunks together. A workspace/content-hash uniqueness constraint prevents duplicate copies. The original file binary is not retained; the normalized text is the source record.

## Retrieval

The planner's query is limited to 1,500 characters. Retrieval selects at most 32 distinct alphanumeric query terms, removes a small stop list, and parameterizes an OR `tsquery`. PostgreSQL stemming with the `english` dictionary provides word-form matching. OR matching favors recall; `ts_rank_cd` orders candidates by cover density. The database restricts the query by workspace before ranking and returns at most 40 candidates.

This is lexical retrieval, not embeddings and not a claim of semantic RAG. It is inspectable, cheap, reproducible, and sufficient for the seeded decision brief. Paraphrases, acronyms, multilingual documents, and very short queries are weaknesses. Only measured recall failures should motivate embeddings.

## Context selection

The pure context builder:

1. Rejects nonpositive relevance and sorts deterministically by score then ID.
2. Tries the highest-ranked fitting passage from each source first.
3. Adds remaining passages by relevance.
4. Deduplicates normalized text even across different sources.
5. Stops at eight passages and a 2,400 estimated-token evidence budget.

A passage cost is `ceil((text + title).length / 3) + 24`, a conservative character-based estimate for the English corpus. This is not a tokenizer guarantee for all languages. Oversized passages are skipped rather than clipped into misleading citations. Each selected passage receives a sequential label and an immutable excerpt snapshot.

The budget applies to evidence, not the entire request. User prompt length, comparison result size (eight rows), structured plan output (500 tokens), synthesis output (2,200 tokens), and tool operands are separately bounded. In practice JSON encoding and system instructions add overhead. A strict model-specific budget would use that model's tokenizer and account for the entire serialized request.

## Citation guarantees

Only selected source labels can be referenced. Output containing unknown numeric citations is marked failed. If evidence was supplied but no citations appear, the run also fails. The UI never fabricates a link for an unknown label.

Validation proves reference membership and presence, **not entailment, factual correctness, or completeness**. An answer may cite a real but irrelevant passage. A future evidence evaluation must measure claim support, abstention, and conflict handling against labeled examples. A failed/partial result remains visible with an explicit unverified status.

## Evaluation examples

The corpus deliberately conflicts: $650 vs $1,850 estimates, one release pipeline vs independent services, and an eight-week launch vs a 12–16 week migration. A risk register states that the growth target is not benchmarked. The deterministic recommendation should preserve that uncertainty. The evaluation checks this property instead of pretending a forecast proves capacity.
