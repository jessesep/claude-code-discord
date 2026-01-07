#!/usr/bin/env -S deno run --allow-net --allow-run --allow-env --unstable-net

/// <reference lib="deno.unstable" />

/**
 * OSC Bridge Diagnostics Tool
 * 
 * Comprehensive health check for OSC connectivity.
 * Verifies ports, network, and bridge functionality.
 * 
 * Run: deno run --allow-net --allow-run --unstable-net tests/osc/osc-diagnostics.ts
 */

import { delay } from "https://deno.land/std@0.208.0/async/delay.ts";

const BOT_PORT = 9000;
const FEEDBACK_PORT = 9001;

interface DiagnosticResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: string;
}

const results: DiagnosticResult[] = [];

function log(emoji: string, message: string): void {
  console.log(`${emoji} ${message}`);
}

function addResult(result: DiagnosticResult): void {
  results.push(result);
  const icon = result.status === 'pass' ? '✅' : result.status === 'warn' ? '⚠️' : '❌';
  log(icon, `${result.name}: ${result.message}`);
  if (result.details) {
    console.log(`   ${result.details}`);
  }
}

async function checkPortAvailable(port: number): Promise<boolean> {
  try {
    const listener = Deno.listenDatagram({
      port,
      transport: "udp",
      hostname: "0.0.0.0"
    });
    listener.close();
    return true;
  } catch {
    return false;
  }
}

async function checkPortInUse(port: number): Promise<{ inUse: boolean; process?: string }> {
  try {
    const cmd = new Deno.Command("lsof", {
      args: ["-nP", `-iUDP:${port}`],
      stdout: "piped",
      stderr: "piped"
    });

    const { stdout, code } = await cmd.output();
    const output = new TextDecoder().decode(stdout).trim();

    if (code === 0 && output) {
      const lines = output.split('\n');
      if (lines.length > 1) {
        const processLine = lines[1];
        const parts = processLine.split(/\s+/);
        return { inUse: true, process: parts[0] };
      }
    }
    return { inUse: false };
  } catch {
    return { inUse: false };
  }
}

async function checkNetworkInterface(): Promise<string[]> {
  try {
    const cmd = new Deno.Command("ifconfig", {
      stdout: "piped",
      stderr: "piped"
    });

    const { stdout } = await cmd.output();
    const output = new TextDecoder().decode(stdout);

    // Extract IP addresses
    const ips: string[] = [];
    const matches = output.matchAll(/inet\s+(\d+\.\d+\.\d+\.\d+)/g);
    for (const match of matches) {
      ips.push(match[1]);
    }
    return ips;
  } catch {
    return [];
  }
}

async function testUDPConnectivity(): Promise<boolean> {
  try {
    // Create a simple UDP echo test
    const listener = Deno.listenDatagram({
      port: 19999,
      transport: "udp",
      hostname: "127.0.0.1"
    });

    // Send a test message to self
    const msg = new TextEncoder().encode("test");
    await listener.send(msg, {
      transport: "udp",
      port: 19999,
      hostname: "127.0.0.1"
    });

    // Wait for message
    const receivePromise = (async () => {
      for await (const [data] of listener) {
        return new TextDecoder().decode(data);
      }
      return null;
    })();

    const timeoutPromise = delay(1000).then(() => null);
    const result = await Promise.race([receivePromise, timeoutPromise]);

    listener.close();
    return result === "test";
  } catch {
    return false;
  }
}

async function testOSCLibrary(): Promise<boolean> {
  try {
    const OSCModule = await import("npm:osc-js");
    const OSC = (OSCModule as any).default || OSCModule;

    // Test message creation and serialization
    const message = new OSC.Message('/test', 1, 'hello');
    const packed = message.pack();

    // Test unpacking
    const unpacked = new OSC.Message();
    unpacked.unpack(new DataView(packed.buffer), 0);

    return unpacked.address === '/test';
  } catch (error) {
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function checkTailscale(): Promise<{ running: boolean; ip?: string }> {
  try {
    const cmd = new Deno.Command("tailscale", {
      args: ["ip", "-4"],
      stdout: "piped",
      stderr: "piped"
    });

    const { stdout, code } = await cmd.output();
    if (code === 0) {
      const ip = new TextDecoder().decode(stdout).trim();
      return { running: true, ip };
    }
    return { running: false };
  } catch {
    return { running: false };
  }
}

async function checkEnvVars(): Promise<Record<string, string | undefined>> {
  return {
    OSC_PHONE_IP: Deno.env.get("OSC_PHONE_IP"),
    OSC_BOT_PORT: Deno.env.get("OSC_BOT_PORT"),
    OSC_FEEDBACK_PORT: Deno.env.get("OSC_FEEDBACK_PORT"),
  };
}

// ============================================================================
// RUN DIAGNOSTICS
// ============================================================================

async function runDiagnostics(): Promise<void> {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║              OSC Bridge Diagnostics                          ║
╠══════════════════════════════════════════════════════════════╣
`);

  // 1. Check bot port (9000)
  log('🔍', `Checking bot port ${BOT_PORT}...`);
  const botPortInfo = await checkPortInUse(BOT_PORT);
  if (botPortInfo.inUse) {
    addResult({
      name: 'Bot Port',
      status: 'pass',
      message: `Port ${BOT_PORT} is in use`,
      details: `Process: ${botPortInfo.process} (bot is likely running)`
    });
  } else {
    const isAvailable = await checkPortAvailable(BOT_PORT);
    addResult({
      name: 'Bot Port',
      status: isAvailable ? 'warn' : 'fail',
      message: isAvailable 
        ? `Port ${BOT_PORT} is available (bot not running)`
        : `Port ${BOT_PORT} cannot be bound`,
      details: isAvailable 
        ? 'Start the bot to bind this port'
        : 'Another process may be blocking it'
    });
  }

  // 2. Check feedback port (9001)
  log('🔍', `Checking feedback port ${FEEDBACK_PORT}...`);
  const feedbackAvailable = await checkPortAvailable(FEEDBACK_PORT);
  addResult({
    name: 'Feedback Port',
    status: feedbackAvailable ? 'pass' : 'warn',
    message: feedbackAvailable 
      ? `Port ${FEEDBACK_PORT} is available for receiving`
      : `Port ${FEEDBACK_PORT} is in use`,
    details: feedbackAvailable 
      ? 'TouchOSC can receive on this port'
      : 'Another app may be listening here'
  });

  // 3. Check network interfaces
  log('🔍', 'Checking network interfaces...');
  const ips = await checkNetworkInterface();
  addResult({
    name: 'Network Interfaces',
    status: ips.length > 0 ? 'pass' : 'fail',
    message: `Found ${ips.length} IP addresses`,
    details: ips.join(', ')
  });

  // 4. Check UDP connectivity
  log('🔍', 'Testing UDP socket functionality...');
  const udpWorks = await testUDPConnectivity();
  addResult({
    name: 'UDP Sockets',
    status: udpWorks ? 'pass' : 'fail',
    message: udpWorks ? 'UDP sockets working correctly' : 'UDP socket test failed',
    details: udpWorks ? 'Deno UDP is functional' : 'Check --unstable-net flag'
  });

  // 5. Check OSC library
  log('🔍', 'Testing OSC library...');
  const oscWorks = await testOSCLibrary();
  addResult({
    name: 'OSC Library',
    status: oscWorks ? 'pass' : 'fail',
    message: oscWorks ? 'osc-js loaded and working' : 'OSC library failed',
    details: oscWorks ? 'Message pack/unpack functional' : 'Check npm:osc-js'
  });

  // 6. Check Tailscale
  log('🔍', 'Checking Tailscale...');
  const tailscale = await checkTailscale();
  addResult({
    name: 'Tailscale',
    status: tailscale.running ? 'pass' : 'warn',
    message: tailscale.running 
      ? `Tailscale running (IP: ${tailscale.ip})`
      : 'Tailscale not detected',
    details: tailscale.running 
      ? 'Use this IP for cross-device OSC'
      : 'Install Tailscale for remote OSC access'
  });

  // 7. Check environment variables
  log('🔍', 'Checking environment variables...');
  const envVars = await checkEnvVars();
  const phoneIP = envVars.OSC_PHONE_IP;
  addResult({
    name: 'Environment',
    status: phoneIP ? 'pass' : 'warn',
    message: phoneIP 
      ? `OSC_PHONE_IP set to ${phoneIP}`
      : 'OSC_PHONE_IP not set',
    details: phoneIP 
      ? 'Feedback will be sent to this IP'
      : 'Set in .env to enable phone feedback'
  });

  // Summary
  console.log(`
╠══════════════════════════════════════════════════════════════╣
║  SUMMARY                                                     ║
╚══════════════════════════════════════════════════════════════╝
`);

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warned = results.filter(r => r.status === 'warn').length;

  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ⚠️  Warnings: ${warned}`);
  console.log(`   ❌ Failed: ${failed}`);

  if (failed === 0 && warned === 0) {
    console.log(`
   🎉 All checks passed! OSC bridge is ready.
`);
  } else if (failed === 0) {
    console.log(`
   ⚡ OSC bridge should work, but check warnings above.
`);
  } else {
    console.log(`
   ⛔ Some checks failed. Fix issues above before proceeding.
`);
  }

  // TouchOSC configuration hint
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  TOUCHOSC CONFIGURATION                                      ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Connection 1: UDP                                           ║
║  Host: ${(ips.find(ip => !ip.startsWith('127.')) || ips[0] || 'YOUR_IP').padEnd(51)}║
║  Send Port: ${BOT_PORT}                                              ║
║  Receive Port: ${FEEDBACK_PORT}                                           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
}

// Run
if (import.meta.main) {
  await runDiagnostics();
}
