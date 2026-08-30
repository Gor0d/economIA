const test = require("node:test");
const assert = require("node:assert/strict");
const { comparePrices, listModels } = require("../api/_comparison.js");

test("API ordena resultados por custo e calcula baseline", () => {
  const result = comparePrices({ inputTokens: 1_000_000, outputTokens: 100_000, baselineModelId: "gpt-5" });
  assert.ok(result.results.length > 30);
  assert.equal(result.results[0].modelId, result.cheapest.modelId);
  assert.equal(result.baseline.modelId, "gpt-5");
  assert.ok(result.results.every((row, index, rows) => index === 0 || rows[index - 1].costUsd <= row.costUsd));
});

test("API rejeita modelo e tokens inválidos", () => {
  assert.throws(() => comparePrices({ inputTokens: -1, outputTokens: 0 }), /inputTokens/);
  assert.throws(() => comparePrices({ inputTokens: 1, outputTokens: 1, baselineModelId: "inexistente" }), /não encontrado/);
});

test("catálogo pode ser filtrado por provedor", () => {
  const result = listModels("OpenAI");
  assert.ok(result.count > 0);
  assert.ok(result.models.every((model) => model.provider === "OpenAI"));
});
