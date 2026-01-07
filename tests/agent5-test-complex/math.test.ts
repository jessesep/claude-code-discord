/**
 * Test suite for math.ts
 */

import {
  add,
  multiply,
  factorial,
  power,
  isPrime,
  MathResult
} from "./math.ts";

// Test add function
console.log("Testing add function...");
console.assert(add(2, 3) === 5, "add(2, 3) should be 5");
console.assert(add(1, 2, 3, 4, 5) === 15, "add(1,2,3,4,5) should be 15");
console.assert(add(0) === 0, "add(0) should be 0");
console.assert(add(-5, 10) === 5, "add(-5, 10) should be 5");
console.log("✓ add() tests passed");

// Test multiply function
console.log("Testing multiply function...");
console.assert(multiply(2, 3) === 6, "multiply(2, 3) should be 6");
console.assert(multiply(2, 3, 4) === 24, "multiply(2, 3, 4) should be 24");
console.assert(multiply(5) === 5, "multiply(5) should be 5");
console.assert(multiply(0, 100) === 0, "multiply(0, 100) should be 0");
console.log("✓ multiply() tests passed");

// Test factorial function
console.log("Testing factorial function...");
console.assert(factorial(0) === 1, "factorial(0) should be 1");
console.assert(factorial(1) === 1, "factorial(1) should be 1");
console.assert(factorial(5) === 120, "factorial(5) should be 120");
console.assert(factorial(6) === 720, "factorial(6) should be 720");
console.log("✓ factorial() tests passed");

// Test power function
console.log("Testing power function...");
console.assert(power(2, 3) === 8, "power(2, 3) should be 8");
console.assert(power(5, 2) === 25, "power(5, 2) should be 25");
console.assert(power(10, 0) === 1, "power(10, 0) should be 1");
console.assert(power(2, -1) === 0.5, "power(2, -1) should be 0.5");
console.log("✓ power() tests passed");

// Test isPrime function
console.log("Testing isPrime function...");
console.assert(isPrime(2) === true, "isPrime(2) should be true");
console.assert(isPrime(3) === true, "isPrime(3) should be true");
console.assert(isPrime(4) === false, "isPrime(4) should be false");
console.assert(isPrime(17) === true, "isPrime(17) should be true");
console.assert(isPrime(1) === false, "isPrime(1) should be false");
console.assert(isPrime(0) === false, "isPrime(0) should be false");
console.log("✓ isPrime() tests passed");

console.log("\n=== All tests passed! ===");
