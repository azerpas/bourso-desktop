import { COLORS } from "../constants";

/**
 * Get color from index, generates random color if index > COLORS.length
 * @param index Index of color to get
 * @returns Color in HSL format
 */
export function getColor(index: number): string {
  if (index < COLORS.length) {
    return COLORS[index];
  }

  // Generate seeded random color based on index
  const h = Math.floor(Math.random() * 360);
  const s = Math.floor(Math.random() * 30) + 70; // 70-100%
  const l = Math.floor(Math.random() * 30) + 35; // 35-65%

  return `hsl(${h}, ${s}%, ${l}%)`;
}
