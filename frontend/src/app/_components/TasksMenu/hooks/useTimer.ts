import { useState, useEffect } from "react";

export const useTimer = (onTick?: () => void) => {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let interval: number | undefined;
    if (isRunning) {
      interval = window.setInterval(() => {
        setTime((prev) => prev + 1);
        onTick?.();
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, onTick]);

  const start = () => setIsRunning(true);
  const stop = () => setIsRunning(false);
  const toggle = () => setIsRunning((prev) => !prev);
  const reset = () => {
    setTime(0);
    setIsRunning(false);
  };

  return {
    time,
    isRunning,
    start,
    stop,
    toggle,
    reset,
  };
};
