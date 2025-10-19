import * as core from '@actions/core';
import * as github from '@actions/github';
import {
  extractTodosFromDiff,
  findExistingIssue,
  createIssueForTodo,
  closeIssueForTodo,
  getActionInputs,
} from '../services/todo.service';

/**
 * Main function that orchestrates the TODO Bot logic
 */
export async function runTodoBotOrchestrator(): Promise<void> {
  try {
    core.info('🤖 TODO Bot starting...');

    // Get inputs
    const inputs = getActionInputs();
    core.info(`Searching for keywords: ${inputs.keywords.join(', ')}`);

    // Initialize Octokit
    const octokit = github.getOctokit(inputs.token);

    // Get repository context
    const { owner, repo } = github.context.repo;
    const payload = github.context.payload;

    let base: string | undefined;
    let head: string | undefined;

    switch (github.context.eventName) {
      case 'pull_request':
        base = payload.pull_request?.base.sha;
        head = payload.pull_request?.head.sha;
        break;
      case 'push':
        base = payload.before;
        head = payload.after;
        break;
      default:
        core.setFailed(
          `This action only supports pull_request and push events, but received ${github.context.eventName}`
        );
        return;
    }

    if (!base || !head) {
      core.warning('Could not determine base or head commit SHA.');
      return;
    }

    // Handle new branch push where `before` is a zero-hash
    if (base === '0000000000000000000000000000000000000000') {
      core.info('New branch detected. Finding parent commit for comparison.');

      // For a new branch, we list commits and find the parent of the first commit in the push
      const { data: commits } = await octokit.rest.repos.listCommits({
        owner,
        repo,
        sha: head,
        per_page: 10, // Get a few recent commits
      });

      if (commits.length > 1) {
        // In a multi-commit push to a new branch, the base should be the parent of the oldest commit pushed.
        // Assuming the push is not > 10 commits, the last commit in our list is the oldest.
        const oldestCommitInPush = commits[commits.length - 1];
        if (oldestCommitInPush.parents.length > 0) {
          base = oldestCommitInPush.parents[0].sha;
          core.info(`Parent of oldest commit in push found: ${base}`);
        } else {
          // This is the first commit in the repository.
          base = head; // Compare the head with itself to process its files.
          core.info('First commit in repository. Processing all files in this commit.');
        }
      } else if (commits.length === 1 && commits[0].parents.length > 0) {
        // Single commit push to a new branch
        base = commits[0].parents[0].sha;
        core.info(`Parent commit found: ${base}`);
      } else {
        // First commit in the repository ever, or other edge case.
        // We'll process just the head commit.
        core.info('Could not determine a base for comparison. Processing files in the head commit only.');
        base = head;
      }
    }

    core.info(`Comparing commits ${base}...${head}`);

    // Get the diff between commits
    const compareResponse = await octokit.rest.repos.compareCommits({
      owner,
      repo,
      base,
      head,
    });

    // Extract TODOs from the diff
    const { addedTodos, removedTodos } = extractTodosFromDiff(compareResponse.data.files, inputs.keywords);

    core.info(`Found ${addedTodos.length} new TODOs and ${removedTodos.length} removed TODOs`);

    // Process new TODOs (create issues)
    for (const todo of addedTodos) {
      const existingIssue = await findExistingIssue(octokit, owner, repo, todo.fingerprint);

      if (!existingIssue) {
        await createIssueForTodo(octokit, owner, repo, todo, inputs.assignees, inputs.labels, head);
      } else {
        core.info(`Issue #${existingIssue} already exists for TODO: ${todo.content}`);
      }
    }

    // Process removed TODOs (close issues)
    for (const todo of removedTodos) {
      const existingIssue = await findExistingIssue(octokit, owner, repo, todo.fingerprint);

      if (existingIssue) {
        await closeIssueForTodo(octokit, owner, repo, existingIssue, todo);
      } else {
        core.info(`No existing issue found for removed TODO: ${todo.content}`);
      }
    }

    core.info('✅ TODO Bot completed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.setFailed(`TODO Bot failed: ${errorMessage}`);
  }
}
