/**
 * Testing Mode Configuration
 * 
 * When TESTING_MODE=true, all restrictions and approvals are bypassed:
 * - High-risk agents auto-approved (no button click needed)
 * - Sandbox mode disabled (full system access)
 * - Force mode enabled (auto-approve all operations)
 * - Channel restrictions bypassed
 * - Rate limits relaxed
 * 
 * Usage:
 *   export TESTING_MODE=true
 *   deno run --allow-all index.ts
 * 
 * Or in .env:
 *   TESTING_MODE=true
 */

// ═══════════════════════════════════════════════════════════════════════════
// Testing Mode State
// ═══════════════════════════════════════════════════════════════════════════

let _testingModeEnabled: boolean | null = null;
let _testingModeConfig: TestingModeConfig | null = null;

export interface TestingModeConfig {
  /** Skip approval buttons for high-risk agents */
  autoApproveHighRisk: boolean;
  
  /** Disable sandbox for all agents */
  disableSandbox: boolean;
  
  /** Enable force mode for all agents */
  forceMode: boolean;
  
  /** Bypass channel restrictions */
  bypassChannelRestrictions: boolean;
  
  /** Skip rate limit checks */
  skipRateLimits: boolean;
  
  /** Log all testing mode decisions */
  verboseLogging: boolean;
  
  /** Auto-approve all confirmations */
  autoApproveAll: boolean;
  
  /** Allow operations in any channel */
  allowAnyChannel: boolean;
}

const DEFAULT_TESTING_CONFIG: TestingModeConfig = {
  autoApproveHighRisk: true,
  disableSandbox: true,
  forceMode: true,
  bypassChannelRestrictions: true,
  skipRateLimits: true,
  verboseLogging: true,
  autoApproveAll: true,
  allowAnyChannel: true,
};

// ═══════════════════════════════════════════════════════════════════════════
// Core Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if testing mode is enabled
 */
export function isTestingMode(): boolean {
  if (_testingModeEnabled === null) {
    const envValue = Deno.env.get("TESTING_MODE");
    _testingModeEnabled = envValue === "true" || envValue === "1";
    
    if (_testingModeEnabled) {
      console.log("⚠️  [TESTING MODE] ENABLED - All restrictions bypassed!");
      console.log("⚠️  [TESTING MODE] Do NOT use in production!");
    }
  }
  return _testingModeEnabled;
}

/**
 * Get testing mode configuration
 */
export function getTestingConfig(): TestingModeConfig {
  if (!_testingModeConfig) {
    if (isTestingMode()) {
      _testingModeConfig = { ...DEFAULT_TESTING_CONFIG };
      
      // Allow partial overrides via env
      if (Deno.env.get("TESTING_KEEP_SANDBOX") === "true") {
        _testingModeConfig.disableSandbox = false;
      }
      if (Deno.env.get("TESTING_KEEP_APPROVAL") === "true") {
        _testingModeConfig.autoApproveHighRisk = false;
        _testingModeConfig.autoApproveAll = false;
      }
      if (Deno.env.get("TESTING_QUIET") === "true") {
        _testingModeConfig.verboseLogging = false;
      }
    } else {
      // Return all-false config when testing mode is off
      _testingModeConfig = {
        autoApproveHighRisk: false,
        disableSandbox: false,
        forceMode: false,
        bypassChannelRestrictions: false,
        skipRateLimits: false,
        verboseLogging: false,
        autoApproveAll: false,
        allowAnyChannel: false,
      };
    }
  }
  return _testingModeConfig;
}

/**
 * Log a testing mode action (if verbose logging enabled)
 */
export function testingLog(message: string): void {
  const config = getTestingConfig();
  if (config.verboseLogging) {
    console.log(`🧪 [TESTING] ${message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Convenience Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if approval should be auto-granted
 */
export function shouldAutoApprove(riskLevel?: 'low' | 'medium' | 'high'): boolean {
  const config = getTestingConfig();
  
  if (config.autoApproveAll) {
    testingLog(`Auto-approving (all approvals bypassed)`);
    return true;
  }
  
  if (riskLevel === 'high' && config.autoApproveHighRisk) {
    testingLog(`Auto-approving high-risk agent (testing mode)`);
    return true;
  }
  
  return false;
}

/**
 * Get effective sandbox setting (disabled in testing mode)
 */
export function getEffectiveSandbox(agentSandbox?: 'enabled' | 'disabled'): 'enabled' | 'disabled' {
  const config = getTestingConfig();
  
  if (config.disableSandbox) {
    testingLog(`Sandbox disabled (testing mode override)`);
    return 'disabled';
  }
  
  return agentSandbox || 'enabled';
}

/**
 * Get effective force mode (enabled in testing mode)
 */
export function getEffectiveForce(agentForce?: boolean): boolean {
  const config = getTestingConfig();
  
  if (config.forceMode) {
    testingLog(`Force mode enabled (testing mode override)`);
    return true;
  }
  
  return agentForce || false;
}

/**
 * Check if channel restrictions should be bypassed
 */
export function shouldBypassChannelRestrictions(): boolean {
  const config = getTestingConfig();
  return config.bypassChannelRestrictions;
}

/**
 * Check if rate limits should be skipped
 */
export function shouldSkipRateLimits(): boolean {
  const config = getTestingConfig();
  return config.skipRateLimits;
}

// ═══════════════════════════════════════════════════════════════════════════
// Reset (for testing the testing mode itself)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Reset testing mode state (for unit tests)
 */
export function resetTestingMode(): void {
  _testingModeEnabled = null;
  _testingModeConfig = null;
}

/**
 * Force enable testing mode programmatically (for E2E tests)
 */
export function enableTestingMode(config?: Partial<TestingModeConfig>): void {
  _testingModeEnabled = true;
  _testingModeConfig = { ...DEFAULT_TESTING_CONFIG, ...config };
  console.log("⚠️  [TESTING MODE] Programmatically enabled!");
}

/**
 * Force disable testing mode programmatically
 */
export function disableTestingMode(): void {
  _testingModeEnabled = false;
  _testingModeConfig = null;
}
