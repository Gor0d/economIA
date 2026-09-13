import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { compareOutputSchema, modelsOutputSchema } from "../api/mcp.mjs";

const require = createRequire(import.meta.url);
const { comparePrices, listModels } = require("../api/_comparison.js");
const { PRICING } = require("../js/pricing.js");

test("schema MCP aceita o resultado estruturado da comparação", () => {
  const result = comparePrices({
    inputTokens: 1_000_000,
    outputTokens: 100_000,
    baselineModelId: "gpt-5",
    limit: Math.min(10, PRICING.length),
  });

  assert.equal(compareOutputSchema.safeParse(result).success, true);
});

test("schema MCP aceita o catálogo completo e filtrado", () => {
  assert.equal(modelsOutputSchema.safeParse(listModels()).success, true);
  assert.equal(modelsOutputSchema.safeParse(listModels("OpenAI")).success, true);
});

test("limite aceito pela API acompanha o tamanho do catálogo", () => {
  const result = comparePrices({ inputTokens: 1, outputTokens: 1, limit: PRICING.length });
  assert.equal(result.results.length, PRICING.length);
});
