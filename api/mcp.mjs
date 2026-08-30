import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/server";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import * as z from "zod/v4";

const require = createRequire(import.meta.url);
const { comparePrices, listModels } = require("./_comparison.js");

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
    }),
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
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  if (req.method === "OPTIONS") return res.status(204).end();

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
