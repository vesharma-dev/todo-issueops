import * as core from "@actions/core";
import * as github from "@actions/github";
import {
  extractTodosFromDiff,
  findExistingIssue,
  createIssueForTodo,
  closeIssueForTodo,
  getActionInputs,
} from "../services/todo.service";

/**
 * Main function that orchestrates the TODO Bot logic
 */
export async function runTodoBotOrchestrator(): Promise<void> {
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
