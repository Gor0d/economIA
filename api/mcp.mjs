import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/server";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import * as z from "zod/v4";

const require = createRequire(import.meta.url);
const { comparePrices, listModels } = require("./_comparison.js");
const { PRICING } = require("../js/pricing.js");
const { guardRequest } = require("./_http.js");

const nullableNumber = z.number().nullable();
const priceResultSchema = z.object({
  modelId: z.string(),
  provider: z.string(),
  model: z.string(),
  costUsd: z.number(),
  inputUsdPerMillion: z.number(),
  outputUsdPerMillion: z.number(),
  batchApplied: z.boolean(),
  differenceFromBaselineUsd: nullableNumber,
  savingsVsBaselinePercent: nullableNumber,
  note: z.string().nullable(),
});

export const compareOutputSchema = z.object({
  input: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
    batch: z.boolean(),
    baselineModelId: z.string().nullable(),
    provider: z.string().nullable(),
    limit: z.number().int().nullable(),
  }),
  pricing: z.object({
    currency: z.literal("USD"),
    unit: z.literal("per 1M tokens"),
    reviewedAt: z.string(),
    sources: z.record(z.string(), z.string()),
  }),
  cheapest: priceResultSchema.nullable(),
  baseline: z.object({
    modelId: z.string(),
    provider: z.string(),
    model: z.string(),
    costUsd: z.number(),
  }).nullable(),
  results: z.array(priceResultSchema),
  disclaimer: z.string(),
});

const catalogModelSchema = z.object({
  id: z.string(),
  provider: z.string(),
  name: z.string(),
  input: z.number(),
  output: z.number(),
  batchDiscount: z.number().optional(),
  note: z.string().optional(),
});

export const modelsOutputSchema = z.object({
  reviewedAt: z.string(),
  count: z.number().int().nonnegative(),
  models: z.array(catalogModelSchema),
  sources: z.record(z.string(), z.string()),
});

function buildServer() {
  const server = new McpServer({ name: "economia-price-comparator", version: "1.0.0" });
  server.registerTool("compare_ai_model_prices", {
    title: "Comparar preços de modelos de IA",
    description: "Compara o custo estimado do mesmo consumo de tokens entre modelos e provedores de IA. Use quando o usuário perguntar qual modelo custa menos ou quanto economizaria.",
    inputSchema: z.object({
      inputTokens: z.number().nonnegative().max(1e12).describe("Tokens de entrada"),
      outputTokens: z.number().nonnegative().max(1e12).describe("Tokens de saída"),
      baselineModelId: z.string().optional().describe("ID opcional do modelo usado para calcular economia"),
      batch: z.boolean().optional().default(false).describe("Aplicar Batch API quando disponível"),
      provider: z.string().optional().describe("Filtrar por um provedor, como OpenAI ou Anthropic"),
      limit: z.number().int().min(1).max(PRICING.length).optional().describe("Limitar a quantidade de resultados para reduzir a resposta"),
    }),
    outputSchema: compareOutputSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async (args) => {
    try {
      const result = comparePrices(args);
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    } catch (error) {
      return { isError: true, content: [{ type: "text", text: error.message }] };
    }
  });
  server.registerTool("list_ai_models", {
    title: "Listar modelos e preços",
    description: "Lista os modelos disponíveis, preços por milhão de tokens e data de revisão.",
    inputSchema: z.object({ provider: z.string().optional() }),
    outputSchema: modelsOutputSchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ provider }) => {
    const result = listModels(provider);
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  });
  return server;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id, Last-Event-ID");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, Retry-After");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!guardRequest(req, res, { limit: 60, maxBytes: 65_536, scope: "mcp" })) return;

  const server = buildServer();
  const transport = new NodeStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
