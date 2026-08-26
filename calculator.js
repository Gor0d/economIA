(function initCalculatorCore(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.CalculatorCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCalculatorCore() {
  function normalizeNumericPart(rawNumber, hasSuffix) {
    if (!/^\d[\d.,]*$/.test(rawNumber)) return null;

    const dots = (rawNumber.match(/\./g) || []).length;
    const commas = (rawNumber.match(/,/g) || []).length;

    if (dots > 0 && commas > 0) {
      const decimalSeparator = rawNumber.lastIndexOf(".") > rawNumber.lastIndexOf(",") ? "." : ",";
      const groupingSeparator = decimalSeparator === "." ? "," : ".";
      const withoutGrouping = rawNumber.split(groupingSeparator).join("");
      const parts = withoutGrouping.split(decimalSeparator);
      if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
      return `${parts[0]}.${parts[1]}`;
    }

    const separator = dots ? "." : commas ? "," : null;
    if (!separator) return rawNumber;

    const parts = rawNumber.split(separator);
    if (parts.some((part) => part === "")) return null;

    if (parts.length > 2) {
      const validThousands = parts[0].length <= 3 && parts.slice(1).every((part) => part.length === 3);
      return validThousands ? parts.join("") : null;
    }

    const [integerPart, fractionPart] = parts;
    const looksLikeThousands = !hasSuffix && integerPart.length <= 3 && fractionPart.length === 3;
    return looksLikeThousands ? `${integerPart}${fractionPart}` : `${integerPart}.${fractionPart}`;
  }

  function parseTokenValue(raw) {
    if (raw === null || raw === undefined) return NaN;

    const compact = String(raw).trim().toLowerCase().replace(/\s/g, "");
    if (!compact) return NaN;

    const match = compact.match(/^(\d[\d.,]*)(k|m|mm|b)?$/);
    if (!match) return NaN;

    const suffix = match[2];
    const normalized = normalizeNumericPart(match[1], Boolean(suffix));
    if (!normalized) return NaN;

    const number = Number(normalized);
    const multiplier = suffix === "k" ? 1e3 : suffix === "m" || suffix === "mm" ? 1e6 : suffix === "b" ? 1e9 : 1;
    const result = number * multiplier;

    if (!Number.isFinite(result)) return NaN;

    const rounded = Math.round(result);
    return Math.abs(result - rounded) < 1e-6 ? rounded : result;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
  }

  function formatMoney(value, currency) {
    return new Intl.NumberFormat(currency === "BRL" ? "pt-BR" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: Math.abs(value) < 10 ? 4 : 2,
    }).format(value);
  }

  function calcCost(model, inputTokens, outputTokens) {
    return (inputTokens / 1e6) * model.input + (outputTokens / 1e6) * model.output;
  }

  function isValidExchangeRate(value) {
    return Number.isFinite(value) && value > 0;
  }

  const MAX_TOKENS_PER_FIELD = 1e12; // 1 trilhão — acima disso a precisão de ponto flutuante já não é confiável

  function splitTokenTotal(totalTokens, outputSharePercent) {
    const total = Number(totalTokens);
    const share = Number(outputSharePercent);
    if (!Number.isFinite(total) || total < 0 || !Number.isFinite(share) || share < 0 || share > 100) {
      return { inputTokens: NaN, outputTokens: NaN };
    }

    const outputTokens = Math.round(total * (share / 100));
    return { inputTokens: total - outputTokens, outputTokens };
  }

  return {
    calcCost,
    formatMoney,
    formatNumber,
    isValidExchangeRate,
    MAX_TOKENS_PER_FIELD,
    parseTokenValue,
    splitTokenTotal,
  };
});
