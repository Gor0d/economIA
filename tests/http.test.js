const test = require("node:test");
const assert = require("node:assert/strict");
const { applyRateLimit, requestBodyTooLarge } = require("../api/_http.js");

function response() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("limita requisições repetidas e informa quando tentar novamente", () => {
  const req = { headers: { "x-forwarded-for": "203.0.113.8" } };
  assert.equal(applyRateLimit(req, response(), { limit: 1, scope: "test" }), true);
  const res = response();
  assert.equal(applyRateLimit(req, res, { limit: 1, scope: "test" }), false);
  assert.equal(res.statusCode, 429);
  assert.ok(Number(res.headers["Retry-After"]) > 0);
});

test("detecta corpo acima do limite pelo Content-Length", () => {
  assert.equal(requestBodyTooLarge({ headers: { "content-length": "200" } }, 100), true);
  assert.equal(requestBodyTooLarge({ headers: {} }, 100), false);
  assert.equal(requestBodyTooLarge({ headers: {}, body: { text: "x".repeat(200) } }, 100), true);
});
