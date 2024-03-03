export function diffHrtime(hrtime: [number, number]): string {
  return (hrtime[0] + hrtime[1] / 1e9).toFixed(3);
}
