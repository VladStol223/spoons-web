// src/hooks/useCopypartyAutoSync.js
import { useEffect, useMemo, useRef, useState } from "react";
import { createBackoff, bumpBackoff, resetBackoff, isDirty, syncUploadOnce, getLastSyncAt, getLastChangeAt, getLastSyncError } from "../copypartySync";

export default function useCopypartyAutoSync({ enabled, baseCpPath, username, password, getDataObj, debounceMs, intervalMs }) {
  const debMs = Number.isFinite(Number(debounceMs)) ? Number(debounceMs) : 5000;
  const intMs = Number.isFinite(Number(intervalMs)) ? Number(intervalMs) : 10 * 60 * 1000;

  const backoffRef = useRef(createBackoff());
  const debounceTimerRef = useRef(null);
  const intervalTimerRef = useRef(null);
  const inFlightRef = useRef(false);

  const [syncState, setSyncState] = useState(() => ({ dirty: isDirty(), lastSyncAt: getLastSyncAt(), lastChangeAt: getLastChangeAt(), lastError: getLastSyncError(), lastResult: null }));

  const canSync = !!(enabled && username && password && baseCpPath);

  const snapshot = useMemo(() => ({ dirty: isDirty(), lastSyncAt: getLastSyncAt(), lastChangeAt: getLastChangeAt(), lastError: getLastSyncError() }), [username, password, baseCpPath, enabled]);

  useEffect(() => { setSyncState((s) => ({ ...s, ...snapshot })); }, [snapshot.dirty, snapshot.lastSyncAt, snapshot.lastChangeAt, snapshot.lastError]);

  async function runUpload(reason) {
    if (!canSync) return;
    if (inFlightRef.current) return;
    if (!isDirty()) return;

    inFlightRef.current = true;

    const res = await syncUploadOnce({ baseCpPath, username, password, getDataObj });

    inFlightRef.current = false;

    if (res.ok) backoffRef.current = resetBackoff(backoffRef.current);
    if (!res.ok) backoffRef.current = bumpBackoff(backoffRef.current);

    setSyncState((s) => ({ ...s, dirty: isDirty(), lastSyncAt: getLastSyncAt(), lastChangeAt: getLastChangeAt(), lastError: getLastSyncError(), lastResult: { ...res, reason, at: Date.now() }, backoff: { ...backoffRef.current } }));

    if (!res.ok && isDirty()) {
      const delay = backoffRef.current.nextDelayMs || 5000;
      window.setTimeout(() => { runUpload("retry_backoff"); }, delay);
    }
  }

  function scheduleDebounced() {
    if (!canSync) return;
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => { runUpload("debounce_flush"); }, debMs);
  }

  useEffect(() => {
    if (!canSync) return;

    if (intervalTimerRef.current) window.clearInterval(intervalTimerRef.current);
    intervalTimerRef.current = window.setInterval(() => { runUpload("interval_flush"); }, intMs);

    return () => { if (intervalTimerRef.current) window.clearInterval(intervalTimerRef.current); intervalTimerRef.current = null; };
  }, [canSync, intMs, username, password, baseCpPath]);

  useEffect(() => {
    if (!canSync) return;

    function onVisibility() { if (document.visibilityState === "hidden") runUpload("visibility_hidden"); }
    function onPageHide() { runUpload("pagehide"); }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [canSync, username, password, baseCpPath]);

  return { canSync, scheduleDebounced, flushNow: () => runUpload("manual_flush"), syncState };
}
