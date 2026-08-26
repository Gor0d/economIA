# Calculadora de Custo de Tokens de IA

Site estático (HTML/CSS/JS puro, sem build e sem backend) para comparar quanto você gastou
com um modelo de IA vs. quanto teria gasto com outro. Você informa tokens de entrada/saída
e o modelo usado; a calculadora mostra o custo com todos os modelos cadastrados, ordenados
do mais barato ao mais caro, com a economia (ou o quanto custaria a mais) em relação ao que
você usou.

Ao selecionar real (R$), a cotação USD→BRL é carregada automaticamente pela API pública
[Frankfurter](https://frankfurter.dev/). O último valor obtido fica salvo no navegador e o
campo continua editável para simulações manuais.

Para facilitar o preenchimento, a interface oferece dois modos: informar entrada e saída
separadamente ou informar apenas o total e escolher uma estimativa de divisão. Também há
atalhos de volume, perfis para chat/código/agentes e busca por modelo ou provedor. O tema
claro/escuro acompanha a preferência do sistema no primeiro acesso e depois salva a escolha do
usuário no navegador.

## Como rodar

Abra `index.html` direto no navegador (duplo clique) ou sirva a pasta com qualquer servidor
estático:

```bash
npx serve .
# ou
python -m http.server 8000
```

## Testes e validações

É necessário Node.js 20 ou superior. Não há dependências para instalar:

```bash
npm test
npm run check:sources
```

- `npm test` valida formatos numéricos, cálculos, câmbio e integridade da tabela.
- `npm run check:sources` confirma que as páginas oficiais cadastradas continuam acessíveis.
- A suíte falha quando a tabela passa de 45 dias sem revisão, evitando publicar preços antigos
  silenciosamente.

## Como fazer deploy

É uma pasta estática — funciona em qualquer host gratuito:

- **GitHub Pages**: suba este repositório e ative Pages apontando pra `main` / raiz.
- **Vercel / Netlify**: importe o repo, sem build command (é HTML puro).

## Estrutura

- `index.html` — estrutura da página
- `style.css` — temas claro/escuro, responsividade e animações acessíveis
- `assets/logos/` — ícones locais dos provedores exibidos apenas para identificação
- `pricing.js` — **tabela de preços** de cada modelo (US$ por 1M tokens de input/output)
- `calculator.js` — parser e funções puras de cálculo, compartilhadas pelo site e pelos testes
- `app.js` — lógica de cálculo e renderização
- `tests/` — testes automatizados sem dependências externas

Os ícones de marcas foram obtidos do projeto [Simple Icons](https://simpleicons.org/). As marcas
e logos pertencem aos respectivos proprietários e não indicam parceria ou endosso.

## Atualizando os preços

Os provedores não oferecem uma API oficial única e estável para todos os preços. Para não
basear o site em scraping frágil, os valores ficam versionados e auditáveis em `pricing.js`.
Cada modelo é um objeto
`{ id, provider, name, input, output, note }`. `input`/`output` são US$ por 1 milhão de
tokens, sem desconto de cache. Depois de uma revisão, atualize `PRICING_META.updatedAt` e rode
`npm run check`. Fontes oficiais usadas na última atualização (26/08/2026):

- Anthropic (Claude): https://www.anthropic.com/pricing
- OpenAI: https://openai.com/api/pricing/ e https://openai.com/index/gpt-5-6/
- Google Gemini: https://ai.google.dev/gemini-api/docs/pricing
- DeepSeek: https://api-docs.deepseek.com/quick_start/pricing
- xAI Grok: https://docs.x.ai/docs/models
- Mistral: https://mistral.ai/pricing

## O que a calculadora **não** modela (por simplicidade)

- **Cache de prompt**: DeepSeek, OpenAI, Anthropic e Google oferecem preço reduzido
  (até ~90% de desconto, ou mais no caso do DeepSeek) para tokens de input repetidos/cacheados.
  A calculadora sempre usa o preço cheio (cache miss) — o custo real com uso intenso de cache
  tende a ser bem menor, principalmente em conversas longas ou agentes que reenviam o mesmo
  contexto a cada chamada.
- **Batch API**: metade do preço em várias provedoras, para cargas que não precisam de resposta
  em tempo real.
- **Preços por contexto longo** (>200k tokens): alguns modelos (Gemini 3.1 Pro, Grok 4.6, etc.)
  cobram mais quando o prompt passa de 200k tokens — a calculadora usa sempre o preço-base.
- **Diferenças de tokenização**: o mesmo texto pode gerar quantidades diferentes de tokens em
  modelos distintos. A comparação assume o mesmo volume informado em todos os modelos e deve
  ser lida como estimativa.

Se quiser, dá pra evoluir isso depois (ex: checkbox "usar preço de cache quando disponível"),
mas exigiria manter preço de cache por modelo — hoje só DeepSeek publica esse número de forma
clara e comparável entre modelos.
