/**
 * Standard monetary rounding utility (Half-Up / Commercial Rounding).
 * Ensures monetary precision conforms to 2 decimal places (cents/centavos)
 * and avoids IEEE-754 floating-point inaccuracies (e.g., 0.1 + 0.2 = 0.30000000000000004).
 */
export const roundMoney = (val: number | string | null | undefined): number => {
  const num = typeof val === "number" ? val : Number(val) || 0;
  if (!Number.isFinite(num)) {
    return 0;
  }
  const sign = num < 0 ? -1 : 1;
  const abs = Math.abs(num);
  return sign * (Math.round((abs + Number.EPSILON) * 100) / 100);
};
