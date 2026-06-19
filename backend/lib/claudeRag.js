const DEFAULT_MODELS = {
  opus: "claude-opus-4-8",
  sonnet: "claude-sonnet-4-6",
  haiku: "claude-haiku-4-5",
};

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have", "how",
  "i", "in", "is", "it", "me", "of", "on", "or", "that", "the", "this", "to", "was",
  "what", "when", "where", "which", "who", "with", "you",
]);

function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9₹%./-]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function cosineSimilarity(a = [], b = []) {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator ? dot / denominator : 0;
}

function lexicalScore(question, text) {
  const queryTokens = [...new Set(tokenize(question))];
  if (!queryTokens.length) return 0;
  const content = String(text || "").toLowerCase();
  const contentTokens = new Set(tokenize(content));
  const matched = queryTokens.filter((token) => contentTokens.has(token)).length;
  const identifiers = queryTokens.filter((token) => /\d|[%₹./-]/.test(token));
  const identifierMatches = identifiers.filter((token) => content.includes(token)).length;
  const phrase = String(question || "").trim().toLowerCase();
  const phraseBoost = phrase.length >= 8 && content.includes(phrase) ? 0.35 : 0;
  return Math.min(1, matched / queryTokens.length + identifierMatches * 0.12 + phraseBoost);
}

function similarityKey(text) {
  return tokenize(text).slice(0, 90).join(" ");
}

function jaccard(left, right) {
  const a = new Set(left.split(" ").filter(Boolean));
  const b = new Set(right.split(" ").filter(Boolean));
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap += 1;
  return overlap / (a.size + b.size - overlap);
}

function routeClaudeModel(question, documentCount = 1, preference = "auto") {
  const requested = String(preference || "auto").toLowerCase();
  if (["opus", "sonnet", "haiku"].includes(requested)) {
    return { tier: requested, reason: "User-selected model" };
  }

  const value = String(question || "").trim();
  const complex = /\b(compare|contrast|audit|reconcile|contradiction|discrepanc|risk|root cause|deep analysis|comprehensive|across (?:all|the) documents|synthesi[sz]e|strategy|legal|financial analysis)\b/i.test(value);
  const crossDocument = documentCount > 1 && /\b(all|across|between|compare|combined|overall|documents|sources)\b/i.test(value);
  const quickLookup = /^(what|when|where|who|which|how many|find|list|give me|show me|does|is|are)\b/i.test(value)
    && value.length < 180;

  if (complex || crossDocument || value.length > 650) {
    return { tier: "opus", reason: complex ? "Complex analytical query" : "Cross-document synthesis" };
  }
  if (quickLookup) return { tier: "haiku", reason: "Focused factual lookup" };
  return { tier: "sonnet", reason: "Balanced document reasoning" };
}

function retrieveRelevantChunks({ question, queryVector, records, tier = "sonnet" }) {
  const limits = {
    haiku: { chunks: 8, chars: 24000 },
    sonnet: { chunks: 14, chars: 48000 },
    opus: { chunks: 20, chars: 76000 },
  };
  const limit = limits[tier] || limits.sonnet;
  const ranked = records
    .map((record) => {
      const semantic = (cosineSimilarity(queryVector, record.embedding) + 1) / 2;
      const lexical = lexicalScore(question, record.text);
      return { ...record, semantic, lexical, score: semantic * 0.74 + lexical * 0.26 };
    })
    .filter((record) => Number.isFinite(record.score))
    .sort((left, right) => right.score - left.score);

  if (!ranked.length) return [];
  const floor = Math.max(0.2, ranked[0].score - 0.22);
  const selected = [];
  const keys = [];
  const perDocument = new Map();
  let characters = 0;

  for (const record of ranked) {
    if (selected.length >= limit.chunks || record.score < floor) break;
    const text = String(record.text || "").trim();
    if (!text) continue;
    const key = similarityKey(text);
    if (keys.some((existing) => jaccard(existing, key) > 0.86)) continue;
    const usedForDocument = perDocument.get(record.docId) || 0;
    const perDocumentLimit = Math.max(5, Math.ceil(limit.chunks * 0.65));
    if (usedForDocument >= perDocumentLimit) continue;
    if (characters + text.length > limit.chars && selected.length >= 4) continue;
    selected.push(record);
    keys.push(key);
    perDocument.set(record.docId, usedForDocument + 1);
    characters += text.length;
  }

  return selected.length >= 4 ? selected : ranked.slice(0, Math.min(4, ranked.length));
}

function modelIdForTier(tier) {
  const key = `CLAUDE_${tier.toUpperCase()}_MODEL`;
  return process.env[key] || DEFAULT_MODELS[tier] || DEFAULT_MODELS.sonnet;
}

async function callClaude({ question, matches, tier, routingReason }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const error = new Error("ANTHROPIC_API_KEY is not configured in backend/.env");
    error.statusCode = 503;
    throw error;
  }

  const model = modelIdForTier(tier);
  const context = matches.map((match, index) => (
    `[Source ${index + 1}: ${match.documentName || match.docId}, chunk ${match.chunkId ?? "?"}]\n${match.text}`
  )).join("\n\n---\n\n");
  const maxTokens = tier === "haiku" ? 1400 : tier === "opus" ? 4000 : 2600;
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.1,
      system: [
        "You are the document intelligence assistant for UIPL Docs.",
        "Answer only from the supplied retrieved context.",
        "Be precise with names, dates, quantities, statuses, and currency values.",
        "When multiple sources disagree, state the disagreement instead of choosing silently.",
        "Cite supporting chunks inline as [Source 1], [Source 2], etc.",
        "If the context is insufficient, say exactly what could not be verified.",
        "Do not mention model routing or retrieval mechanics unless asked.",
      ].join(" "),
      messages: [{
        role: "user",
        content: `Retrieved document context:\n\n${context}\n\nQuestion:\n${question}\n\nProvide a direct, well-structured answer with source citations.`,
      }],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `Anthropic API request failed with status ${response.status}`;
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }
  const answer = (payload.content || []).filter((block) => block.type === "text").map((block) => block.text).join("\n").trim();
  return { answer: answer || "Claude returned an empty response.", model: payload.model || model, tier, routingReason };
}

module.exports = {
  DEFAULT_MODELS,
  callClaude,
  cosineSimilarity,
  lexicalScore,
  modelIdForTier,
  retrieveRelevantChunks,
  routeClaudeModel,
};
