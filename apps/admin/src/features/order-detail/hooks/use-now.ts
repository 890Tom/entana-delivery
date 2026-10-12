import { useEffect, useState } from "react";

/**
 * The current instant, read again when the tab gets the focus back: a sheet left open overnight
 * must not offer yesterday's "today" as a delivery day. The clock is given to the rules, which
 * never read it themselves.
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = (): void => {
      setNow(new Date());
    };
    window.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return now;
}
