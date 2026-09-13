# Post para lançamento no LinkedIn

## Texto principal

Você sabe quanto a sua IA realmente custa antes da fatura chegar?

O preço por 1 milhão de tokens parece pequeno. O problema aparece quando agentes fazem várias chamadas, reenviam o histórico inteiro, carregam documentos e ferramentas a cada turno e geram tokens de raciocínio e saída. Uma diferença de centavos na tabela pode virar milhares de dólares em produção.

Foi por isso que criei o **EconomIA**, uma calculadora gratuita e aberta para comparar custos de APIs de inteligência artificial.

Hoje ela reúne **46 modelos de 13 provedores**, incluindo OpenAI, Anthropic, Google, DeepSeek, xAI, Mistral, Kimi, Qwen, MiniMax e Tencent.

Com ela você pode:

• informar tokens de entrada e saída — ou apenas o total;
• comparar o mesmo consumo entre todos os modelos;
• converter automaticamente de dólar para real;
• simular Batch API nos provedores que oferecem desconto;
• estimar o tamanho do contexto antes da chamada;
• separar system prompt, histórico, documentos/RAG e ferramentas;
• projetar o crescimento e o custo de uma conversa em até 100 turnos;
• simular cache e faixas de contexto longo;
• colar o objeto `usage` da API para comparar estimativa e consumo real.

No exemplo de 382 milhões de tokens disponível no site, o custo estimado vai de cerca de **US$ 59 a US$ 28,6 mil**, dependendo do modelo. Isso não quer dizer que os modelos entregam a mesma qualidade — e esse é justamente o ponto. Escolher bem exige olhar custo, capacidade, latência e qualidade para cada tarefa, não apenas usar o modelo mais caro em tudo.

O cálculo acontece localmente no navegador, o texto usado na aba de contexto não é enviado ao EconomIA e o acesso é gratuito, sem cadastro. Os preços ficam versionados no GitHub, com fontes oficiais e monitoramento diário de mudanças.

Teste aqui: https://economia-calculadora.vercel.app/

Código-fonte: https://github.com/Gor0d/economIA

O projeto também oferece API pública, OpenAPI e MCP para integração com ChatGPT, Claude e Codex.

Se fizer sentido para alguém do seu time, compartilhe. Feedback e contribuições são bem-vindos.

#InteligenciaArtificial #IA #FinOps #APIs #DesenvolvimentoDeSoftware

## Material para acompanhar o post

- Imagem recomendada: `assets/social/og-image.png`.
- Link: https://economia-calculadora.vercel.app/
- Texto alternativo: “Banner do EconomIA, calculadora gratuita para comparar custos de tokens entre modelos de inteligência artificial.”

## Nota sobre o exemplo

O intervalo de US$ 59,21 a US$ 28.650,00 usa o preset do site: 267,4 milhões de tokens de entrada e 114,6 milhões de saída, com preços Standard e sem cache. A comparação mantém o mesmo volume em todos os modelos e não afirma equivalência de qualidade ou capacidade.
