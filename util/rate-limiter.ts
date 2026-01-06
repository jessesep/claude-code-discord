/**
 * Rate limiting system to prevent spam and DoS attacks
 */

interface RateLimitEntry {
  timestamps: number[];
  lastCleanup: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

/**
 * Default rate limit configurations per command type
 */
const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Expensive operations (AI, agents)
  'claude': { maxRequests: 10, windowMs: 60000 }, // 10 per minute
  'claude-enhanced': { maxRequests: 10, windowMs: 60000 },
  'claude-explain': { maxRequests: 10, windowMs: 60000 },
  'claude-debug': { maxRequests: 10, windowMs: 60000 },
  'claude-optimize': { maxRequests: 10, windowMs: 60000 },
  'claude-review': { maxRequests: 10, windowMs: 60000 },
  'claude-generate': { maxRequests: 10, windowMs: 60000 },
  'claude-refactor': { maxRequests: 10, windowMs: 60000 },
  'claude-learn': { maxRequests: 10, windowMs: 60000 },
  'agent': { maxRequests: 10, windowMs: 60000 },
  'continue': { maxRequests: 10, windowMs: 60000 },
  
  // Moderate operations
  'git': { maxRequests: 20, windowMs: 60000 }, // 20 per minute
  'worktree': { maxRequests: 5, windowMs: 60000 }, // 5 per minute (expensive)
  'shell': { maxRequests: 15, windowMs: 60000 }, // 15 per minute
  
  // Simple operations
  'status': { maxRequests: 30, windowMs: 60000 }, // 30 per minute
  'pwd': { maxRequests: 30, windowMs: 60000 },
  'help': { maxRequests: 30, windowMs: 60000 },
  'system-info': { maxRequests: 20, windowMs: 60000 },
  'processes': { maxRequests: 20, windowMs: 60000 },
  
  // Default for unknown commands
  'default': { maxRequests: 30, windowMs: 60000 },
};

/**
 * Per-user rate limit (global limit across all commands)
 */
const PER_USER_LIMIT: RateLimitConfig = {
  maxRequests: 30, // 30 requests per minute per user
  windowMs: 60000
};

export class RateLimiter {
  private userLimits = new Map<string, RateLimitEntry>();
  private commandLimits = new Map<string, Map<string, RateLimitEntry>>();
  private cleanupInterval: number | null = null;

  constructor() {
    // Start periodic cleanup (every 5 minutes)
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000) as unknown as number;
  }

  /**
   * Check if a request should be allowed
   * 
   * @param userId - The user ID making the request
   * @param command - The command being executed
   * @param customLimit - Optional custom rate limit config
   * @returns Object with allowed status, remaining requests, and reset time
   */
  checkLimit(
    userId: string,
    command: string,
    customLimit?: RateLimitConfig
  ): {
    allowed: boolean;
    remaining: number;
    resetAt: number;
    error?: string;
  } {
    const now = Date.now();

    // Check per-user global limit
    const userLimit = this.getOrCreateLimit(this.userLimits, userId);
    const userConfig = customLimit || PER_USER_LIMIT;
    
    // Clean old timestamps outside the window
    this.cleanTimestamps(userLimit, now, userConfig.windowMs);

    if (userLimit.timestamps.length >= userConfig.maxRequests) {
      const oldestTimestamp = userLimit.timestamps[0];
      const resetAt = oldestTimestamp + userConfig.windowMs;
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        error: `Per-user rate limit exceeded. Maximum ${userConfig.maxRequests} requests per ${userConfig.windowMs / 1000} seconds. Try again at ${new Date(resetAt).toLocaleTimeString()}`
      };
    }

    // Check per-command limit
    const commandConfig = customLimit || DEFAULT_RATE_LIMITS[command] || DEFAULT_RATE_LIMITS['default'];
    
    if (!this.commandLimits.has(command)) {
      this.commandLimits.set(command, new Map());
    }
    const commandLimitMap = this.commandLimits.get(command)!;
    const commandLimit = this.getOrCreateLimit(commandLimitMap, userId);

    // Clean old timestamps
    this.cleanTimestamps(commandLimit, now, commandConfig.windowMs);

    if (commandLimit.timestamps.length >= commandConfig.maxRequests) {
      const oldestTimestamp = commandLimit.timestamps[0];
      const resetAt = oldestTimestamp + commandConfig.windowMs;
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        error: `Rate limit exceeded for command "${command}". Maximum ${commandConfig.maxRequests} requests per ${commandConfig.windowMs / 1000} seconds. Try again at ${new Date(resetAt).toLocaleTimeString()}`
      };
    }

    // Record this request
    userLimit.timestamps.push(now);
    commandLimit.timestamps.push(now);

    const remaining = Math.max(
      userConfig.maxRequests - userLimit.timestamps.length,
      commandConfig.maxRequests - commandLimit.timestamps.length
    );

    return {
      allowed: true,
      remaining,
      resetAt: now + commandConfig.windowMs
    };
  }

  /**
   * Get remaining requests for a user/command
   */
  getRemainingRequests(userId: string, command: string): number {
    const now = Date.now();
    const userLimit = this.userLimits.get(userId);
    const commandLimit = this.commandLimits.get(command)?.get(userId);

    if (!userLimit && !commandLimit) {
      const config = DEFAULT_RATE_LIMITS[command] || DEFAULT_RATE_LIMITS['default'];
      return config.maxRequests;
    }

    let userRemaining = PER_USER_LIMIT.maxRequests;
    if (userLimit) {
      this.cleanTimestamps(userLimit, now, PER_USER_LIMIT.windowMs);
      userRemaining = PER_USER_LIMIT.maxRequests - userLimit.timestamps.length;
    }

    let commandRemaining = (DEFAULT_RATE_LIMITS[command] || DEFAULT_RATE_LIMITS['default']).maxRequests;
    if (commandLimit) {
      const config = DEFAULT_RATE_LIMITS[command] || DEFAULT_RATE_LIMITS['default'];
      this.cleanTimestamps(commandLimit, now, config.windowMs);
      commandRemaining = config.maxRequests - commandLimit.timestamps.length;
    }

    return Math.min(userRemaining, commandRemaining);
  }

  /**
   * Reset rate limit for a user (optionally for a specific command)
   */
  resetLimit(userId: string, command?: string): void {
    if (command) {
      this.commandLimits.get(command)?.delete(userId);
    } else {
      // Reset all limits for user
      this.userLimits.delete(userId);
      for (const commandMap of this.commandLimits.values()) {
        commandMap.delete(userId);
      }
    }
  }

  /**
   * Clean up old entries to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour

    // Clean user limits
    for (const [userId, entry] of this.userLimits.entries()) {
      if (now - entry.lastCleanup > maxAge && entry.timestamps.length === 0) {
        this.userLimits.delete(userId);
      }
    }

    // Clean command limits
    for (const [command, userMap] of this.commandLimits.entries()) {
      for (const [userId, entry] of userMap.entries()) {
        if (now - entry.lastCleanup > maxAge && entry.timestamps.length === 0) {
          userMap.delete(userId);
        }
      }
      if (userMap.size === 0) {
        this.commandLimits.delete(command);
      }
    }
  }

  /**
   * Clean timestamps outside the window
   */
  private cleanTimestamps(entry: RateLimitEntry, now: number, windowMs: number): void {
    const cutoff = now - windowMs;
    entry.timestamps = entry.timestamps.filter(timestamp => timestamp > cutoff);
    entry.lastCleanup = now;
  }

  /**
   * Get or create a rate limit entry
   */
  private getOrCreateLimit(
    map: Map<string, RateLimitEntry>,
    key: string
  ): RateLimitEntry {
    if (!map.has(key)) {
      map.set(key, {
        timestamps: [],
        lastCleanup: Date.now()
      });
    }
    return map.get(key)!;
  }

  /**
   * Destroy the rate limiter and clean up intervals
   */
  destroy(): void {
    if (this.cleanupInterval !== null) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.userLimits.clear();
    this.commandLimits.clear();
  }
}

// Singleton instance
let rateLimiterInstance: RateLimiter | null = null;

/**
 * Get the global rate limiter instance
 */
export function getRateLimiter(): RateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiter();
  }
  return rateLimiterInstance;
}
