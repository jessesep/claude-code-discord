/**
 * Standardized error handling utilities
 */

/**
 * Generate a correlation ID for request tracking
 */
function generateCorrelationId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Error context for better debugging
 */
export interface ErrorContext {
  command: string;
  userId?: string;
  timestamp: Date;
  correlationId: string;
  additionalContext?: Record<string, unknown>;
}

/**
 * Format an error with context
 * 
 * @param error - The error to format
 * @param context - Error context
 * @returns Formatted error message
 */
export function formatError(
  error: Error | string,
  context: ErrorContext
): string {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  const correlationId = context.correlationId || generateCorrelationId();
  const timestamp = context.timestamp.toISOString();
  const userId = context.userId || 'unknown';
  
  let formatted = `[${correlationId}] Error in ${context.command}`;
  formatted += `\nUser: ${userId}`;
  formatted += `\nTime: ${timestamp}`;
  formatted += `\nError: ${errorMessage}`;
  
  if (context.additionalContext) {
    formatted += `\nContext: ${JSON.stringify(context.additionalContext, null, 2)}`;
  }
  
  if (errorStack && errorStack !== errorMessage) {
    formatted += `\n\nStack Trace:\n${errorStack}`;
  }
  
  return formatted;
}

/**
 * Create error context for a command
 * 
 * @param command - The command name
 * @param userId - The user ID (optional)
 * @param additionalContext - Additional context (optional)
 * @returns Error context
 */
export function createErrorContext(
  command: string,
  userId?: string,
  additionalContext?: Record<string, unknown>
): ErrorContext {
  return {
    command,
    userId,
    timestamp: new Date(),
    correlationId: generateCorrelationId(),
    additionalContext
  };
}

/**
 * Log an error with context
 * 
 * @param error - The error to log
 * @param context - Error context
 */
export function logError(error: Error | string, context: ErrorContext): void {
  const formatted = formatError(error, context);
  console.error(formatted);
}

/**
 * Create a user-friendly error message (without stack traces)
 * 
 * @param error - The error
 * @param context - Error context
 * @returns User-friendly error message
 */
export function createUserFriendlyError(
  error: Error | string,
  context: ErrorContext
): string {
  const errorMessage = error instanceof Error ? error.message : error;
  const correlationId = context.correlationId || generateCorrelationId();
  
  // Detect common error types and provide helpful messages
  if (errorMessage.includes('ENOENT')) {
    return `File not found. If this persists, please report with ID: ${correlationId}`;
  }
  
  if (errorMessage.includes('EACCES') || errorMessage.includes('permission')) {
    return `Permission denied. Please check file permissions. Reference ID: ${correlationId}`;
  }
  
  if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('connection')) {
    return `Connection failed. Please check your network connection. Reference ID: ${correlationId}`;
  }
  
  if (errorMessage.includes('timeout')) {
    return `Operation timed out. Please try again. Reference ID: ${correlationId}`;
  }
  
  if (errorMessage.includes('rate limit')) {
    return `Rate limit exceeded. Please wait a moment and try again. Reference ID: ${correlationId}`;
  }
  
  // Generic error message
  return `An error occurred: ${errorMessage}. Reference ID: ${correlationId}`;
}

/**
 * Wrap an async function with error handling
 * 
 * @param fn - The async function to wrap
 * @param context - Error context
 * @returns Wrapped function
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context: ErrorContext
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), context);
      throw error;
    }
  };
}
