const { PRICING, PRICING_META } = require("../pricing.js");
const { calcCost, effectiveRates, MAX_TOKENS_PER_SCENARIO } = require("../calculator.js");

function httpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function finiteTokens(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > MAX_TOKENS_PER_SCENARIO) {
    throw httpError(400, `${field} deve ser um número entre 0 e ${MAX_TOKENS_PER_SCENARIO}.`);
  }
  return number;
}

function comparePrices(input = {}) {
  const inputTokens = finiteTokens(input.inputTokens, "inputTokens");
  const outputTokens = finiteTokens(input.outputTokens, "outputTokens");
  const batch = input.batch === true;
  const baseline = input.baselineModelId
    ? PRICING.find((model) => model.id === input.baselineModelId)
    : null;

  if (input.baselineModelId && !baseline) {
    throw httpError(400, "baselineModelId não encontrado.", {
      validModelIds: PRICING.map((model) => model.id),
    });
  }

  const baselineCost = baseline ? calcCost(baseline, inputTokens, outputTokens, { batch }) : null;
  const results = PRICING.map((model) => {
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
  }).sort((a, b) => a.costUsd - b.costUsd || a.model.localeCompare(b.model));

  return {
    input: { inputTokens, outputTokens, batch, baselineModelId: baseline?.id || null },
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

module.exports = { comparePrices, httpError, listModels };
