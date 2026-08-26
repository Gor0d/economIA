const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createElement(id = "", dataset = {}) {
  const classes = new Set();
  return {
    id,
    dataset,
    value: "",
    innerHTML: "",
    textContent: "",
    hidden: false,
    disabled: false,
    children: [],
    listeners: {},
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      toggle(name, force) {
        if (force) classes.add(name);
        else classes.delete(name);
      },
    },
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
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
    "totalTokens",
    "outputShare",
    "shareValue",
    "splitSummary",
    "detailedFields",
    "totalFields",
    "modelUsed",
    "modelSearch",
    "providerFilter",
    "currency",
    "rate",
    "rateWrap",
    "rateStatus",
    "refreshRate",
    "presetBtn",
    "results",
    "resultCount",
    "noResults",
    "usedSummary",
    "emptyState",
    "pricingDate",
    "pricingDateTop",
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, createElement(id)]));
  elements.inputTokens.value = "1000000";
  elements.outputTokens.value = "200000";
  elements.totalTokens.value = "1200000";
  elements.outputShare.value = "20";
  elements.currency.value = "USD";
  elements.rate.value = "5.30";
  elements.modelSearch.value = "";
  elements.providerFilter.value = "";

  const usageModeButtons = [
    createElement("", { usageMode: "detailed" }),
    createElement("", { usageMode: "total" }),
  ];
  const ratioPresetButtons = [
    createElement("", { outputShare: "15" }),
    createElement("", { outputShare: "30" }),
    createElement("", { outputShare: "40" }),
  ];
  const volumeButtons = [
    createElement("", { tokenTotal: "100000" }),
    createElement("", { tokenTotal: "1000000" }),
  ];

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
      querySelectorAll(selector) {
        if (selector === "[data-usage-mode]") return usageModeButtons;
        if (selector === "[data-output-share]") return ratioPresetButtons;
        if (selector === "[data-token-total]") return volumeButtons;
        return [];
      },
    },
    setTimeout,
    clearTimeout,
  });

  for (const file of ["pricing.js", "calculator.js", "app.js"]) {
    const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    vm.runInContext(source, context, { filename: file });
  }

  return { elements, usageModeButtons, ratioPresetButtons, volumeButtons };
}

test("interface renderiza, atualiza câmbio e executa o preset", async () => {
  const { elements, usageModeButtons } = createAppContext();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal((elements.results.innerHTML.match(/<tr/g) || []).length, 30);
  assert.match(elements.usedSummary.innerHTML, /\$20\.00/);
  assert.equal(elements.rateWrap.hidden, true);
  assert.equal(elements.rate.value, "5.1526");
  assert.match(elements.rateStatus.textContent, /Automático/);

  elements.presetBtn.listeners.click();
  assert.equal(elements.modelUsed.value, "deepseek-v4-flash");
  assert.equal(elements.inputTokens.value, "267400000");
  assert.equal(elements.outputTokens.value, "114600000");
  assert.match(elements.usedSummary.innerHTML, /\$69\.52/);

  usageModeButtons[1].listeners.click();
  assert.equal(elements.totalFields.hidden, false);
  assert.equal(elements.detailedFields.hidden, true);
  elements.outputShare.value = "20";
  elements.totalTokens.value = "10000000";
  elements.totalTokens.listeners.input();
  assert.equal(elements.inputTokens.value, "8000000");
  assert.equal(elements.outputTokens.value, "2000000");

  elements.currency.value = "BRL";
  elements.currency.listeners.input();
  assert.equal(elements.rateWrap.hidden, false);
  assert.match(elements.usedSummary.innerHTML, /R\$/);

  elements.rate.value = "-2";
  elements.rate.listeners.input();
  assert.equal(elements.emptyState.hidden, false);
  assert.match(elements.emptyState.textContent, /maior que zero/);
});

test("busca reduz o ranking sem alterar o cálculo principal", async () => {
  const { elements } = createAppContext();
  await new Promise((resolve) => setImmediate(resolve));

  elements.modelSearch.value = "deepseek";
  elements.modelSearch.listeners.input();
  assert.equal((elements.results.innerHTML.match(/<tr/g) || []).length, 2);
  assert.equal(elements.resultCount.textContent, "2 modelos");
  assert.match(elements.usedSummary.innerHTML, /\$20\.00/);
});
