const { comparePrices } = require("./_comparison.js");

module.exports = function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  try {
    return res.status(200).json(comparePrices(req.body || {}));
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message, details: error.details });
  }
};
