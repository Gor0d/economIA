(function initI18n(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.EconomIAI18n = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createI18n() {
  "use strict";

  const DEFAULT_LOCALE = "pt-BR";
  const STORAGE_KEY = "economia-locale";
  const SUPPORTED_LOCALES = Object.freeze(["pt-BR", "en"]);

  const messages = Object.freeze({
    "pt-BR": Object.freeze({
      unavailable: "Indisponível",
      model: "modelo",
      models: "modelos",
      provider: "provedor",
      providers: "provedores",
      turn: "turno",
      turns: "turnos",
      input: "entrada",
      output: "saída",
      tokens: "tokens",
    }),
    en: Object.freeze({
      unavailable: "Unavailable",
      model: "model",
      models: "models",
      provider: "provider",
      providers: "providers",
      turn: "turn",
      turns: "turns",
      input: "input",
      output: "output",
      tokens: "tokens",
    }),
  });

  function normalizeLocale(locale, fallback = DEFAULT_LOCALE) {
    const normalized = String(locale || "").trim().toLowerCase();
    if (normalized === "en" || normalized.startsWith("en-")) return "en";
    if (normalized === "pt" || normalized.startsWith("pt-")) return "pt-BR";
    return SUPPORTED_LOCALES.includes(fallback) ? fallback : DEFAULT_LOCALE;
  }

  function readStoredLocale(storage) {
    try {
      return normalizeLocale(storage?.getItem(STORAGE_KEY), DEFAULT_LOCALE);
    } catch {
      return DEFAULT_LOCALE;
    }
  }

  function interpolate(template, variables = {}) {
    return String(template).replace(/\{(\w+)\}/g, (match, key) =>
      Object.prototype.hasOwnProperty.call(variables, key) ? String(variables[key]) : match
    );
  }

  function translate(key, { locale = DEFAULT_LOCALE, variables, fallback = key } = {}) {
    const resolved = normalizeLocale(locale);
    const message = messages[resolved]?.[key] ?? messages[DEFAULT_LOCALE]?.[key] ?? fallback;
    return interpolate(message, variables);
  }

  function formatNumber(value, locale = DEFAULT_LOCALE, options = {}) {
    return new Intl.NumberFormat(normalizeLocale(locale), options).format(value);
  }

  function formatCurrency(value, currency, locale = DEFAULT_LOCALE, options = {}) {
    const resolved = normalizeLocale(locale);
    return new Intl.NumberFormat(resolved, {
      style: "currency",
      currency,
      maximumFractionDigits: Math.abs(value) < 0.01 ? 4 : 2,
      ...options,
    }).format(value);
  }

  function formatDate(value, locale = DEFAULT_LOCALE, options = {}) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value ?? "");
    return new Intl.DateTimeFormat(normalizeLocale(locale), options).format(date);
  }

  function setDocumentLocale(locale, { storage, documentRef } = {}) {
    const resolved = normalizeLocale(locale);
    try {
      storage?.setItem(STORAGE_KEY, resolved);
    } catch {
      // Persistência é opcional; a preferência ainda vale durante a sessão.
    }
    if (documentRef?.documentElement) documentRef.documentElement.lang = resolved;
    return resolved;
  }

  return Object.freeze({
    DEFAULT_LOCALE,
    STORAGE_KEY,
    SUPPORTED_LOCALES,
    formatCurrency,
    formatDate,
    formatNumber,
    interpolate,
    messages,
    normalizeLocale,
    readStoredLocale,
    setDocumentLocale,
    translate,
  });
});
