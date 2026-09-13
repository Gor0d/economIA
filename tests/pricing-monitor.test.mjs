import test from "node:test";
import assert from "node:assert/strict";
import { reconcileSnapshot } from "../scripts/pricing-monitor-core.mjs";

const checkedAt = "2026-09-13T12:00:00.000Z";
const result = { hash: "new", url: "https://example.com/pricing" };

test("mantém a baseline e o alerta até uma revisão explícita", () => {
  const first = reconcileSnapshot({ hash: "old", url: result.url }, result, { checkedAt });
  assert.equal(first.entry.hash, "old");
  assert.equal(first.entry.pendingHash, "new");
  assert.equal(first.changed, true);
  assert.equal(first.newlyDetected, true);

  const next = reconcileSnapshot(first.entry, result, { checkedAt: "2026-09-14T12:00:00.000Z" });
  assert.equal(next.changed, true);
  assert.equal(next.newlyDetected, false);
  assert.equal(next.entry.changeDetectedAt, checkedAt);
});

test("aceita a nova baseline somente com --accept", () => {
  const reconciled = reconcileSnapshot(
    { hash: "old", pendingHash: "new", changeDetectedAt: checkedAt, url: result.url },
    result,
    { accept: true, checkedAt: "2026-09-15T12:00:00.000Z" }
  );
  assert.deepEqual(reconciled.entry, {
    hash: "new",
    url: result.url,
    checkedAt: "2026-09-15T12:00:00.000Z",
  });
  assert.equal(reconciled.accepted, true);
  assert.equal(reconciled.changed, false);
});
