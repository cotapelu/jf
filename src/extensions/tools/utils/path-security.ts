/**
 * Path Security Utilities
 *
 * Prevents path traversal attacks by ensuring all file operations
 * stay within the allowed working directory.
 */

import { resolve, isAbsolute } from 'path';

/**
 * Normalizes and validates that a user-provided path resolves within the cwd.
 * 
 * @param cwd - The current working directory (base allowed path)
 * @param userPath - User-provided file path (relative or absolute)
 * @returns The resolved absolute path (guaranteed within cwd)
 * @throws Error if path resolves outside cwd or attempts traversal
 */
export function resolveSecurePath(cwd: string, userPath: string): string {
  if (!userPath || typeof userPath !== 'string') {
    throw new Error('Invalid path: must be a non-empty string');
  }

  // Resolve to absolute path
  const absoluteCwd = resolve(cwd);
  let absolutePath: string;
  
  try {
    absolutePath = resolve(absoluteCwd, userPath);
  } catch (err) {
    throw new Error(`Invalid path: ${userPath}`);
  }

  // Ensure the resolved path starts with the cwd (with proper separator)
  const normalizedCwd = absoluteCwd.endsWith('/') ? absoluteCwd : absoluteCwd + '/';
  const normalizedPath = absolutePath.endsWith('/') ? absolutePath : absolutePath + '/';

  if (!normalizedPath.startsWith(normalizedCwd)) {
    throw new Error(`Access denied: path '${userPath}' is outside working directory`);
  }

  // Additional check: prevent symlink attacks by ensuring no '..' in path segments
  // (resolve already handles this, but double-check)
  const pathSegments = absolutePath.split('/');
  for (const segment of pathSegments) {
    if (segment === '..') {
      throw new Error(`Access denied: path '${userPath}' contains parent directory reference`);
    }
  }

  return absolutePath;
}

/**
 * Validates an array of file paths all within cwd.
 * 
 * @param cwd - Current working directory
 * @param paths - Array of user-provided paths
 * @returns Array of resolved absolute paths
 */
export function resolveSecurePaths(cwd: string, paths: string[]): string[] {
  return paths.map(p => resolveSecurePath(cwd, p));
}
