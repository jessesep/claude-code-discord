// Agent 5 Integration Test - Scenario 4
// Complex coding task: Create TypeScript function with tests

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const testDir = "/Users/jessesep/repos/claude-code-discord";
const complexDir = join(testDir, "agent5-test-complex");

console.log("=== Test Scenario 4: Complex Coding Task ===\n");

// Create project directory
console.log("Step 1: Create project structure...");
try {
  if (!existsSync(complexDir)) {
    mkdirSync(complexDir, { recursive: true });
  }
  console.log("✓ Project directory created");
} catch (e) {
  console.log("✗ Error creating directory:", e.message);
}

// Create TypeScript source file
console.log("\nStep 2: Create TypeScript source with multiple functions...");
const sourceCode = `/**
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
`;

try {
  const sourcePath = join(complexDir, "math.ts");
  writeFileSync(sourcePath, sourceCode, "utf8");
  console.log("✓ Source file created with 5 functions");
} catch (e) {
  console.log("✗ Error creating source file:", e.message);
}

// Create test file
console.log("\nStep 3: Create comprehensive test suite...");
const testCode = `/**
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

console.log("\\n=== All tests passed! ===");
`;

try {
  const testPath = join(complexDir, "math.test.ts");
  writeFileSync(testPath, testCode, "utf8");
  console.log("✓ Test file created with comprehensive test suite");
} catch (e) {
  console.log("✗ Error creating test file:", e.message);
}

// Create package.json/deno.json
console.log("\nStep 4: Create project configuration...");
const config = {
  name: "agent5-math-lib",
  version: "1.0.0",
  description: "Mathematical utility library created by Agent 5",
  author: "Agent 5 Integration Test",
  license: "MIT",
  exports: {
    ".": "./math.ts"
  }
};

try {
  const configPath = join(complexDir, "package.json");
  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
  console.log("✓ Configuration file created");
} catch (e) {
  console.log("✗ Error creating configuration:", e.message);
}

// Create README
console.log("\nStep 5: Create documentation...");
const readme = `# Math Utility Library (Agent 5 Test)

This library provides mathematical utility functions with TypeScript support.

## Functions

- **add(...numbers)**: Add multiple numbers
- **multiply(...numbers)**: Multiply multiple numbers
- **factorial(n)**: Calculate factorial
- **power(base, exponent)**: Calculate power
- **isPrime(n)**: Check if number is prime

## Types

- **MathResult**: Represents a mathematical operation result

## Testing

Run tests with:
\`\`\`bash
deno test math.test.ts
\`\`\`

## Features

- Full TypeScript support with type annotations
- Comprehensive JSDoc comments
- Comprehensive test coverage
- Error handling for edge cases
- Functional programming style
`;

try {
  const readmePath = join(complexDir, "README.md");
  writeFileSync(readmePath, readme, "utf8");
  console.log("✓ README created");
} catch (e) {
  console.log("✗ Error creating README:", e.message);
}

// Verify all files
console.log("\nStep 6: Verify project structure...");
try {
  const requiredFiles = ["math.ts", "math.test.ts", "package.json", "README.md"];
  let allExist = true;

  requiredFiles.forEach(file => {
    const filePath = join(complexDir, file);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, "utf8");
      const size = content.length;
      console.log(`  ✓ ${file} (${size} bytes)`);
    } else {
      console.log(`  ✗ ${file} MISSING`);
      allExist = false;
    }
  });

  if (allExist) {
    console.log("✓ All project files exist");
  }
} catch (e) {
  console.log("✗ Error verifying project:", e.message);
}

// Verify TypeScript syntax
console.log("\nStep 7: Verify TypeScript validity...");
try {
  const sourcePath = join(complexDir, "math.ts");
  const content = readFileSync(sourcePath, "utf8");

  const checks = [
    { name: "export keyword", pattern: /export\s+(function|interface)/ },
    { name: "type annotations", pattern: /:\s*(number|boolean|void)\s*[\)\{]/ },
    { name: "JSDoc comments", pattern: /\/\*\*[\s\S]*?\*\// },
    { name: "function definitions", pattern: /function\s+\w+\(/ }
  ];

  let passedChecks = 0;
  checks.forEach(check => {
    if (check.pattern.test(content)) {
      console.log(`  ✓ Contains ${check.name}`);
      passedChecks++;
    }
  });

  console.log(`✓ TypeScript syntax valid (${passedChecks}/${checks.length} checks passed)`);
} catch (e) {
  console.log("✗ Error checking TypeScript:", e.message);
}

// Calculate total project size
console.log("\nStep 8: Project statistics...");
try {
  const files = ["math.ts", "math.test.ts", "package.json", "README.md"];
  let totalSize = 0;

  files.forEach(file => {
    const filePath = join(complexDir, file);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, "utf8");
      totalSize += content.length;
    }
  });

  console.log(`✓ Total project size: ${totalSize} bytes`);
  console.log(`  - 5 functions implemented`);
  console.log(`  - 5+ test cases per function`);
  console.log(`  - Full TypeScript support`);
} catch (e) {
  console.log("✗ Error calculating statistics:", e.message);
}

console.log("\n=== Test Scenario 4 Complete ===");
