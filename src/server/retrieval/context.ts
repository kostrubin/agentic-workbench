import type { Chunk, Citation } from "../../lib/types";
export const estimateTokens = (text: string) => Math.ceil(text.length / 3);
export function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
export function chunkText(text: string, maxChars = 1200): string[] {
  if (maxChars < 100) throw new Error("Chunk size too small");
  const paragraphs = normalize(text).split(/\n\s*\n/);
  const result: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (!paragraph) continue;
    if (current && current.length + paragraph.length + 2 > maxChars) {
      result.push(current);
      current = "";
    }
    let remaining = paragraph;
    while (remaining.length > maxChars) {
      const boundary = remaining.lastIndexOf(" ", maxChars);
      const end = boundary > maxChars / 2 ? boundary : maxChars;
      result.push(remaining.slice(0, end));
      remaining = remaining.slice(end).trimStart();
    }
    current = current ? current + "\n\n" + remaining : remaining;
  }
  if (current) result.push(current);
  return result;
}
export function queryTerms(query: string): string[] {
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "what",
    "which",
    "how",
    "are",
    "our",
    "can",
    "should",
    "please",
    "cite",
    "relevant",
  ]);
  return [...new Set(query.toLowerCase().match(/[a-z0-9]{2,}/g) ?? [])]
    .filter((t) => !stop.has(t))
    .slice(0, 32);
}
export function buildContext(candidates: Chunk[], tokenBudget = 2400) {
  const ranked = [...candidates]
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const selected: Chunk[] = [],
    seen = new Set<string>(),
    sources = new Set<string>();
  let tokens = 0;
  const take = (chunk: Chunk) => {
    const key = normalize(chunk.text).toLowerCase();
    const cost = estimateTokens(chunk.text + chunk.title) + 24;
    if (seen.has(key) || tokens + cost > tokenBudget || selected.length >= 8)
      return;
    selected.push(chunk);
    seen.add(key);
    sources.add(chunk.documentId);
    tokens += cost;
  };
  for (const chunk of ranked) if (!sources.has(chunk.documentId)) take(chunk);
  for (const chunk of ranked) take(chunk);
  const citations: Citation[] = selected.map((chunk, i) => ({
    label: i + 1,
    chunkId: chunk.id,
    documentId: chunk.documentId,
    title: chunk.title,
    excerpt: chunk.text,
  }));
  return {
    chunks: selected,
    citations,
    tokens,
    text: citations
      .map((c) => `[${c.label}] ${c.title}\n${c.excerpt}`)
      .join("\n\n"),
  };
}
export function validateCitations(
  answer: string,
  citations: Citation[],
): Citation[] {
  const labels = [...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  if (labels.some((label) => !citations.some((c) => c.label === label)))
    throw new Error(
      "The answer referenced evidence outside the selected context.",
    );
  if (citations.length && !labels.length)
    throw new Error("The answer did not cite its evidence.");
  return citations.filter((c) => labels.includes(c.label));
}
