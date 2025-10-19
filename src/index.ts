import * as core from "@actions/core";
import * as github from "@actions/github";
import { createHash } from "crypto";

/**
 * Interface for TODO comment data
 */
interface TodoComment {
  content: string;
  filePath: string;
  lineNumber: number;
  fingerprint: string;
  keywords: string;
}

/**
 * Interface for action inputs
 */
interface ActionInputs {
  token: string;
  keywords: string[];
  assignees: string[];
  labels: string[];
}

/**
 * Interface for GitHub API response for comparing commits
 */
interface GitHubCompareResponse {
  files?: Array<{
    filename: string;
    status: string;
    patch?: string;
  }>;
}

/**
 * Generate a unique fingerprint for a TODO comment
 * @param content - The TODO comment content
 * @param filePath - The file path where the TODO is located
 * @param lineContent - The full line content
 * @returns A unique hash string
 */
function generateFingerprint(
  content: string,
  filePath: string,
  lineContent: string
): string {
  const data = `${filePath}:${content}:${lineContent.trim()}`;
  return createHash("sha256").update(data).digest("hex").substring(0, 16);
}

/**
 * Parse TODO comments from a line of code
 * @param line - The line of code to parse
 * @param keywords - Array of keywords to search for
 * @returns The TODO content if found, null otherwise
 */
function parseTodoFromLine(line: string, keywords: string[]): string | null {
  // Create regex pattern that matches any of the keywords followed by a colon and content
  const keywordPattern = keywords.join("|");
  const todoRegex = new RegExp(
    `(?://|#|<!--|/\\*)\\s*(${keywordPattern})\\s*:?\\s*(.+?)(?:\\s*-->|\\s*\\*/|$)`,
    "i"
  );

  const match = line.match(todoRegex);
  if (match && match[2]) {
    return `${match[1].toUpperCase()}: ${match[2].trim()}`;
  }

  return null;
}

/**
 * Extract TODO comments from git diff
 * @param files - Array of files from GitHub compare API
 * @param keywords - Array of keywords to search for
 * @returns Object containing added and removed TODOs
 */
function extractTodosFromDiff(
  files: GitHubCompareResponse["files"],
  keywords: string[]
): {
  addedTodos: TodoComment[];
  removedTodos: TodoComment[];
} {
  const addedTodos: TodoComment[] = [];
  const removedTodos: TodoComment[] = [];

  if (!files) return { addedTodos, removedTodos };

  for (const file of files) {
    if (!file.patch) continue;

    const lines = file.patch.split("\n");
    let currentLineNumber = 0;

    for (const line of lines) {
      // Parse diff header to get line numbers
      if (line.startsWith("@@")) {
        const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
        if (match) {
          currentLineNumber = parseInt(match[2], 10);
        }
        continue;
      }

      // Handle added lines (start with +)
      if (line.startsWith("+") && !line.startsWith("+++")) {
        const todoContent = parseTodoFromLine(line.substring(1), keywords);
        if (todoContent) {
          const fingerprint = generateFingerprint(
            todoContent,
            file.filename,
            line.substring(1)
          );
          addedTodos.push({
            content: todoContent,
            filePath: file.filename,
            lineNumber: currentLineNumber,
            fingerprint,
            keywords:
              keywords.find((k) =>
                todoContent.toUpperCase().includes(k.toUpperCase())
              ) || "TODO",
          });
        }
        currentLineNumber++;
      }
      // Handle removed lines (start with -)
      else if (line.startsWith("-") && !line.startsWith("---")) {
        const todoContent = parseTodoFromLine(line.substring(1), keywords);
        if (todoContent) {
          const fingerprint = generateFingerprint(
            todoContent,
            file.filename,
            line.substring(1)
          );
          removedTodos.push({
            content: todoContent,
            filePath: file.filename,
            lineNumber: currentLineNumber,
            fingerprint,
            keywords:
              keywords.find((k) =>
                todoContent.toUpperCase().includes(k.toUpperCase())
              ) || "TODO",
          });
        }
      }
      // Handle unchanged lines (start with space or no prefix)
      else if (
        line.startsWith(" ") ||
        (!line.startsWith("+") &&
          !line.startsWith("-") &&
          !line.startsWith("@"))
      ) {
        currentLineNumber++;
      }
    }
  }

  return { addedTodos, removedTodos };
}

/**
 * Search for existing issues with a specific fingerprint
 * @param octokit - Authenticated Octokit instance
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param fingerprint - The fingerprint to search for
 * @returns The issue number if found, null otherwise
 */
async function findExistingIssue(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  fingerprint: string
): Promise<number | null> {
  try {
    const response = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      labels: "todo-bot",
      state: "open",
    });

    for (const issue of response.data) {
      if (issue.body && issue.body.includes(fingerprint)) {
        return issue.number;
      }
    }
  } catch (error) {
    core.warning(`Failed to search for existing issues: ${error}`);
  }

  return null;
}

/**
 * Create a new GitHub issue for a TODO comment
 * @param octokit - Authenticated Octokit instance
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param todo - The TODO comment data
 * @param assignees - Array of assignees
 * @param labels - Array of labels
 * @param sha - Current commit SHA
 */
async function createIssueForTodo(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  todo: TodoComment,
  assignees: string[],
  labels: string[],
  sha: string
): Promise<void> {
  try {
    const codeUrl = `https://github.com/${owner}/${repo}/blob/${sha}/${todo.filePath}#L${todo.lineNumber}`;

    const issueBody = `This issue was automatically created from a TODO comment in the code.

**File:** \`${todo.filePath}\`
**Line:** ${todo.lineNumber}
**TODO:** ${todo.content}

**Link to code:** [View in repository](${codeUrl})

---
*This issue is managed by TODO Bot. Do not edit the fingerprint below.*
<!-- TODO-BOT-FINGERPRINT: ${todo.fingerprint} -->`;

    const createIssueData: {
      owner: string;
      repo: string;
      title: string;
      body: string;
      labels: string[];
      assignees?: string[];
    } = {
      owner,
      repo,
      title: todo.content,
      body: issueBody,
      labels: labels,
    };

    if (assignees.length > 0) {
      createIssueData.assignees = assignees;
    }

    const response = await octokit.rest.issues.create(createIssueData);

    core.info(
      `Created issue #${response.data.number} for TODO: ${todo.content}`
    );
  } catch (error) {
    core.error(`Failed to create issue for TODO: ${error}`);
  }
}

/**
 * Close a GitHub issue for a removed TODO comment
 * @param octokit - Authenticated Octokit instance
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param issueNumber - The issue number to close
 * @param todo - The TODO comment data
 */
async function closeIssueForTodo(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  issueNumber: number,
  todo: TodoComment
): Promise<void> {
  try {
    // Add a comment explaining why the issue was closed
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: `This issue is being automatically closed because the TODO comment was removed from the code.

**Removed from:** \`${todo.filePath}\`
**TODO was:** ${todo.content}

---
*This issue was closed by TODO Bot.*`,
    });

    // Close the issue
    await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: issueNumber,
      state: "closed",
      state_reason: "completed",
    });

    core.info(`Closed issue #${issueNumber} for removed TODO: ${todo.content}`);
  } catch (error) {
    core.error(`Failed to close issue #${issueNumber}: ${error}`);
  }
}

/**
 * Get action inputs with proper typing and validation
 * @returns Parsed and validated action inputs
 */
function getActionInputs(): ActionInputs {
  // For local testing, allow token to be optional and use environment fallback
  let token = core.getInput("token");
  if (!token) {
    token = process.env.GITHUB_TOKEN || process.env.INPUT_TOKEN || "";
    if (!token) {
      core.setFailed(
        "GitHub token is required. Set it via inputs.token, GITHUB_TOKEN, or INPUT_TOKEN environment variable."
      );
      throw new Error("Token is required");
    }
  }

  const keywordsInput = core.getInput("keywords") || "TODO,FIXME";
  const assigneesInput = core.getInput("assignees");
  const labelsInput = core.getInput("labels") || "todo-bot";

  const keywords = keywordsInput
    .split(",")
    .map((k: string) => k.trim())
    .filter((k: string) => k.length > 0);
  const assignees = assigneesInput
    ? assigneesInput
        .split(",")
        .map((a: string) => a.trim())
        .filter((a: string) => a.length > 0)
    : [];
  const labels = labelsInput
    .split(",")
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 0);

  return { token, keywords, assignees, labels };
}

/**
 * Main function that orchestrates the TODO Bot logic
 */
async function run(): Promise<void> {
  try {
    core.info("🤖 TODO Bot starting...");

    // Get inputs
    const inputs = getActionInputs();
    core.info(`Searching for keywords: ${inputs.keywords.join(", ")}`);

    // Initialize Octokit
    const octokit = github.getOctokit(inputs.token);

    // Get repository context
    const { owner, repo } = github.context.repo;
    const payload = github.context.payload;

    // Ensure we have push event data
    if (!payload.before || !payload.after) {
      core.warning(
        "This action is designed to run on push events with before/after commit SHAs"
      );
      return;
    }

    core.info(`Comparing commits ${payload.before}...${payload.after}`);

    // Get the diff between commits
    const compareResponse = await octokit.rest.repos.compareCommits({
      owner,
      repo,
      base: payload.before,
      head: payload.after,
    });

    // Extract TODOs from the diff
    const { addedTodos, removedTodos } = extractTodosFromDiff(
      compareResponse.data.files,
      inputs.keywords
    );

    core.info(
      `Found ${addedTodos.length} new TODOs and ${removedTodos.length} removed TODOs`
    );

    // Process new TODOs (create issues)
    for (const todo of addedTodos) {
      const existingIssue = await findExistingIssue(
        octokit,
        owner,
        repo,
        todo.fingerprint
      );

      if (!existingIssue) {
        await createIssueForTodo(
          octokit,
          owner,
          repo,
          todo,
          inputs.assignees,
          inputs.labels,
          payload.after
        );
      } else {
        core.info(
          `Issue #${existingIssue} already exists for TODO: ${todo.content}`
        );
      }
    }

    // Process removed TODOs (close issues)
    for (const todo of removedTodos) {
      const existingIssue = await findExistingIssue(
        octokit,
        owner,
        repo,
        todo.fingerprint
      );

      if (existingIssue) {
        await closeIssueForTodo(octokit, owner, repo, existingIssue, todo);
      } else {
        core.info(`No existing issue found for removed TODO: ${todo.content}`);
      }
    }

    core.info("✅ TODO Bot completed successfully");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.setFailed(`TODO Bot failed: ${errorMessage}`);
  }
}

// Execute the main function if this file is run directly
// Note: In Docker environment, this will always be the main module
run();

export { run };
