const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createElement(id = "") {
  return {
    id,
    value: "",
    innerHTML: "",
    textContent: "",
    hidden: false,
    disabled: false,
    children: [],
    listeners: {},
    classList: {
      add() {},
      remove() {},
    },
    addEventListener(type, listener) {
      this.listeners[type] = listener;
    },
    appendChild(child) {
      this.children.push(child);
      if (this.id === "modelUsed" && !this.value && child.children[0]) {
        this.value = child.children[0].value;
      }
    },
  };
}

function createAppContext() {
  const ids = [
    "inputTokens",
    "outputTokens",
    "modelUsed",
    "currency",
    "rate",
    "rateWrap",
    "rateStatus",
    "refreshRate",
    "presetBtn",
    "results",
    "usedSummary",
    "emptyState",
    "pricingDate",
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, createElement(id)]));
  elements.inputTokens.value = "1000000";
  elements.outputTokens.value = "200000";
  elements.currency.value = "USD";
  elements.rate.value = "5.30";

  const storage = new Map();
  const context = vm.createContext({
    AbortController,
    console,
    Date,
    fetch: async () => ({
      ok: true,
      json: async () => ({ date: "2026-08-26", base: "USD", quote: "BRL", rate: 5.1526 }),
    }),
    Intl,
    localStorage: {
      getItem(key) {
        return storage.get(key) ?? null;
      },
      setItem(key, value) {
        storage.set(key, value);
      },
    },
    document: {
      createElement: () => createElement(),
      getElementById: (id) => elements[id],
    },
    setTimeout,
    clearTimeout,
  });

  for (const file of ["pricing.js", "calculator.js", "app.js"]) {
    const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    vm.runInContext(source, context, { filename: file });
  }

  return { elements };
}

test("interface renderiza, atualiza câmbio e executa o preset", async () => {
  const { elements } = createAppContext();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal((elements.results.innerHTML.match(/<tr/g) || []).length, 30);
  assert.match(elements.usedSummary.innerHTML, /\$20\.00/);
  assert.equal(elements.rateWrap.hidden, true);
  assert.equal(elements.rate.value, "5.1526");
  assert.match(elements.rateStatus.textContent, /Automático/);

  elements.presetBtn.listeners.click();
  assert.equal(elements.modelUsed.value, "deepseek-v4-flash");
  assert.equal(elements.inputTokens.value, 267_400_000);
  assert.equal(elements.outputTokens.value, 114_600_000);
  assert.match(elements.usedSummary.innerHTML, /\$69\.52/);

  elements.currency.value = "BRL";
  elements.currency.listeners.input();
  assert.equal(elements.rateWrap.hidden, false);
  assert.match(elements.usedSummary.innerHTML, /R\$/);

  elements.rate.value = "-2";
  elements.rate.listeners.input();
  assert.equal(elements.emptyState.hidden, false);
  assert.match(elements.emptyState.textContent, /maior que zero/);
});
