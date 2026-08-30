# Revisão com Claude

O ambiente que gerou esta integração não tinha Claude Code nem `ANTHROPIC_API_KEY`. Depois do primeiro deploy, conecte o servidor e peça uma revisão independente:

```bash
claude mcp add --transport http economia https://economia-calculadora-ia.vercel.app/api/mcp
claude -p "Use as ferramentas do MCP economia. Liste os modelos e compare 1.000.000 tokens de entrada e 100.000 de saída usando gpt-5 como baseline. Depois revise criticamente o resultado: confira ordenação, diferença para o baseline, data de revisão e disclaimer. Relate qualquer inconsistência sem editar arquivos."
```

Teste também no Inspector MCP:

```bash
npx @modelcontextprotocol/inspector https://economia-calculadora-ia.vercel.app/api/mcp
```

Critérios de aceite:

1. As ferramentas `list_ai_models` e `compare_ai_model_prices` aparecem.
2. A comparação é ordenada por `costUsd` crescente.
3. O resultado contém `reviewedAt`, fontes, baseline e limitações.
4. Entradas negativas, acima de 1 trilhão ou IDs desconhecidos falham com mensagem clara.
