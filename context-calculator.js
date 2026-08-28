(function initContextCalculator(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.ContextCalculator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createContextCalculator() {
  const SECTION_OVERHEAD_TOKENS = 4;
  const CHARS_PER_TOKEN = Object.freeze({ OpenAI: 3.6, Anthropic: 3.15, Google: 3.7 });

  /** @typedef {{system:string, history:string, documents:string, tools:string, current:string}} ContextSections */
  /** @typedef {{input_tokens:number, cached_tokens:number, cache_write_tokens:number, output_tokens:number, reasoning_tokens:number}} NormalizedUsage */

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function estimateTextTokens(text, provider = "OpenAI") {
    const normalized = String(text || "").trim();
    if (!normalized) return 0;

    const codePoints = Array.from(normalized).length;
    const words = normalized.split(/\s+/u).filter(Boolean).length;
    const charsEstimate = Math.ceil(codePoints / (CHARS_PER_TOKEN[provider] || 3.6));
    const wordsEstimate = Math.ceil(words * 1.28);
    return Math.max(1, charsEstimate, wordsEstimate) + SECTION_OVERHEAD_TOKENS;
  }

  function estimateSections(sections, provider) {
    const tokens = Object.fromEntries(
      Object.entries(sections).map(([key, value]) => [key, estimateTextTokens(value, provider)])
    );
    const total = Object.values(tokens).reduce((sum, value) => sum + value, 0);
    return { sections: tokens, total };
  }

  function effectiveRates(model, inputTokens) {
    const longContext = Boolean(model.longContext && inputTokens > model.longContext.threshold);
    const inputMultiplier = longContext ? model.longContext.inputMultiplier : 1;
    const outputMultiplier = longContext ? model.longContext.outputMultiplier : 1;

    return {
      input: model.input * inputMultiplier,
      cachedInput: model.cachedInput * inputMultiplier,
      cacheWrite: typeof model.cacheWrite === "number" ? model.cacheWrite * inputMultiplier : null,
      output: model.output * outputMultiplier,
      longContext,
    };
  }

  function estimateCall({ model, inputTokens, outputTokens, cachePercent = 0 }) {
    const safeInput = Math.max(0, Number(inputTokens) || 0);
    const safeOutput = Math.max(0, Number(outputTokens) || 0);
    const safeCachePercent = clamp(Number(cachePercent) || 0, 0, 100);
    const cachedTokens = Math.round(safeInput * (safeCachePercent / 100));
    const uncachedTokens = safeInput - cachedTokens;
    const rates = effectiveRates(model, safeInput);

    const costWithoutCache = (safeInput * rates.input) / 1_000_000;
    const cacheReadCost = (cachedTokens * rates.cachedInput) / 1_000_000;
    const uncachedRate = rates.cacheWrite ?? rates.input;
    const uncachedCost = (uncachedTokens * uncachedRate) / 1_000_000;
    const costWithCache = cacheReadCost + uncachedCost;
    const outputCost = (safeOutput * rates.output) / 1_000_000;

    return {
      inputTokens: safeInput,
      outputTokens: safeOutput,
      cachedTokens,
      uncachedTokens,
      cacheWriteTokens: rates.cacheWrite === null ? 0 : uncachedTokens,
      costWithoutCache,
      cacheReadCost,
      uncachedCost,
      costWithCache,
      outputCost,
      totalWithoutCache: costWithoutCache + outputCost,
      totalWithCache: costWithCache + outputCost,
      contextPercent: model.contextWindow > 0 ? (safeInput / model.contextWindow) * 100 : 0,
      rates,
    };
  }

  function estimateOutputScenarios({ model, inputTokens, cachePercent, minimum, probable, maximum }) {
    return {
      minimum: estimateCall({ model, inputTokens, cachePercent, outputTokens: minimum }),
      probable: estimateCall({ model, inputTokens, cachePercent, outputTokens: probable }),
      maximum: estimateCall({ model, inputTokens, cachePercent, outputTokens: maximum }),
    };
  }

  function projectConversation({ model, baseInputTokens, probableOutputTokens, nextPromptTokens, cachePercent, turns }) {
    const totalTurns = clamp(Math.round(Number(turns) || 1), 1, 100);
    const growthPerTurn = Math.max(0, Number(probableOutputTokens) || 0) + Math.max(0, Number(nextPromptTokens) || 0);
    let totalCost = 0;
    let lastInputTokens = 0;
    let crossedContextAt = null;

    for (let turn = 1; turn <= totalTurns; turn += 1) {
      lastInputTokens = Math.max(0, Number(baseInputTokens) || 0) + (turn - 1) * growthPerTurn;
      const estimate = estimateCall({
        model,
        inputTokens: lastInputTokens,
        outputTokens: probableOutputTokens,
        cachePercent,
      });
      totalCost += estimate.totalWithCache;
      if (crossedContextAt === null && lastInputTokens > model.contextWindow) crossedContextAt = turn;
    }

    return { turns: totalTurns, totalCost, lastInputTokens, growthPerTurn, crossedContextAt };
  }

  function buildRecommendations({ sectionTokens, model, inputTokens, cachePercent, futureProjection }) {
    const labels = {
      system: "prompt de sistema",
      history: "histórico",
      documents: "documentos",
      tools: "ferramentas e schemas",
      current: "prompt atual",
    };
    const entries = Object.entries(sectionTokens).sort((a, b) => b[1] - a[1]);
    const [largestKey, largestTokens] = entries[0] || ["current", 0];
    const recommendations = [];
    const contextPercent = model.contextWindow > 0 ? (inputTokens / model.contextWindow) * 100 : 0;
    const reusableTokens = ["system", "history", "documents", "tools"].reduce(
      (sum, key) => sum + (sectionTokens[key] || 0),
      0
    );

    if (inputTokens === 0) {
      return [{
        level: "info",
        title: "Comece montando o contexto",
        text: "Cole cada parte no campo correspondente. A estimativa acontece localmente enquanto você digita.",
      }];
    }

    recommendations.push({
      level: "info",
      title: `${labels[largestKey]} concentra mais tokens`,
      text: `${largestTokens.toLocaleString("pt-BR")} tokens estimados nessa seção. Comece a otimização por ela.`,
    });

    if (reusableTokens >= 1_000) {
      recommendations.push({
        level: cachePercent > 0 ? "success" : "warning",
        title: "Há contexto potencialmente cacheável",
        text: `${reusableTokens.toLocaleString("pt-BR")} tokens estão em seções que tendem a se repetir. Coloque conteúdo estável no início do prompt e valide o cache real na resposta da API.`,
      });
    }

    if ((sectionTokens.documents || 0) >= 10_000 || (inputTokens > 0 && sectionTokens.documents / inputTokens >= 0.35)) {
      recommendations.push({
        level: "warning",
        title: "Considere RAG para os documentos",
        text: "Recupere apenas os trechos relevantes em vez de reenviar todos os documentos integralmente a cada chamada.",
      });
    }

    if ((sectionTokens.history || 0) >= 8_000 || (inputTokens > 0 && sectionTokens.history / inputTokens >= 0.3)) {
      recommendations.push({
        level: "warning",
        title: "Compacte o histórico",
        text: "Resuma turnos antigos, preserve decisões e descarte repetições antes que cada nova chamada reenvie todo o histórico.",
      });
    }

    if (model.longContext && inputTokens > model.longContext.threshold) {
      recommendations.push({
        level: "danger",
        title: "Faixa de contexto longo ativada",
        text: `Este modelo muda a tarifa acima de ${model.longContext.threshold.toLocaleString("pt-BR")} tokens; os multiplicadores já foram aplicados.`,
      });
    }

    if (contextPercent >= 100) {
      recommendations.push({ level: "danger", title: "Contexto acima da janela", text: "A chamada provavelmente será recusada ou exigirá truncamento/compactação." });
    } else if (contextPercent >= 80) {
      recommendations.push({ level: "danger", title: "Janela de contexto quase cheia", text: "Reserve espaço para a saída, raciocínio e mensagens adicionadas pelo provedor." });
    } else if (futureProjection && futureProjection.lastInputTokens / model.contextWindow >= 0.8) {
      recommendations.push({ level: "warning", title: "A conversa crescerá perto do limite", text: "A projeção indica que o histórico reenviado poderá exigir compactação nos próximos turnos." });
    }

    return recommendations;
  }

  // Cada provedor devolve o objeto de uso real da API com um formato diferente.
  // `provider` (quando informado, a partir do modelo selecionado) decide direto;
  // sem ele, detecta pelo formato das chaves presentes — sempre cai de volta pro
  // formato OpenAI (Responses API ou Chat Completions), que é o mais comum.
  function normalizeActualUsage(usage = {}, provider) {
    const looksLikeGoogle = provider === "Google" || "usageMetadata" in usage || "promptTokenCount" in usage;
    if (looksLikeGoogle) {
      const meta = usage.usageMetadata || usage;
      return {
        input_tokens: Number(meta.promptTokenCount ?? 0),
        cached_tokens: Number(meta.cachedContentTokenCount ?? 0),
        cache_write_tokens: 0,
        output_tokens: Number(meta.candidatesTokenCount ?? 0),
        reasoning_tokens: Number(meta.thoughtsTokenCount ?? 0),
      };
    }

    const looksLikeAnthropic =
      provider === "Anthropic" || "cache_creation_input_tokens" in usage || "cache_read_input_tokens" in usage;
    if (looksLikeAnthropic) {
      // Anthropic reporta input_tokens, cache_creation_input_tokens e
      // cache_read_input_tokens como três contadores separados (não um dentro
      // do outro) — o total de input é a soma dos três.
      const cachedTokens = Number(usage.cache_read_input_tokens ?? 0);
      const cacheWriteTokens = Number(usage.cache_creation_input_tokens ?? 0);
      const baseInputTokens = Number(usage.input_tokens ?? 0);
      return {
        input_tokens: baseInputTokens + cachedTokens + cacheWriteTokens,
        cached_tokens: cachedTokens,
        cache_write_tokens: cacheWriteTokens,
        output_tokens: Number(usage.output_tokens ?? 0),
        reasoning_tokens: 0,
      };
    }

    // OpenAI: aqui input_tokens/output_tokens já são o total — os campos de
    // detalhe (*_details) são um recorte de dentro desse total, não algo a somar.
    const inputDetails = usage.input_tokens_details || usage.prompt_tokens_details || {};
    const outputDetails = usage.output_tokens_details || usage.completion_tokens_details || {};
    return {
      input_tokens: Number(usage.input_tokens ?? usage.prompt_tokens ?? 0),
      cached_tokens: Number(inputDetails.cached_tokens ?? usage.cached_tokens ?? 0),
      cache_write_tokens: Number(inputDetails.cache_write_tokens ?? usage.cache_write_tokens ?? 0),
      output_tokens: Number(usage.output_tokens ?? usage.completion_tokens ?? 0),
      reasoning_tokens: Number(outputDetails.reasoning_tokens ?? usage.reasoning_tokens ?? 0),
    };
  }

  // Custo real a partir de um usage já normalizado (normalizeActualUsage).
  // input_tokens é sempre o total (cache incluso) nos três formatos aceitos,
  // então a mesma conta serve pra OpenAI, Anthropic e Google.
  function costFromActualUsage({ model, usage }) {
    const rates = effectiveRates(model, usage.input_tokens);
    const cacheWriteRate = rates.cacheWrite ?? rates.input;
    const freshTokens = Math.max(0, usage.input_tokens - usage.cached_tokens - usage.cache_write_tokens);

    const cachedCost = (usage.cached_tokens * rates.cachedInput) / 1_000_000;
    const cacheWriteCost = (usage.cache_write_tokens * cacheWriteRate) / 1_000_000;
    const freshCost = (freshTokens * rates.input) / 1_000_000;
    const outputCost = (usage.output_tokens * rates.output) / 1_000_000;
    const inputCost = cachedCost + cacheWriteCost + freshCost;

    return { inputCost, outputCost, totalCost: inputCost + outputCost, rates };
  }

  return {
    buildRecommendations,
    costFromActualUsage,
    effectiveRates,
    estimateCall,
    estimateOutputScenarios,
    estimateSections,
    estimateTextTokens,
    normalizeActualUsage,
    projectConversation,
  };
});
