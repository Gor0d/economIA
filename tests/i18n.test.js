const test = require("node:test");
const assert = require("node:assert/strict");

const I18n = require("../i18n.js");

test("normaliza variantes regionais para os idiomas suportados", () => {
  assert.equal(I18n.normalizeLocale("pt-PT"), "pt-BR");
  assert.equal(I18n.normalizeLocale("en-US"), "en");
  assert.equal(I18n.normalizeLocale("es-ES"), "pt-BR");
});

test("traduz termos compartilhados com fallback seguro", () => {
  assert.equal(I18n.translate("models", { locale: "pt-BR" }), "modelos");
  assert.equal(I18n.translate("models", { locale: "en" }), "models");
  assert.equal(I18n.translate("missing", { locale: "en", fallback: "Fallback" }), "Fallback");
});

test("formata números, moedas e datas conforme o locale", () => {
  assert.equal(I18n.formatNumber(1234.5, "pt-BR"), "1.234,5");
  assert.equal(I18n.formatNumber(1234.5, "en"), "1,234.5");
  assert.match(I18n.formatCurrency(12.5, "USD", "en"), /^\$12\.50$/);
  assert.equal(I18n.formatDate("2026-08-28T12:00:00", "en", { dateStyle: "short" }), "8/28/26");
});

test("persiste o idioma e atualiza o atributo lang do documento", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
  const documentRef = { documentElement: { lang: "pt-BR" } };

  assert.equal(I18n.setDocumentLocale("en-US", { storage, documentRef }), "en");
  assert.equal(I18n.readStoredLocale(storage), "en");
  assert.equal(documentRef.documentElement.lang, "en");
});
