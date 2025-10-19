/**
 * Interface for TODO comment data
 */
export interface TodoComment {
  content: string;
  filePath: string;
  lineNumber: number;
  fingerprint: string;
  keywords: string;
}

/**
 * Interface for action inputs
 */
export interface ActionInputs {
  token: string;
  keywords: string[];
  assignees: string[];
  labels: string[];
  diff_payload?: string;
}

/**
 * Interface for GitHub API response for comparing commits
 */
export interface GitHubCompareResponse {
  files?: Array<{
    filename: string;
    status: string;
    patch?: string;
  }>;
}
