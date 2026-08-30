(function initContextCatalog(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.ContextCatalog = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createContextCatalog() {
  const CONTEXT_PRICING_META = Object.freeze({
    updatedAt: "2026-08-28",
    unit: "USD por 1 milhão de tokens",
    sources: Object.freeze({
      OpenAI: "https://developers.openai.com/api/docs/models/compare",
      Anthropic: "https://platform.claude.com/docs/en/about-claude/pricing",
      Google: "https://ai.google.dev/gemini-api/docs/pricing",
    }),
  });

  /**
   * Catálogo focado em contexto. Valores são preços Standard da API direta,
   * por 1 milhão de tokens. cacheWrite representa a gravação explícita do
   * prefixo quando o provedor publica uma tarifa separada.
   */
  const CONTEXT_MODELS = [
    {
      id: "gpt-5.6-sol",
      provider: "OpenAI",
      name: "GPT-5.6 Sol",
      contextWindow: 1_050_000,
      maxOutput: 128_000,
      input: 4,
      cachedInput: 0.4,
      cacheWrite: 5,
      output: 20,
      longContext: { threshold: 272_000, inputMultiplier: 2, outputMultiplier: 1.5 },
      note: "Preço promocional vigente; acima de 272k tokens a requisição inteira muda de faixa.",
    },
    {
      id: "gpt-5.6-terra",
      provider: "OpenAI",
      name: "GPT-5.6 Terra",
      contextWindow: 1_050_000,
      maxOutput: 128_000,
      input: 2,
      cachedInput: 0.2,
      cacheWrite: 2.5,
      output: 12,
      longContext: { threshold: 272_000, inputMultiplier: 2, outputMultiplier: 1.5 },
    },
    {
      id: "gpt-5.6-luna",
      provider: "OpenAI",
      name: "GPT-5.6 Luna",
      contextWindow: 1_050_000,
      maxOutput: 128_000,
      input: 0.2,
      cachedInput: 0.02,
      cacheWrite: 0.25,
      output: 1.2,
      longContext: { threshold: 272_000, inputMultiplier: 2, outputMultiplier: 1.5 },
    },
    {
      id: "claude-sonnet-5",
      provider: "Anthropic",
      name: "Claude Sonnet 5",
      contextWindow: 1_000_000,
      maxOutput: 128_000,
      input: 2,
      cachedInput: 0.2,
      cacheWrite: 2.5,
      output: 10,
      note: "Gravação de cache considerada com TTL de 5 minutos.",
    },
    {
      id: "claude-opus-5",
      provider: "Anthropic",
      name: "Claude Opus 5",
      contextWindow: 1_000_000,
      maxOutput: 128_000,
      input: 5,
      cachedInput: 0.5,
      cacheWrite: 6.25,
      output: 25,
      note: "Gravação de cache considerada com TTL de 5 minutos.",
    },
    {
      id: "claude-haiku-4-5",
      provider: "Anthropic",
      name: "Claude Haiku 4.5",
      contextWindow: 200_000,
      maxOutput: 64_000,
      input: 1,
      cachedInput: 0.1,
      cacheWrite: 1.25,
      output: 5,
      note: "Gravação de cache considerada com TTL de 5 minutos.",
    },
    {
      id: "gemini-3.7-flash",
      provider: "Google",
      name: "Gemini 3.7 Flash",
      contextWindow: 1_048_576,
      maxOutput: 65_536,
      input: 0.75,
      cachedInput: 0.075,
      cacheWrite: null,
      cacheStoragePerMillionHour: 0.5,
      output: 3.75,
      note: "Preço promocional até 31/12/2026; armazenamento de cache é cobrado à parte.",
    },
    {
      id: "gemini-3.5-flash",
      provider: "Google",
      name: "Gemini 3.5 Flash",
      contextWindow: 1_048_576,
      maxOutput: 65_536,
      input: 1.5,
      cachedInput: 0.15,
      cacheWrite: null,
      cacheStoragePerMillionHour: 1,
      output: 9,
      note: "Armazenamento de cache é cobrado à parte.",
    },
    {
      id: "gemini-3.1-pro",
      provider: "Google",
      name: "Gemini 3.1 Pro Preview",
      contextWindow: 1_048_576,
      maxOutput: 65_536,
      input: 2,
      cachedInput: 0.2,
      cacheWrite: null,
      cacheStoragePerMillionHour: 4.5,
      output: 12,
      longContext: { threshold: 200_000, inputMultiplier: 2, outputMultiplier: 1.5 },
      note: "Acima de 200k tokens: input/cache 2× e output 1,5×; armazenamento é cobrado à parte.",
    },
  ].map(Object.freeze);

  return {
    CONTEXT_MODELS: Object.freeze(CONTEXT_MODELS),
    CONTEXT_PRICING_META,
  };
});
