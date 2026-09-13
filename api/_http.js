const buckets = new Map();

function clientKey(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  return String(Array.isArray(forwarded) ? forwarded[0] : forwarded || req.headers?.["x-real-ip"] || "unknown")
    .split(",")[0]
    .trim();
}

function requestBodyTooLarge(req, maxBytes) {
  const contentLength = Number(req.headers?.["content-length"] || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) return true;
  if (req.body === undefined || req.body === null) return false;
  try {
    return Buffer.byteLength(JSON.stringify(req.body), "utf8") > maxBytes;
  } catch {
    return true;
  }
}

function applyRateLimit(req, res, { limit = 60, windowMs = 60_000, scope = "api" } = {}) {
  const now = Date.now();
  const key = `${scope}:${clientKey(req)}`;
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + windowMs };
  bucket.count += 1;
  buckets.set(key, bucket);

  const remaining = Math.max(0, limit - bucket.count);
  const resetSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  res.setHeader("RateLimit-Limit", String(limit));
  res.setHeader("RateLimit-Remaining", String(remaining));
  res.setHeader("RateLimit-Reset", String(resetSeconds));

  if (bucket.count > limit) {
    res.setHeader("Retry-After", String(resetSeconds));
    res.status(429).json({ error: "Muitas requisições. Tente novamente em instantes." });
    return false;
  }

  if (buckets.size > 5_000) {
    for (const [bucketKey, value] of buckets) if (value.resetAt <= now) buckets.delete(bucketKey);
  }
  return true;
}

function guardRequest(req, res, options = {}) {
  if (requestBodyTooLarge(req, options.maxBytes || 16_384)) {
    res.status(413).json({ error: "Corpo da requisição excede o limite permitido." });
    return false;
  }
  return applyRateLimit(req, res, options);
}

module.exports = { applyRateLimit, guardRequest, requestBodyTooLarge };
