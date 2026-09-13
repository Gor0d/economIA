const { listModels } = require("./_comparison.js");
const { guardRequest } = require("./_http.js");

module.exports = function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Expose-Headers", "RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, Retry-After");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!["GET", "HEAD"].includes(req.method)) return res.status(405).json({ error: "Use GET." });
  if (!guardRequest(req, res, { limit: 120, scope: "models" })) return;
  const result = listModels(req.query?.provider);
  if (req.method === "HEAD") return res.status(200).end();
  return res.status(200).json(result);
};
