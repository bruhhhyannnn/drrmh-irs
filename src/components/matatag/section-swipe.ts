export function swipedStep(dx: number, dy: number, step: number, lastStep: number) {
  if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy) * 1.5) return null;
  return Math.max(0, Math.min(lastStep, step - Math.sign(dx)));
}
