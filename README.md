# EconomIA — Calculadora de Custo de Tokens de IA

**[economia-calculadora-ia.vercel.app](https://economia-calculadora-ia.vercel.app)**

Site que responde uma pergunta simples: *"quanto eu gastei, e quanto teria gasto se
tivesse usado outro modelo?"*. Você informa os tokens de entrada/saída e o modelo usado; a
calculadora mostra o custo com todos os modelos cadastrados — hoje **33 modelos em 8
provedores** (OpenAI, Anthropic, Google, DeepSeek, xAI, Mistral, Moonshot AI e Z.ai) —
ordenados do mais barato ao mais caro, com a economia (ou o quanto custaria a mais) em
relação ao que você usou.

## Origem

O projeto nasceu de um post no LinkedIn de alguém relatando ter gasto **382 milhões de
tokens em 5 dias só na DeepSeek**. A pergunta óbvia — "isso seria mais barato em outro
modelo?" — não tinha resposta rápida em lugar nenhum, então virou esse site. Esse número
(382M) é o exemplo pré-carregado no botão "Usar exemplo de 382M tokens".

## Como foi construído

Decisão deliberada desde o início: **HTML/CSS/JS puro, sem build e sem backend**. Não existe
API própria, não existe banco de dados, não existe servidor além de servir arquivos
estáticos. Isso significa:

- Roda em qualquer host estático (Vercel, Netlify, GitHub Pages) sem configuração de build.
- Não há chave de API, custo de servidor ou infraestrutura pra manter.
- A única chamada de rede feita pelo navegador do usuário é para a API pública e gratuita do
  [Frankfurter](https://frankfurter.dev/) (câmbio USD→BRL) — o resto é tudo cálculo local.
- Sem framework: os arquivos `pricing.js` → `calculator.js` → `app.js` são carregados na
  ordem, cada um assumindo que o anterior já rodou (ver `index.html`).

O projeto foi construído em pareamento entre um humano (visão de produto, decisões de
negócio, testes manuais) e assistentes de IA (Claude Code e Codex) escrevendo o código —
inclusive esse próprio README.

### Por que os preços ficam em `pricing.js` e não vêm de uma API

Nenhum provedor de IA expõe uma API pública estável e padronizada de "quanto custa cada
modelo agora". Em vez de fazer scraping frágil das páginas de pricing em tempo real (o que
quebraria silenciosamente a cada mudança de layout), os preços ficam **versionados e
auditáveis** direto no código — toda mudança de preço é uma mudança de código, revisável e
com histórico no Git.

### Como a tabela se mantém atualizada

Duas camadas, as duas gratuitas:

1. **`npm test` falha sozinho** se `PRICING_META.updatedAt` passar de 45 dias sem revisão —
   trava a suíte pra ninguém esquecer a tabela.
2. **Monitor automático diário** (`.github/workflows/pricing-watch.yml`, GitHub Actions,
   sem custo): busca cada página oficial de preço, extrai só os valores em dólar (ex.:
   `$3.00`) e compara com o retrato salvo da última execução. Se algo mudou — ou se uma
   página ficou inacessível — abre uma **Issue** no repositório pedindo revisão manual.
   Não usa IA nem chave de API paga: é puramente HTTP + diff de texto. Ele nunca edita
   `pricing.js` sozinho, só avisa.
   - Detalhe que exigiu ajuste: o HTML bruto dessas páginas muda a cada request (scripts de
     analytics, nonces, banners rotativos), então comparar a página inteira gerava alarme
     falso todo dia. A solução foi extrair só os valores em dólar do texto visível — e ainda
     assim buscar cada página duas vezes com um intervalo curto, só confiando no resultado se
     as duas baterem (algumas páginas servem uma variação diferente por requisição).
   - A página da **Moonshot AI (Kimi)** é um app Next.js: o preço não aparece como texto
     contíguo (`$3.00`) no HTML — vem serializado do React em pedaços separados
     (`` `$`,`3.00` ``) dentro de um `<script>`. O extrator reconhece também esse formato,
     então ela é monitorada normalmente. Se no futuro outro provedor usar uma técnica
     diferente (ex.: preço só disponível depois de executar JS no navegador, sem nenhum
     rastro no HTML bruto), ele aparece em `notMonitored` no resultado — sinal de que
     precisaria de um navegador headless (Playwright) no workflow, opção descartada por
     enquanto pelo custo/tempo extra que adicionaria ao job diário.

Rodar manualmente:

```bash
npm run check:sources   # confirma que as páginas oficiais respondem
npm run check:drift     # compara com o retrato salvo e mostra o que mudou
```

## Funcionalidades

- **Dois modos de entrada**: tokens de entrada/saída separados, ou só o total com uma
  estimativa de divisão (com perfis prontos: chat, código, agentes).
- **Modo de cobrança Padrão / Batch API (−50%)**: aplica o desconto oficial de Batch API nos
  modelos que o publicam (Anthropic, OpenAI, Google); os demais mostram "sem Batch API" e
  mantêm o preço padrão — nunca inventa desconto onde não é documentado.
- **Câmbio USD→BRL automático**, com cache de 12h no navegador e opção de digitar um valor
  manual.
- **Busca e filtro por provedor**, tema claro/escuro (acompanha o sistema, depois lembra a
  escolha), e teto de 1 trilhão de tokens por campo (acima disso a precisão de ponto
  flutuante do JavaScript deixa de ser confiável, e o site avisa em vez de mostrar um número
  sem sentido).

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
npm test            # cálculos, formatos, câmbio, Batch API, integridade da tabela
npm run check:sources  # confirma que as páginas oficiais cadastradas continuam acessíveis
npm run check:drift    # compara as páginas com o retrato salvo (usado pelo monitor diário)
npm run check           # test + check:sources, o combo recomendado antes de um PR
```

## Como fazer deploy

Hoje publicado na **Vercel** (`vercel.json` já define os headers de segurança — CSP, HSTS,
X-Frame-Options etc.). Por ser uma pasta estática, também funciona em:

- **GitHub Pages**: suba este repositório e ative Pages apontando pra `main` / raiz.
- **Netlify**: importe o repo, sem build command (é HTML puro).

## Estrutura

- `index.html` — estrutura da página
- `style.css` — temas claro/escuro, responsividade e animações acessíveis
- `assets/logos/` — ícones locais dos provedores exibidos apenas para identificação
- `assets/brand/` — símbolo e assinaturas horizontais da marca EconomIA para fundos claros e escuros
- `pricing.js` — **tabela de preços** de cada modelo (US$ por 1M tokens de input/output)
- `calculator.js` — parser e funções puras de cálculo, compartilhadas pelo site e pelos testes
- `app.js` — lógica de interface e renderização
- `theme-init.js` — detecção de tema (script externo, exigido pela CSP sem `unsafe-inline`)
- `vercel.json` — headers de segurança do deploy
- `scripts/check-pricing-sources.mjs` — confirma que as páginas oficiais respondem
- `scripts/check-pricing-drift.mjs` — monitor de mudança de preço (ver acima)
- `scripts/pricing-snapshots.json` — retrato salvo usado pelo monitor (versionado no Git)
- `.github/workflows/pricing-watch.yml` — roda o monitor todo dia e abre Issue se algo mudar
- `tests/` — testes automatizados sem dependências externas

Os ícones de marcas foram obtidos do projeto [Simple Icons](https://simpleicons.org/). As marcas
e logos pertencem aos respectivos proprietários e não indicam parceria ou endosso.

## Atualizando os preços

Os provedores não oferecem uma API oficial única e estável para todos os preços (ver "Como
foi construído" acima). Cada modelo em `pricing.js` é um objeto:

```js
{ id, provider, name, input, output, batchDiscount, note }
```

- `input` / `output`: US$ por 1 milhão de tokens, sem desconto de cache.
- `batchDiscount` (opcional, 0 a 1): desconto da Batch API do provedor, só quando publicado
  oficialmente (ex.: `0.5` = 50% off). Omitir quando o provedor não publica esse desconto.
- `note`: observação curta (contexto longo, cache, preço promocional etc.).

Depois de uma revisão manual (inclusive as disparadas pela Issue automática), atualize
`PRICING_META.updatedAt` e rode `npm run check`. Fontes oficiais usadas na última
atualização (26/08/2026):

- Anthropic (Claude): https://platform.claude.com/docs/en/about-claude/pricing
- OpenAI: https://developers.openai.com/api/docs/models
- Google Gemini: https://ai.google.dev/gemini-api/docs/pricing
- DeepSeek: https://api-docs.deepseek.com/quick_start/pricing/
- xAI Grok: https://docs.x.ai/developers/pricing
- Mistral: https://mistral.ai/pricing/api/
- Moonshot AI (Kimi): https://platform.kimi.ai/docs/pricing/chat-k3
- Z.ai (GLM): https://docs.z.ai/guides/overview/pricing

## O que a calculadora **não** modela (por simplicidade)

- **Cache de prompt**: DeepSeek, OpenAI, Anthropic e Google oferecem preço reduzido
  (até ~90% de desconto, ou mais no caso do DeepSeek) para tokens de input repetidos/cacheados.
  A calculadora sempre usa o preço cheio (cache miss) — o custo real com uso intenso de cache
  tende a ser bem menor, principalmente em conversas longas ou agentes que reenviam o mesmo
  contexto a cada chamada.
- **Preços por contexto longo** (>200k tokens): alguns modelos (Gemini 3.1 Pro, Grok 4.6, etc.)
  cobram mais quando o prompt passa de 200k tokens — a calculadora usa sempre o preço-base.
- **Diferenças de tokenização**: o mesmo texto pode gerar quantidades diferentes de tokens em
  modelos distintos. A comparação assume o mesmo volume informado em todos os modelos e deve
  ser lida como estimativa. Modelar isso exigiria embutir o tokenizador de cada provedor no
  site ou chamar a API de contagem de tokens de cada um — nesse ponto deixa de ser um site
  estático simples.

O desconto de **Batch API já é modelado** (ver "Funcionalidades" acima) — era a única dessas
limitações barata o suficiente pra valer a pena implementar sem custo de manutenção contínuo.
