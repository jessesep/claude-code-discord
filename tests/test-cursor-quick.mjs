/**
 * Quick Cursor integration test
 */

import { spawn } from 'child_process';

console.log('🧪 Quick Cursor Integration Test\n');

const test = (prompt, format = 'json', streaming = false) => {
  return new Promise((resolve, reject) => {
    const args = ['agent', '--print', '--output-format', format];
    if (streaming) args.push('--stream-partial-output');
    args.push(prompt);

    const proc = spawn('cursor', args, {
      cwd: '/Users/jessesep/repos/claude-code-discord'
    });

    let output = '';
    const startTime = Date.now();

    proc.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      if (streaming) process.stdout.write(chunk);
    });

    proc.stderr.on('data', (data) => {
      console.error('stderr:', data.toString());
    });

    proc.on('close', (code) => {
      const duration = Date.now() - startTime;

      if (code === 0) {
        resolve({ output, duration, code });
      } else {
        reject(new Error(`Exit code: ${code}, Output: ${output}`));
      }
    });

    // 45 second timeout
    setTimeout(() => {
      proc.kill();
      reject(new Error('Timeout'));
    }, 45000);
  });
};

(async () => {
  try {
    // Test 1: JSON output
    console.log('📝 Test 1: JSON Output');
    const result1 = await test('What is 5+5?', 'json');
    console.log(`✅ Passed (${(result1.duration/1000).toFixed(1)}s)`);
    console.log('Response:', result1.output.substring(0, 200));

    // Test 2: Stream JSON
    console.log('\n📝 Test 2: Streaming JSON');
    const result2 = await test('Count from 1 to 3', 'stream-json', true);
    console.log(`\n✅ Passed (${(result2.duration/1000).toFixed(1)}s)`);

    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
})();
