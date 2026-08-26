const test = require("node:test");
const assert = require("node:assert/strict");

const {
  calcCost,
  formatMoney,
  isValidExchangeRate,
  parseTokenValue,
} = require("../calculator.js");

test("interpreta formatos brasileiros e internacionais de tokens", () => {
  const cases = new Map([
    ["1000000", 1_000_000],
    ["1.000.000", 1_000_000],
    ["1,000,000", 1_000_000],
    ["267,4M", 267_400_000],
    ["267.4M", 267_400_000],
    ["1,2B", 1_200_000_000],
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

test("valida câmbio estritamente positivo", () => {
  assert.equal(isValidExchangeRate(5.1526), true);
  assert.equal(isValidExchangeRate(0), false);
  assert.equal(isValidExchangeRate(-2), false);
  assert.equal(isValidExchangeRate(Number.NaN), false);
});

test("formata moeda sem esconder custos pequenos", () => {
  assert.equal(formatMoney(20, "USD"), "$20.00");
  assert.match(formatMoney(0.0028, "USD"), /0\.0028/);
});
