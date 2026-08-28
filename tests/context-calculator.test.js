const test = require("node:test");
const assert = require("node:assert/strict");

const { CONTEXT_MODELS, CONTEXT_PRICING_META } = require("../context-models.js");
const { PRICING } = require("../pricing.js");
const {
  buildRecommendations,
  estimateCall,
  estimateSections,
  estimateTextTokens,
  normalizeActualUsage,
  projectConversation,
} = require("../context-calculator.js");

function model(id) {
  return CONTEXT_MODELS.find((item) => item.id === id);
}

test("estima tokens localmente e separa cada parte do contexto", () => {
  assert.equal(estimateTextTokens("", "OpenAI"), 0);
  assert.ok(estimateTextTokens("Explique este contrato em português.", "OpenAI") > 4);

  const result = estimateSections(
    { system: "Seja objetivo.", history: "", documents: "Contrato de teste", tools: "", current: "Resuma." },
    "Anthropic"
  );
  assert.equal(result.sections.history, 0);
  assert.equal(result.total, result.sections.system + result.sections.documents + result.sections.current);
});

test("calcula leitura e gravação de cache separadamente", () => {
  const result = estimateCall({
    model: model("claude-sonnet-5"),
    inputTokens: 1_000_000,
    outputTokens: 100_000,
    cachePercent: 50,
  });

  assert.equal(result.cachedTokens, 500_000);
  assert.equal(result.cacheWriteTokens, 500_000);
  assert.equal(result.costWithoutCache, 2);
  assert.equal(result.cacheReadCost, 0.1);
  assert.equal(result.uncachedCost, 1.25);
  assert.equal(result.outputCost, 1);
  assert.equal(result.totalWithCache, 2.35);
});

test("aplica a faixa de contexto longo à requisição inteira", () => {
  const result = estimateCall({
    model: model("gpt-5.6-sol"),
    inputTokens: 300_000,
    outputTokens: 10_000,
    cachePercent: 0,
  });

  assert.equal(result.rates.longContext, true);
  assert.equal(result.rates.input, 8);
  assert.equal(result.rates.cacheWrite, 10);
  assert.equal(result.rates.output, 30);
  assert.equal(result.totalWithCache, 3.3);
});

test("projeta o reenvio e crescimento do histórico a cada turno", () => {
  const result = projectConversation({
    model: model("gemini-3.7-flash"),
    baseInputTokens: 1_000,
    probableOutputTokens: 500,
    nextPromptTokens: 100,
    cachePercent: 0,
    turns: 3,
  });

  assert.equal(result.growthPerTurn, 600);
  assert.equal(result.lastInputTokens, 2_200);
  assert.equal(result.crossedContextAt, null);
  assert.ok(result.totalCost > 0);
});

test("gera recomendações de RAG, compactação, cache e limite", () => {
  const recommendations = buildRecommendations({
    sectionTokens: { system: 2_000, history: 60_000, documents: 90_000, tools: 1_000, current: 500 },
    model: model("claude-haiku-4-5"),
    inputTokens: 153_500,
    cachePercent: 40,
    futureProjection: { lastInputTokens: 190_000 },
  });
  const titles = recommendations.map((item) => item.title).join(" | ");

  assert.match(titles, /RAG/);
  assert.match(titles, /Compacte/);
  assert.match(titles, /cacheável/);
  assert.match(titles, /perto do limite/);
});

test("normaliza objetos usage atuais e legados sem somar reasoning duas vezes", () => {
  assert.deepEqual(
    normalizeActualUsage({
      input_tokens: 1200,
      input_tokens_details: { cached_tokens: 800, cache_write_tokens: 200 },
      output_tokens: 500,
      output_tokens_details: { reasoning_tokens: 300 },
    }),
    { input_tokens: 1200, cached_tokens: 800, cache_write_tokens: 200, output_tokens: 500, reasoning_tokens: 300 }
  );
});

test("catálogo de contexto tem fontes oficiais e não diverge dos preços-base", () => {
  assert.equal(CONTEXT_PRICING_META.updatedAt, "2026-08-28");
  for (const source of Object.values(CONTEXT_PRICING_META.sources)) assert.match(source, /^https:\/\//);

  for (const contextModel of CONTEXT_MODELS) {
    const baseModel = PRICING.find((item) => item.id === contextModel.id);
    assert.ok(baseModel, contextModel.id);
    assert.equal(contextModel.input, baseModel.input, `${contextModel.id} input`);
    assert.equal(contextModel.output, baseModel.output, `${contextModel.id} output`);
    assert.ok(contextModel.contextWindow > 0, contextModel.id);
    assert.ok(contextModel.cachedInput >= 0, contextModel.id);
  }
});
