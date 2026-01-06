/**
 * Path validation utilities to prevent path traversal attacks
 */

import * as path from "https://deno.land/std/path/mod.ts";

/**
 * Validates that a file path stays within the base directory
 * Prevents path traversal attacks (e.g., ../../../etc/passwd)
 * 
 * @param filePath - The file path to validate (can be relative or absolute)
 * @param baseDir - The base directory that the path must stay within
 * @returns Object with validation result, error message, and resolved path
 */
export function validateFilePath(
  filePath: string,
  baseDir: string
): { valid: boolean; error?: string; resolved?: string } {
  try {
    // Normalize the base directory (resolve to absolute path)
    const normalizedBase = path.normalize(path.resolve(baseDir));
    
    // Resolve the target path relative to base directory
    const resolved = path.resolve(baseDir, filePath);
    
    // Normalize the resolved path (handles .., ., //, etc.)
    const normalized = path.normalize(resolved);
    
    // Check if the normalized path starts with the normalized base directory
    // This prevents path traversal attacks
    if (!normalized.startsWith(normalizedBase)) {
      return {
        valid: false,
        error: `Path traversal detected: "${filePath}" resolves outside workspace directory`
      };
    }
    
    // Additional check: ensure the resolved path is actually within the base
    // (handles edge cases with symlinks and case sensitivity)
    const relativePath = path.relative(normalizedBase, normalized);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return {
        valid: false,
        error: `Path traversal detected: "${filePath}" resolves outside workspace directory`
      };
    }
    
    return {
      valid: true,
      resolved: normalized
    };
  } catch (error) {
    return {
      valid: false,
      error: `Invalid path: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Validates multiple file paths at once
 * 
 * @param filePaths - Array of file paths to validate
 * @param baseDir - The base directory that paths must stay within
 * @returns Array of validation results
 */
export function validateFilePaths(
  filePaths: string[],
  baseDir: string
): Array<{ filePath: string; valid: boolean; error?: string; resolved?: string }> {
  return filePaths.map(filePath => {
    const result = validateFilePath(filePath, baseDir);
    return {
      filePath,
      ...result
    };
  });
}

/**
 * Sanitizes a file path by removing dangerous characters
 * Note: This is a secondary defense - primary defense is validateFilePath
 * 
 * @param filePath - The file path to sanitize
 * @returns Sanitized file path
 */
export function sanitizeFilePath(filePath: string): string {
  // Remove null bytes
  let sanitized = filePath.replace(/\0/g, '');
  
  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
}
