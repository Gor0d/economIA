const test = require("node:test");
const assert = require("node:assert/strict");

const {
  calcCost,
  formatMoney,
  hasBatchDiscount,
  isValidExchangeRate,
  parseTokenValue,
  splitTokenTotal,
} = require("../calculator.js");

test("interpreta formatos brasileiros e internacionais de tokens", () => {
  const cases = new Map([
    ["1000000", 1_000_000],
    ["1.000.000", 1_000_000],
    ["1,000,000", 1_000_000],
    ["267,4M", 267_400_000],
    ["267.4M", 267_400_000],
    ["1,2B", 1_200_000_000],
    ["1T", 1_000_000_000_000],
    ["900k", 900_000],
  ]);

  for (const [input, expected] of cases) {
    assert.equal(parseTokenValue(input), expected, input);
  }
});

test("rejeita entradas ambíguas ou inválidas", () => {
  for (const input of ["", "abc", "-1", "1.2.3M", "1,,2M", "Infinity"]) {
    assert.ok(Number.isNaN(parseTokenValue(input)), input);
  }
});

test("calcula o preset do DeepSeek com os preços oficiais atuais", () => {
  const model = { input: 0.14, output: 0.28 };
  assert.equal(calcCost(model, 267_400_000, 114_600_000), 69.524);
});

test("aplica o desconto de Batch API só quando o modelo tem esse desconto", () => {
  const withBatch = { input: 10, output: 10, batchDiscount: 0.5 };
  const withoutBatch = { input: 10, output: 10 };

  assert.equal(hasBatchDiscount(withBatch), true);
  assert.equal(hasBatchDiscount(withoutBatch), false);

  assert.equal(calcCost(withBatch, 1_000_000, 1_000_000, { batch: true }), 10);
  assert.equal(calcCost(withBatch, 1_000_000, 1_000_000, { batch: false }), 20);
  assert.equal(calcCost(withBatch, 1_000_000, 1_000_000), 20);
  // Sem batchDiscount, pedir batch não muda o preço.
  assert.equal(calcCost(withoutBatch, 1_000_000, 1_000_000, { batch: true }), 20);
});

test("valida câmbio estritamente positivo", () => {
  assert.equal(isValidExchangeRate(5.1526), true);
  assert.equal(isValidExchangeRate(0), false);
  assert.equal(isValidExchangeRate(-2), false);
  assert.equal(isValidExchangeRate(Number.NaN), false);
});

test("divide o total de tokens pelo percentual de saída", () => {
  assert.deepEqual(splitTokenTotal(10_000_000, 20), {
    inputTokens: 8_000_000,
    outputTokens: 2_000_000,
  });
  assert.ok(Number.isNaN(splitTokenTotal(1000, 120).inputTokens));
});

test("formata moeda sem esconder custos pequenos", () => {
  assert.equal(formatMoney(20, "USD"), "$20.00");
  assert.match(formatMoney(0.0028, "USD"), /0\.0028/);
});

test("nao usa casas decimais extras quando 2 casas ja sao suficientes", () => {
  // Regressão: R$ 8,2949 já foi confundido com "8 mil" por ter 4 casas decimais.
  assert.equal(formatMoney(8.2949, "BRL"), "R$ 8,29");
  assert.equal(formatMoney(1, "USD"), "$1.00");
});
