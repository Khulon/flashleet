import { useState, useEffect, useRef, useCallback } from "react";

export function useTimer() {
  const [elapsed, setElapsed] = useState(0); // ms displayed
  const [running, setRunning] = useState(false);

  // Time at which the current "run" started (null when paused/stopped)
  const runStartRef   = useRef<number | null>(null);
  // Accumulated ms from previous runs (before pause/stop)
  const accumulatedRef = useRef<number>(0);
  // Whether start() has ever been called for the current card
  const startedRef    = useRef<boolean>(false);
  const intervalRef   = useRef<NodeJS.Timeout | null>(null);

  const start = useCallback(() => {
    accumulatedRef.current = 0;
    runStartRef.current    = Date.now();
    startedRef.current     = true;
    setElapsed(0);
    setRunning(true);
  }, []);

  // Pause without resetting — safe to call even if already paused
  const pause = useCallback(() => {
    if (!startedRef.current || runStartRef.current === null) return;
    accumulatedRef.current += Date.now() - runStartRef.current;
    runStartRef.current = null;
    setRunning(false);
  }, []);

  // Resume from a pause — no-op if never started or already running
  const resume = useCallback(() => {
    if (!startedRef.current || runStartRef.current !== null) return;
    runStartRef.current = Date.now();
    setRunning(true);
  }, []);

  // Stop and return the total elapsed ms (including any paused periods)
  const stop = useCallback((): number => {
    const total =
      accumulatedRef.current +
      (runStartRef.current !== null ? Date.now() - runStartRef.current : 0);
    setRunning(false);
    runStartRef.current     = null;
    startedRef.current      = false;
    accumulatedRef.current  = 0;
    return total;
  }, []);

  const reset = useCallback(() => {
    setRunning(false);
    setElapsed(0);
    runStartRef.current    = null;
    startedRef.current     = false;
    accumulatedRef.current = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        if (runStartRef.current !== null) {
          setElapsed(accumulatedRef.current + (Date.now() - runStartRef.current));
        }
      }, 100);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  return { elapsed, running, formatted: formatTime(elapsed), start, stop, reset, pause, resume };
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
