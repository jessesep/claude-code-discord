/**
 * Simple Node.js test for Cursor CLI
 * Run with: node tests/test-cursor-simple.mjs
 */

import { spawn } from 'child_process';

console.log('🧪 Testing Cursor CLI Integration\n');
console.log('='.repeat(50));

// Test 1: Basic Cursor CLI call
console.log('\n📝 Test 1: Basic Cursor CLI Response');
console.log('-'.repeat(50));

const testCursor = () => {
  return new Promise((resolve, reject) => {
    const proc = spawn('cursor', [
      'agent',
      '--print',
      '--output-format',
      'json',
      'List the files in the current directory and count them'
    ]);

    let output = '';
    let errorOutput = '';
    const startTime = Date.now();

    proc.stdout.on('data', (data) => {
      output += data.toString();
      // Show progress
      process.stdout.write('.');
    });

    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    proc.on('close', (code) => {
      const duration = Date.now() - startTime;
      console.log('\n');

      if (code === 0) {
        console.log('✅ Test 1 PASSED');
        console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
        console.log(`Output length: ${output.length} characters`);
        console.log(`\nResponse preview:\n${output.substring(0, 300)}...\n`);
        resolve({ success: true, output, duration });
      } else {
        console.log('❌ Test 1 FAILED');
        console.log(`Exit code: ${code}`);
        console.log(`Error: ${errorOutput}`);
        reject(new Error(`Cursor failed with code ${code}`));
      }
    });

    // Timeout after 60 seconds
    setTimeout(() => {
      proc.kill();
      reject(new Error('Test timeout after 60s'));
    }, 60000);
  });
};

// Test 2: Streaming output test
console.log('\n📝 Test 2: Streaming JSON Output');
console.log('-'.repeat(50));

const testStreaming = () => {
  return new Promise((resolve, reject) => {
    const proc = spawn('cursor', [
      'agent',
      '--print',
      '--output-format',
      'stream-json',
      '--stream-partial-output',
      'Explain what TypeScript is in one sentence'
    ]);

    let chunks = 0;
    let buffer = '';
    const startTime = Date.now();

    proc.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const event = JSON.parse(line);
            chunks++;
            if (event.content) {
              process.stdout.write(event.content);
            }
          } catch (e) {
            // Ignore invalid JSON
          }
        }
      }
    });

    proc.on('close', (code) => {
      const duration = Date.now() - startTime;
      console.log('\n');

      if (code === 0) {
        console.log('✅ Test 2 PASSED');
        console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
        console.log(`Chunks received: ${chunks}`);
        resolve({ success: true, chunks, duration });
      } else {
        console.log('❌ Test 2 FAILED');
        reject(new Error(`Streaming test failed with code ${code}`));
      }
    });

    setTimeout(() => {
      proc.kill();
      reject(new Error('Streaming test timeout'));
    }, 60000);
  });
};

// Run tests sequentially
(async () => {
  try {
    await testCursor();
    await testStreaming();

    console.log('\n' + '='.repeat(50));
    console.log('🎉 All tests completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
})();
