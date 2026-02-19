import { useState, useCallback, useRef } from "react";

export const SIZE_PRESETS = [
  { columns: 2, label: "XL" },
  { columns: 4, label: "L" },
  { columns: 6, label: "M" },
  { columns: 8, label: "S" },
] as const;

export type SizePreset = (typeof SIZE_PRESETS)[number];

export function usePinchGrid(initialIndex = 1) {
  const [presetIndex, setPresetIndex] = useState(initialIndex);
  const lastScale = useRef(0);

  const columns = SIZE_PRESETS[presetIndex].columns;
  const currentPreset = SIZE_PRESETS[presetIndex];

  const setPresetByIndex = useCallback((idx: number) => {
    setPresetIndex(Math.max(0, Math.min(SIZE_PRESETS.length - 1, idx)));
  }, []);

  const onPinch = useCallback(
    ({ delta, first }: { delta: [number, number]; first: boolean }) => {
      if (first) {
        lastScale.current = 0;
      }
      lastScale.current += delta[0];

      // Pinch out (zoom in) = fewer columns = lower preset index
      if (lastScale.current > 0.3) {
        setPresetIndex((i) => Math.max(0, i - 1));
        lastScale.current = 0;
      } else if (lastScale.current < -0.3) {
        setPresetIndex((i) => Math.min(SIZE_PRESETS.length - 1, i + 1));
        lastScale.current = 0;
      }
    },
    []
  );

  return { columns, presetIndex, currentPreset, setPresetByIndex, onPinch, SIZE_PRESETS };
}
