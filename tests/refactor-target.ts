export function calculateSum(a: number, b: number): number {
  console.log("Calculating sum...");
  return a + b;
}

export function main() {
  const result = calculateSum(5, 10);
  console.log("Result is:", result);
}
