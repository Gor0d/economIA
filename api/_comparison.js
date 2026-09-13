const { PRICING, PRICING_META } = require("../js/pricing.js");
const { calcCost, effectiveRates, MAX_TOKENS_PER_SCENARIO } = require("../js/calculator.js");

function httpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

const ALLOWED_COMPARE_FIELDS = new Set([
  "inputTokens",
  "outputTokens",
  "baselineModelId",
  "batch",
  "provider",
  "limit",
]);

function finiteTokens(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX_TOKENS_PER_SCENARIO) {
    throw httpError(400, `${field} deve ser um número entre 0 e ${MAX_TOKENS_PER_SCENARIO}.`);
  }
  return value;
}

function validateCompareInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw httpError(400, "O corpo deve ser um objeto JSON.");
  }
  const unknownFields = Object.keys(input).filter((field) => !ALLOWED_COMPARE_FIELDS.has(field));
  if (unknownFields.length > 0) {
    throw httpError(400, "Campos não reconhecidos.", { unknownFields });
  }
  if (input.baselineModelId !== undefined && typeof input.baselineModelId !== "string") {
    throw httpError(400, "baselineModelId deve ser uma string.");
  }
  if (input.batch !== undefined && typeof input.batch !== "boolean") {
    throw httpError(400, "batch deve ser booleano.");
  }
  if (input.provider !== undefined && typeof input.provider !== "string") {
    throw httpError(400, "provider deve ser uma string.");
  }
  if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > PRICING.length)) {
    throw httpError(400, `limit deve ser um inteiro entre 1 e ${PRICING.length}.`);
  }
}

function comparePrices(input = {}) {
  validateCompareInput(input);
  const inputTokens = finiteTokens(input.inputTokens, "inputTokens");
  const outputTokens = finiteTokens(input.outputTokens, "outputTokens");
  const batch = input.batch === true;
  const provider = input.provider?.trim() || null;
  const normalizedProvider = provider?.toLocaleLowerCase("pt-BR");
  const baseline = input.baselineModelId
    ? PRICING.find((model) => model.id === input.baselineModelId)
    : null;

  if (input.baselineModelId && !baseline) {
    throw httpError(400, "baselineModelId não encontrado.", {
      validModelIds: PRICING.map((model) => model.id),
    });
  }
  if (provider && !PRICING.some((model) => model.provider.toLocaleLowerCase("pt-BR") === normalizedProvider)) {
    throw httpError(400, "provider não encontrado.", {
      validProviders: [...new Set(PRICING.map((model) => model.provider))],
    });
  }

  const baselineCost = baseline ? calcCost(baseline, inputTokens, outputTokens, { batch }) : null;
  const results = PRICING.filter(
    (model) => !normalizedProvider || model.provider.toLocaleLowerCase("pt-BR") === normalizedProvider
  ).map((model) => {
    const costUsd = calcCost(model, inputTokens, outputTokens, { batch });
    const rates = effectiveRates(model, { batch });
    return {
      modelId: model.id,
      provider: model.provider,
      model: model.name,
      costUsd,
      inputUsdPerMillion: rates.input,
      outputUsdPerMillion: rates.output,
      batchApplied: batch && typeof model.batchDiscount === "number",
      differenceFromBaselineUsd: baselineCost === null ? null : costUsd - baselineCost,
      savingsVsBaselinePercent:
        baselineCost > 0 ? ((baselineCost - costUsd) / baselineCost) * 100 : null,
      note: model.note || null,
    };
  }).sort((a, b) => a.costUsd - b.costUsd || a.model.localeCompare(b.model))
    .slice(0, input.limit || PRICING.length);

  return {
    input: { inputTokens, outputTokens, batch, baselineModelId: baseline?.id || null, provider, limit: input.limit || null },
    pricing: {
      currency: "USD",
      unit: "per 1M tokens",
      reviewedAt: PRICING_META.updatedAt,
      sources: PRICING_META.sources,
    },
    cheapest: results[0] || null,
    baseline: baseline
      ? { modelId: baseline.id, provider: baseline.provider, model: baseline.name, costUsd: baselineCost }
      : null,
    results,
    disclaimer: "Estimativa com o mesmo volume de tokens em todos os modelos; cache, impostos e taxas por requisição não estão incluídos.",
  };
}

function listModels(provider) {
  const normalized = provider ? String(provider).toLocaleLowerCase("pt-BR") : null;
  return {
    reviewedAt: PRICING_META.updatedAt,
    count: PRICING.filter((model) => !normalized || model.provider.toLocaleLowerCase("pt-BR") === normalized).length,
    models: PRICING.filter((model) => !normalized || model.provider.toLocaleLowerCase("pt-BR") === normalized),
    sources: PRICING_META.sources,
  };
}

module.exports = { comparePrices, httpError, listModels, validateCompareInput };
