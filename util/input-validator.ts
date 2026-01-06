/**
 * Input validation utilities
 */

/**
 * Validates a Claude prompt
 * 
 * @param prompt - The prompt to validate
 * @returns Validation result with error message if invalid
 */
export function validatePrompt(prompt: string): {
  valid: boolean;
  error?: string;
  estimatedTokens?: number;
} {
  // Check for empty or whitespace-only
  if (!prompt || prompt.trim().length === 0) {
    return {
      valid: false,
      error: "Prompt cannot be empty"
    };
  }

  // Check length limit
  const maxLength = 100000; // 100k characters
  if (prompt.length > maxLength) {
    return {
      valid: false,
      error: `Prompt too long (${prompt.length} characters, max ${maxLength})`
    };
  }

  // Estimate tokens (rough heuristic: ~4 characters per token)
  const estimatedTokens = Math.ceil(prompt.length / 4);
  const maxTokens = 200000; // Claude's context window limit

  if (estimatedTokens > maxTokens) {
    return {
      valid: false,
      error: `Prompt too large (estimated ${estimatedTokens} tokens, max ${maxTokens})`,
      estimatedTokens
    };
  }

  return {
    valid: true,
    estimatedTokens
  };
}

/**
 * Validates a Discord message
 * 
 * @param message - The message to validate
 * @returns Validation result
 */
export function validateMessage(message: string): {
  valid: boolean;
  error?: string;
} {
  if (!message || message.trim().length === 0) {
    return {
      valid: false,
      error: "Message cannot be empty"
    };
  }

  // Discord's message limit is 2000 characters
  const maxLength = 2000;
  if (message.length > maxLength) {
    return {
      valid: false,
      error: `Message too long (${message.length} characters, max ${maxLength})`
    };
  }

  return { valid: true };
}

/**
 * Validates a shell command
 * 
 * @param command - The command to validate
 * @returns Validation result
 */
export function validateCommand(command: string): {
  valid: boolean;
  error?: string;
} {
  if (!command || command.trim().length === 0) {
    return {
      valid: false,
      error: "Command cannot be empty"
    };
  }

  // Check for reasonable length (prevent extremely long commands)
  const maxLength = 10000;
  if (command.length > maxLength) {
    return {
      valid: false,
      error: `Command too long (${command.length} characters, max ${maxLength})`
    };
  }

  return { valid: true };
}

/**
 * Validates a file path (basic validation, detailed validation in path-validator.ts)
 * 
 * @param filePath - The file path to validate
 * @returns Validation result
 */
export function validateFilePathBasic(filePath: string): {
  valid: boolean;
  error?: string;
} {
  if (!filePath || filePath.trim().length === 0) {
    return {
      valid: false,
      error: "File path cannot be empty"
    };
  }

  // Check for null bytes
  if (filePath.includes('\0')) {
    return {
      valid: false,
      error: "File path cannot contain null bytes"
    };
  }

  // Check for reasonable length
  const maxLength = 4096; // Typical filesystem path limit
  if (filePath.length > maxLength) {
    return {
      valid: false,
      error: `File path too long (${filePath.length} characters, max ${maxLength})`
    };
  }

  return { valid: true };
}

/**
 * Validates a session ID
 * 
 * @param sessionId - The session ID to validate
 * @returns Validation result
 */
export function validateSessionId(sessionId: string): {
  valid: boolean;
  error?: string;
} {
  if (!sessionId || sessionId.trim().length === 0) {
    return {
      valid: false,
      error: "Session ID cannot be empty"
    };
  }

  // Session IDs should be alphanumeric with dashes/underscores
  const sessionIdPattern = /^[a-zA-Z0-9_-]+$/;
  if (!sessionIdPattern.test(sessionId)) {
    return {
      valid: false,
      error: "Session ID contains invalid characters"
    };
  }

  // Reasonable length limit
  const maxLength = 100;
  if (sessionId.length > maxLength) {
    return {
      valid: false,
      error: `Session ID too long (${sessionId.length} characters, max ${maxLength})`
    };
  }

  return { valid: true };
}

/**
 * Trims and validates a string input
 * 
 * @param input - The input string
 * @param fieldName - Name of the field (for error messages)
 * @param options - Validation options
 * @returns Trimmed string and validation result
 */
export function trimAndValidate(
  input: string | null | undefined,
  fieldName: string,
  options: {
    required?: boolean;
    maxLength?: number;
    minLength?: number;
  } = {}
): {
  value: string;
  valid: boolean;
  error?: string;
} {
  const { required = true, maxLength, minLength } = options;

  if (!input) {
    if (required) {
      return {
        value: '',
        valid: false,
        error: `${fieldName} is required`
      };
    }
    return { value: '', valid: true };
  }

  const trimmed = input.trim();

  if (required && trimmed.length === 0) {
    return {
      value: '',
      valid: false,
      error: `${fieldName} cannot be empty or whitespace-only`
    };
  }

  if (minLength !== undefined && trimmed.length < minLength) {
    return {
      value: trimmed,
      valid: false,
      error: `${fieldName} too short (${trimmed.length} characters, min ${minLength})`
    };
  }

  if (maxLength !== undefined && trimmed.length > maxLength) {
    return {
      value: trimmed,
      valid: false,
      error: `${fieldName} too long (${trimmed.length} characters, max ${maxLength})`
    };
  }

  return { value: trimmed, valid: true };
}
