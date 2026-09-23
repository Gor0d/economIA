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

test("DeepSeek usa a tabela oficial vigente por faixa de horário", () => {
  const flash = PRICING.find((model) => model.id === "deepseek-v4-flash");
  const flashPeak = PRICING.find((model) => model.id === "deepseek-v4-1-flash-peak");
  const pro = PRICING.find((model) => model.id === "deepseek-v4-pro");
  const proPeak = PRICING.find((model) => model.id === "deepseek-v4-pro-peak");
  assert.deepEqual([flash.input, flash.output], [0.15, 0.60]);
  assert.deepEqual([flashPeak.input, flashPeak.output], [0.30, 1.20]);
  assert.deepEqual([pro.input, pro.output], [0.66, 1.98]);
  assert.deepEqual([proPeak.input, proPeak.output], [1.32, 3.96]);
  assert.match(flash.note, /0,003/);
  assert.match(flashPeak.note, /0,006/);
});

test("Gemini 3.6 Flash usa o preço promocional oficial vigente", () => {
  const model = PRICING.find((item) => item.id === "gemini-3.6-flash");
  assert.ok(model, "Gemini 3.6 Flash ausente");
  assert.deepEqual([model.input, model.output, model.batchDiscount], [0.75, 3.75, 0.5]);
});

test("Tencent Hy4 Preview usa os preços oficiais de lançamento", () => {
  const model = PRICING.find((item) => item.id === "tencent-hy4-preview");
  assert.ok(model, "Tencent Hy4 Preview ausente");
  assert.deepEqual([model.input, model.output], [0.834, 2.501]);
  assert.match(model.note, /0,042/);
});

test("novos modelos incluídos usam os preços oficiais", () => {
  const expected = new Map([
    ["gpt-6-astra", [10, 50, 0.5]],
    ["gpt-6-sol", [2, 10, 0.5]],
    ["gpt-6-luna", [0.1, 0.5, 0.5]],
    ["claude-opus-5-5", [4, 20, 0.5]],
    ["gemini-3.8-flash", [0.75, 3.75, 0.5]],
    ["grok-4.7", [2, 6, undefined]],
    ["kimi-k2.7-code", [0.95, 4, undefined]],
    ["kimi-k2.7-code-highspeed", [1.9, 8, undefined]],
    ["kimi-k2.6", [0.95, 4, undefined]],
    ["glm-5.3", [1.4, 4.4, undefined]],
    ["glm-5.3-flash", [0.15, 0.5, undefined]],
    ["glm-5.3-flashx", [0.37, 1.25, undefined]],
    ["minimax-m3-priority", [0.45, 1.8, undefined]],
    ["jev", [0.042, 0, undefined]],
  ]);

  for (const [id, prices] of expected) {
    const model = PRICING.find((item) => item.id === id);
    assert.ok(model, `${id} ausente`);
    assert.deepEqual([model.input, model.output, model.batchDiscount], prices, id);
  }
});
