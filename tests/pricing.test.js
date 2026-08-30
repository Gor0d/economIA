const test = require("node:test");
const assert = require("node:assert/strict");

const { PRICING, PRICING_META } = require("../js/pricing.js");

test("tabela possui modelos válidos e IDs únicos", () => {
  assert.ok(PRICING.length >= 25);

  const ids = new Set();
  for (const model of PRICING) {
    assert.ok(model.id && model.provider && model.name, JSON.stringify(model));
    assert.ok(Number.isFinite(model.input) && model.input >= 0, model.id);
    assert.ok(Number.isFinite(model.output) && model.output >= 0, model.id);
    if (model.batchDiscount !== undefined) {
      assert.ok(
        Number.isFinite(model.batchDiscount) && model.batchDiscount > 0 && model.batchDiscount < 1,
        `batchDiscount inválido em ${model.id}`
      );
    }
    assert.equal(ids.has(model.id), false, `ID duplicado: ${model.id}`);
    ids.add(model.id);
  }
});

test("cada provedor possui uma fonte oficial HTTPS", () => {
  const providers = new Set(PRICING.map((model) => model.provider));
  for (const provider of providers) {
    const source = PRICING_META.sources[provider];
    assert.ok(source, `Fonte ausente: ${provider}`);
    assert.equal(new URL(source).protocol, "https:", provider);
  }
});

test("a revisão de preços não ultrapassou a validade configurada", () => {
  const updatedAt = new Date(`${PRICING_META.updatedAt}T23:59:59Z`);
  const ageDays = (Date.now() - updatedAt.getTime()) / 86_400_000;
  assert.ok(ageDays >= -1, "A data de preços está no futuro");
  assert.ok(ageDays <= PRICING_META.maxAgeDays, `Tabela sem revisão há ${Math.floor(ageDays)} dias`);
});

test("DeepSeek V4 usa a tabela oficial vigente", () => {
  const flash = PRICING.find((model) => model.id === "deepseek-v4-flash");
  const pro = PRICING.find((model) => model.id === "deepseek-v4-pro");
  assert.deepEqual([flash.input, flash.output], [0.14, 0.28]);
  assert.deepEqual([pro.input, pro.output], [0.435, 0.87]);
});

test("Gemini 3.6 Flash usa o preço promocional oficial vigente", () => {
  const model = PRICING.find((item) => item.id === "gemini-3.6-flash");
  assert.ok(model, "Gemini 3.6 Flash ausente");
  assert.deepEqual([model.input, model.output, model.batchDiscount], [0.75, 3.75, 0.5]);
});
