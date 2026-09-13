import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(path.join(root, "index.html"), "utf8");
for (const jsonFile of ["openapi.json", "manifest.webmanifest"]) {
  JSON.parse(readFileSync(path.join(root, jsonFile), "utf8"));
}
const referencedAssets = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
  .map((match) => match[1])
  .filter((value) => !/^(?:https?:|mailto:|data:)/.test(value));

const missing = referencedAssets.filter((relativePath) => !existsSync(path.join(root, relativePath.split("?")[0])));
if (missing.length > 0) {
  console.error(`Arquivos referenciados e ausentes:\n${missing.map((item) => `- ${item}`).join("\n")}`);
  process.exit(1);
}

for (const id of ["comparisonPanel", "contextPanel", "contextComparisonRows", "contextRecommendations"]) {
  if (!html.includes(`id="${id}"`)) {
    console.error(`Estrutura obrigatória ausente: #${id}`);
    process.exit(1);
  }
}

for (const requiredFile of ["privacy.html", "terms.html", "robots.txt", "sitemap.xml"]) {
  if (!existsSync(path.join(root, requiredFile))) {
    console.error(`Arquivo público obrigatório ausente: ${requiredFile}`);
    process.exit(1);
  }
}

console.log(`Build estático validado: ${referencedAssets.length} referências locais, metadados e 2 abas prontas para deploy.`);
