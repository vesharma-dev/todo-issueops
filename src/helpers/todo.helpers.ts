import { createHash } from 'crypto';

/**
 * Generate a unique fingerprint for a TODO comment
 * @param content - The TODO comment content
 * @param filePath - The file path where the TODO is located
 * @param lineContent - The full line content
 * @returns A unique hash string
 */
export function generateFingerprint(content: string, filePath: string, lineContent: string): string {
  const data = `${filePath}:${content}:${lineContent.trim()}`;
  return createHash('sha256').update(data).digest('hex').substring(0, 16);
}

/**
 * Parse TODO comments from a line of code
 * @param line - The line of code to parse
 * @param keywords - Array of keywords to search for
 * @returns The TODO content if found, null otherwise
 */
export function parseTodoFromLine(line: string, keywords: string[]): string | null {
  // Create regex pattern that matches any of the keywords followed by a colon and content
  const keywordPattern = keywords.join('|');
  const todoRegex = new RegExp(`(?://|#|<!--|/\\*)\\s*(${keywordPattern})\\s*:?\\s*(.+?)(?:\\s*-->|\\s*\\*/|$)`, 'i');

  const match = line.match(todoRegex);
  if (match && match[2]) {
    return `${match[1].toUpperCase()}: ${match[2].trim()}`;
  }

  return null;
}
