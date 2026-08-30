import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PRICING_META } = require("../js/pricing.js");

const results = await Promise.all(
  Object.entries(PRICING_META.sources).map(async ([provider, url]) => {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "calculadora-tokens-source-check/1.0",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(12_000),
      });
      return { provider, url, ok: response.ok, status: response.status };
    } catch (error) {
      return { provider, url, ok: false, status: error.name || "erro" };
    }
  })
);

for (const result of results) {
  console.log(`${result.ok ? "OK" : "FALHA"} ${result.provider}: ${result.status} ${result.url}`);
}

if (results.some((result) => !result.ok)) {
  process.exitCode = 1;
}
