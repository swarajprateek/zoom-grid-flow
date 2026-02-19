import { useState, useCallback, useRef } from "react";

const MIN_COLUMNS = 2;
const MAX_COLUMNS = 8;

export function usePinchGrid(initialColumns = 4) {
  const [columns, setColumns] = useState(initialColumns);
  const lastScale = useRef(1);

  const onPinch = useCallback(
    ({ delta, first }: { delta: [number, number]; first: boolean }) => {
      if (first) {
        lastScale.current = 1;
      }
      const scaleDelta = delta[0];
      lastScale.current += scaleDelta;

      // Pinch out (zoom in) = fewer columns (bigger photos)
      // Pinch in (zoom out) = more columns (smaller photos)
      if (lastScale.current > 0.3) {
        setColumns((c) => Math.max(MIN_COLUMNS, c - 1));
        lastScale.current = 0;
      } else if (lastScale.current < -0.3) {
        setColumns((c) => Math.min(MAX_COLUMNS, c + 1));
        lastScale.current = 0;
      }
    },
    []
  );

  return { columns, setColumns, onPinch, MIN_COLUMNS, MAX_COLUMNS };
}
