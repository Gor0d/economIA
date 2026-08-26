/*
 * Tabela de preços das principais APIs de IA (US$ por 1 milhão de tokens).
 * Fonte: páginas oficiais de pricing de cada provedor (ver README.md para os links).
 * Atualizado em: 2026-08-26
 *
 * Para atualizar um preço: edite os campos `input` e `output` do modelo.
 * Para adicionar um modelo novo: copie um objeto existente e ajuste os campos.
 *
 * `input`  = US$ por 1M tokens de entrada (preço padrão, sem cache)
 * `output` = US$ por 1M tokens de saída
 * `note`   = observação curta (contexto longo, cache, preço promocional, etc.)
 */

const PRICING_META = {
  updatedAt: "2026-08-26",
  maxAgeDays: 45,
  sources: {
    Anthropic: "https://platform.claude.com/docs/en/about-claude/pricing",
    OpenAI: "https://developers.openai.com/api/docs/models",
    Google: "https://ai.google.dev/gemini-api/docs/pricing",
    DeepSeek: "https://api-docs.deepseek.com/quick_start/pricing/",
    xAI: "https://docs.x.ai/developers/pricing",
    Mistral: "https://mistral.ai/pricing/api/",
  },
};

const PRICING = [
  // ---- Anthropic (Claude) ----
  { id: "claude-fable-5", provider: "Anthropic", name: "Claude Fable 5", input: 10.00, output: 50.00, note: "Modelo mais capaz da Anthropic" },
  { id: "claude-opus-5", provider: "Anthropic", name: "Claude Opus 5", input: 5.00, output: 25.00 },
  { id: "claude-sonnet-5", provider: "Anthropic", name: "Claude Sonnet 5", input: 2.00, output: 10.00 },
  { id: "claude-haiku-4-5", provider: "Anthropic", name: "Claude Haiku 4.5", input: 1.00, output: 5.00 },
  { id: "claude-opus-4-6", provider: "Anthropic", name: "Claude Opus 4.6 (legado)", input: 5.00, output: 25.00 },
  { id: "claude-sonnet-4-6", provider: "Anthropic", name: "Claude Sonnet 4.6 (legado)", input: 3.00, output: 15.00 },

  // ---- OpenAI ----
  { id: "gpt-5.6-sol", provider: "OpenAI", name: "GPT-5.6 Sol", input: 4.00, output: 20.00, note: "Preço promocional (até nov/2026)" },
  { id: "gpt-5.6-terra", provider: "OpenAI", name: "GPT-5.6 Terra", input: 2.00, output: 12.00 },
  { id: "gpt-5.6-luna", provider: "OpenAI", name: "GPT-5.6 Luna", input: 0.20, output: 1.20 },
  { id: "gpt-5.5", provider: "OpenAI", name: "GPT-5.5", input: 5.00, output: 30.00 },
  { id: "gpt-5.5-pro", provider: "OpenAI", name: "GPT-5.5 Pro", input: 30.00, output: 180.00 },
  { id: "gpt-5", provider: "OpenAI", name: "GPT-5", input: 1.25, output: 10.00 },
  { id: "gpt-5-nano", provider: "OpenAI", name: "GPT-5 nano", input: 0.05, output: 0.40 },

  // ---- Google (Gemini) ----
  { id: "gemini-3.7-flash", provider: "Google", name: "Gemini 3.7 Flash", input: 0.75, output: 3.75, note: "Preço sobe em jan/2027" },
  { id: "gemini-3.5-flash", provider: "Google", name: "Gemini 3.5 Flash", input: 1.50, output: 9.00 },
  { id: "gemini-3.5-flash-lite", provider: "Google", name: "Gemini 3.5 Flash-Lite", input: 0.30, output: 2.50 },
  { id: "gemini-3.1-pro", provider: "Google", name: "Gemini 3.1 Pro", input: 2.00, output: 12.00, note: "Prompts ≤200k tokens; acima disso dobra" },
  { id: "gemini-3.1-flash-lite", provider: "Google", name: "Gemini 3.1 Flash-Lite", input: 0.25, output: 1.50 },
  { id: "gemini-2.5-pro", provider: "Google", name: "Gemini 2.5 Pro", input: 1.25, output: 10.00, note: "Prompts ≤200k tokens; acima disso sobe" },
  { id: "gemini-2.5-flash", provider: "Google", name: "Gemini 2.5 Flash", input: 0.30, output: 2.50 },
  { id: "gemini-2.5-flash-lite", provider: "Google", name: "Gemini 2.5 Flash-Lite", input: 0.10, output: 0.40, note: "Aposentado em 16/10/2026" },

  // ---- DeepSeek ----
  { id: "deepseek-v4-flash", provider: "DeepSeek", name: "DeepSeek V4-Flash", input: 0.14, output: 0.28, note: "Cache hit: US$ 0,0028 por 1M tokens de input" },
  { id: "deepseek-v4-pro", provider: "DeepSeek", name: "DeepSeek V4-Pro", input: 0.435, output: 0.87, note: "Cache hit: US$ 0,003625 por 1M tokens de input" },

  // ---- xAI (Grok) ----
  { id: "grok-4.6", provider: "xAI", name: "Grok 4.6", input: 2.00, output: 6.00, note: "Prompts <200k tokens; acima disso dobra" },
  { id: "grok-4.5", provider: "xAI", name: "Grok 4.5", input: 2.00, output: 6.00, note: "Prompts <200k tokens; acima disso dobra" },
  { id: "grok-4.3", provider: "xAI", name: "Grok 4.3", input: 1.25, output: 2.50 },
  { id: "grok-build-0.1", provider: "xAI", name: "Grok Build 0.1", input: 1.00, output: 2.00, note: "Focado em coding" },

  // ---- Mistral ----
  { id: "mistral-medium-3.5", provider: "Mistral", name: "Mistral Medium 3.5", input: 1.50, output: 7.50 },
  { id: "mistral-large-3", provider: "Mistral", name: "Mistral Large 3", input: 0.50, output: 1.50 },
  { id: "mistral-small-4", provider: "Mistral", name: "Mistral Small 4", input: 0.15, output: 0.60 },
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = { PRICING, PRICING_META };
}
