export function reconcileSnapshot(previousEntry, result, { accept = false, checkedAt } = {}) {
  const now = checkedAt || new Date().toISOString();

  if (!previousEntry) {
    return {
      entry: { hash: result.hash, url: result.url, checkedAt: now },
      changed: false,
      newlyDetected: false,
      accepted: false,
    };
  }

  const baselineHash = previousEntry.hash;
  const pendingHash = previousEntry.pendingHash;
  const observedHash = result.hash;

  if (accept) {
    return {
      entry: { hash: observedHash, url: result.url, checkedAt: now },
      changed: false,
      newlyDetected: false,
      accepted: baselineHash !== observedHash || Boolean(pendingHash),
    };
  }

  if (observedHash === baselineHash) {
    return {
      entry: { hash: baselineHash, url: result.url, checkedAt: now },
      changed: false,
      newlyDetected: false,
      accepted: false,
    };
  }

  return {
    entry: {
      hash: baselineHash,
      pendingHash: observedHash,
      url: result.url,
      checkedAt: now,
      changeDetectedAt:
        pendingHash === observedHash && previousEntry.changeDetectedAt
          ? previousEntry.changeDetectedAt
          : now,
    },
    changed: true,
    newlyDetected: pendingHash !== observedHash,
    accepted: false,
  };
}
