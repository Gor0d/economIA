// Monitoramento gratuito de preço: sem chave de API, sem IA.
//
// Em vez de comparar a página inteira (o HTML bruto muda a cada request por
// causa de scripts de analytics, nonces, banners rotativos etc — testamos e
// confirmado), extraímos só os valores em dólar (ex: "$3.00") e comparamos
// esse conjunto com o da última execução. Se mudou, é sinal de que um humano
// deve revisar js/pricing.js manualmente — este script nunca edita a tabela.
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { PRICING_META } = require("../js/pricing.js");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const SNAPSHOT_PATH = path.join(__dirname, "pricing-snapshots.json");
const RESULT_PATH = path.join(__dirname, "pricing-drift-result.json");
const STATUS_PATH = path.join(ROOT_DIR, "js", "pricing-status.js");

function loadSnapshots() {
  if (!existsSync(SNAPSHOT_PATH)) return {};
  try {
    return JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
  } catch {
    return {};
  }
}

function extractVisibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Só os valores em dólar (ex: "$3.00", "$0.10") — ignora o resto do texto da
// página, que é o que costuma variar sem relação nenhuma com preço.
//
// Algumas páginas (ex: Moonshot AI/Kimi, um app Next.js) não têm "$3.00" como
// texto contíguo no HTML — o preço vem serializado do React em pedaços
// separados, tipo `` `$`,`3.00` `` dentro de um <script>. Casamos esse padrão
// também, direto no HTML bruto (antes de remover as tags).
function extractPriceSignal(html, visibleText) {
  const plainMatches = visibleText.match(/\$\s?\d[\d,.]*/g) || [];
  const rscMatches = [...html.matchAll(/`\$`\s*,\s*`([\d.,]+)`/g)].map((m) => `$${m[1]}`);
  const all = [...plainMatches, ...rscMatches];
  return [...new Set(all.map((m) => m.replace(/\s+/g, "").toLowerCase()))].sort();
}

function hashSignal(signal) {
  return createHash("sha256").update(signal.join("|")).digest("hex");
}

async function fetchPriceSignal(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "economia-pricing-watch/1.0 (+https://github.com/Gor0d/economIA)",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  return extractPriceSignal(html, extractVisibleText(html));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Algumas páginas servem uma variação diferente a cada request (cache MISS na
// primeira chamada, experimento client-side, etc). Buscamos 2x; quando elas
// divergem, fazemos uma terceira leitura e aceitamos apenas a variante que
// aparecer ao menos duas vezes. Se as três forem diferentes, a checagem fica
// inconclusiva em vez de gerar alarme falso.
async function checkProvider(provider, url) {
  try {
    const first = await fetchPriceSignal(url);
    await sleep(1500);
    const second = await fetchPriceSignal(url);
    const firstHash = hashSignal(first);
    const secondHash = hashSignal(second);

    if (firstHash !== secondHash) {
      await sleep(1500);
      const third = await fetchPriceSignal(url);
      const thirdHash = hashSignal(third);
      const stableHash = thirdHash === firstHash ? firstHash : thirdHash === secondHash ? secondHash : null;
      if (!stableHash) {
        if (process.env.PRICING_DEBUG === "1") {
          console.error(JSON.stringify({ provider, first, second, third }, null, 2));
        }
        return { provider, url, status: "inconclusive" };
      }
      const stableSignal = stableHash === firstHash ? first : second;
      if (stableSignal.length === 0) return { provider, url, status: "no-signal" };
      return { provider, url, status: "ok", hash: stableHash };
    }
    if (first.length === 0) {
      // Página provavelmente renderiza os preços via JS no cliente — um fetch
      // simples não vê esse conteúdo. Não dá pra monitorar automaticamente.
      return { provider, url, status: "no-signal" };
    }
    return { provider, url, status: "ok", hash: firstHash };
  } catch (error) {
    return { provider, url, status: "unreachable", detail: error.message };
  }
}

const previous = loadSnapshots();
const isFirstRun = Object.keys(previous).length === 0;

const results = await Promise.all(
  Object.entries(PRICING_META.sources).map(([provider, url]) => checkProvider(provider, url))
);

const changed = [];
const unreachable = [];
const noSignal = [];
const inconclusive = [];
const next = { ...previous };

for (const result of results) {
  if (result.status === "unreachable") {
    unreachable.push({ provider: result.provider, url: result.url, detail: result.detail });
    continue;
  }
  if (result.status === "no-signal") {
    noSignal.push({ provider: result.provider, url: result.url });
    continue;
  }
  if (result.status === "inconclusive") {
    // Mantém o snapshot anterior; tenta de novo na próxima execução.
    inconclusive.push({ provider: result.provider, url: result.url });
    continue;
  }

  const prevEntry = previous[result.provider];
  if (prevEntry && prevEntry.hash !== result.hash) {
    changed.push({ provider: result.provider, url: result.url });
  }
  next[result.provider] = { hash: result.hash, url: result.url, checkedAt: new Date().toISOString() };
}

writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(next, null, 2)}\n`);

// Provedores que nunca conseguiram estabelecer uma baseline (sempre
// inconclusivos, ou sem sinal de preço no HTML) não são monitoráveis por
// diff automático — isso é uma limitação conhecida da página, não um alerta
// do dia. Reportamos uma vez para visibilidade, sem disparar issue por isso.
const notMonitored = Object.keys(PRICING_META.sources)
  .filter((provider) => !(provider in next))
  .map((provider) => ({ provider, url: PRICING_META.sources[provider] }));

const summary = { isFirstRun, changed, unreachable, noSignal, inconclusive, notMonitored };
writeFileSync(RESULT_PATH, JSON.stringify(summary, null, 2));

const checkedAt = new Date().toISOString().slice(0, 10);
const status =
  changed.length > 0 || unreachable.length > 0
    ? "attention"
    : noSignal.length > 0 || inconclusive.length > 0 || notMonitored.length > 0
      ? "partial"
      : "ok";
writeFileSync(
  STATUS_PATH,
  `const PRICING_STATUS = Object.freeze({\n  checkedAt: "${checkedAt}",\n  status: "${status}",\n});\n\nif (typeof module !== "undefined" && module.exports) {\n  module.exports = { PRICING_STATUS };\n}\n`
);

console.log(JSON.stringify(summary, null, 2));

if (process.env.GITHUB_OUTPUT) {
  writeFileSync(
    process.env.GITHUB_OUTPUT,
    `has_changes=${changed.length > 0 || unreachable.length > 0}\n`,
    { flag: "a" }
  );
}
