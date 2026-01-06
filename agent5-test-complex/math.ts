/**
 * Mathematical utility functions with TypeScript types
 */

export interface MathResult {
  operation: string;
  operands: number[];
  result: number;
}

/**
 * Add two or more numbers
 * @param numbers - Numbers to add
 * @returns Sum of all numbers
 */
export function add(...numbers: number[]): number {
  return numbers.reduce((sum, n) => sum + n, 0);
}

/**
 * Multiply two or more numbers
 * @param numbers - Numbers to multiply
 * @returns Product of all numbers
 */
export function multiply(...numbers: number[]): number {
  return numbers.reduce((product, n) => product * n, 1);
}

/**
 * Calculate factorial
 * @param n - Input number
 * @returns Factorial of n
 */
export function factorial(n: number): number {
  if (n < 0) throw new Error("Factorial of negative numbers is not defined");
  if (n === 0 || n === 1) return 1;
  return n * factorial(n - 1);
}

/**
 * Calculate power
 * @param base - Base number
 * @param exponent - Exponent
 * @returns Base raised to exponent
 */
export function power(base: number, exponent: number): number {
  return Math.pow(base, exponent);
}

/**
 * Check if a number is prime
 * @param n - Number to check
 * @returns True if prime, false otherwise
 */
export function isPrime(n: number): boolean {
  if (n <= 1) return false;
  if (n <= 3) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;

  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}
