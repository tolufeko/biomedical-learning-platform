import { evaluate } from 'mathjs';

export function evaluateExpr(expr: string, x: number): number | null {
  try {
    const result = evaluate(expr, { x });
    return typeof result === 'number' && isFinite(result) ? result : null;
  } catch {
    return null;
  }
}