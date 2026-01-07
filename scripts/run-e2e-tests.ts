/**
 * E2E Test Runner
 * 
 * Runs all E2E tests in sequence and reports results.
 */

const tests = [
  "tests/e2e-tester-bot.ts",
  "tests/e2e-multi-file.ts",
  "tests/e2e-error-recovery.ts",
  "tests/e2e-shell.ts",
  "tests/e2e-git.ts",
  "tests/e2e-orchestration.ts",
  "tests/e2e-complex-refactor.ts"
];

async function runTests() {
  const filter = Deno.args[0];
  const testsToRun = filter 
    ? tests.filter(t => t.includes(filter)) 
    : tests;

  if (testsToRun.length === 0) {
    console.log(`❌ No tests found matching: ${filter}`);
    Deno.exit(1);
  }

  console.log(`🚀 Starting E2E Test Suite Execution (${testsToRun.length} tests)...\n`);
  
  const results = [];
  
  for (const test of testsToRun) {
    console.log(`\n🏃 Running: ${test}`);
    console.log('━'.repeat(40));
    
    const command = new Deno.Command("deno", {
      args: ["run", "--allow-all", test],
      stdout: "inherit",
      stderr: "inherit",
    });
    
    const { success, code } = await command.output();
    
    results.push({
      test,
      success,
      code
    });
    
    console.log('━'.repeat(40));
    if (success) {
      console.log(`✅ ${test} finished successfully.`);
    } else {
      console.log(`❌ ${test} failed with exit code ${code}.`);
    }
  }
  
  console.log('\n' + '━'.repeat(60));
  console.log('📊 FINAL TEST REPORT');
  console.log('━'.repeat(60));
  
  let allPassed = true;
  for (const result of results) {
    const status = result.success ? "✅ PASSED" : "❌ FAILED";
    console.log(`${status.padEnd(10)} | ${result.test}`);
    if (!result.success) allPassed = false;
  }
  
  console.log('━'.repeat(60));
  if (allPassed) {
    console.log('\n✨ ALL TESTS PASSED! ✨\n');
    Deno.exit(0);
  } else {
    console.log('\n⚠️  SOME TESTS FAILED. ⚠️\n');
    Deno.exit(1);
  }
}

if (import.meta.main) {
  runTests();
}
