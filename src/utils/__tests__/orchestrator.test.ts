import * as core from '@actions/core';
import * as github from '@actions/github';
import { runTodoBotOrchestrator } from '../orchestrator';
import {
  getActionInputs,
  extractTodosFromDiff,
  findExistingIssue,
  createIssueForTodo,
  closeIssueForTodo,
} from '../../services/todo.service';
import { TodoComment } from '../../types/main.types';

// Mock the modules
jest.mock('@actions/core');
jest.mock('@actions/github', () => ({
  getOctokit: jest.fn(),
  context: {
    repo: {
      owner: 'test-owner',
      repo: 'test-repo',
    },
    payload: {},
  },
}));
jest.mock('../../services/todo.service');

describe('runTodoBotOrchestrator', () => {
  const mockOctokit = {
    rest: {
      repos: {
        compareCommits: jest.fn(),
        getCommit: jest.fn(),
      },
    },
  };

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Restore github context payload for each test
    github.context.payload = {
      before: 'before-sha',
      after: 'after-sha',
    };

    // Mock getOctokit to return our mockOctokit
    (github.getOctokit as jest.Mock).mockReturnValue(mockOctokit);

    // Mock service functions
    (getActionInputs as jest.Mock).mockReturnValue({
      token: 'test-token',
      keywords: ['TODO', 'FIXME'],
      assignees: ['test-user'],
      labels: ['todo-bot'],
    });

    mockOctokit.rest.repos.compareCommits.mockResolvedValue({
      data: { files: [] },
    });
  });

  it('should run successfully and process new and removed TODOs', async () => {
    const addedTodos: TodoComment[] = [
      { content: 'New TODO 1', filePath: 'file1.js', lineNumber: 1, fingerprint: 'fp1', keywords: 'TODO' },
    ];
    const removedTodos: TodoComment[] = [
      { content: 'Old TODO 1', filePath: 'file2.js', lineNumber: 2, fingerprint: 'fp2', keywords: 'TODO' },
    ];

    (extractTodosFromDiff as jest.Mock).mockReturnValue({ addedTodos, removedTodos });
    (findExistingIssue as jest.Mock)
      .mockResolvedValueOnce(null) // For new TODO
      .mockResolvedValueOnce(123); // For removed TODO

    await runTodoBotOrchestrator();

    expect(core.info).toHaveBeenCalledWith('🤖 TODO Bot starting...');
    expect(getActionInputs).toHaveBeenCalled();
    expect(github.getOctokit).toHaveBeenCalledWith('test-token');
    expect(mockOctokit.rest.repos.compareCommits).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      base: 'before-sha',
      head: 'after-sha',
    });
    expect(extractTodosFromDiff).toHaveBeenCalled();
    expect(core.info).toHaveBeenCalledWith('Found 1 new TODOs and 1 removed TODOs');

    // Verify new TODO processing
    expect(findExistingIssue).toHaveBeenCalledWith(mockOctokit, 'test-owner', 'test-repo', 'fp1');
    expect(createIssueForTodo).toHaveBeenCalledWith(
      mockOctokit,
      'test-owner',
      'test-repo',
      addedTodos[0],
      ['test-user'],
      ['todo-bot'],
      'after-sha'
    );

    // Verify removed TODO processing
    expect(findExistingIssue).toHaveBeenCalledWith(mockOctokit, 'test-owner', 'test-repo', 'fp2');
    expect(closeIssueForTodo).toHaveBeenCalledWith(mockOctokit, 'test-owner', 'test-repo', 123, removedTodos[0]);

    expect(core.info).toHaveBeenCalledWith('✅ TODO Bot completed successfully');
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it('should warn and exit if not a push event', async () => {
    // @ts-ignore
    github.context.payload = {}; // Simulate non-push event

    await runTodoBotOrchestrator();

    expect(core.warning).toHaveBeenCalledWith(
      'This action is designed to run on push events with before/after commit SHAs'
    );
    expect(mockOctokit.rest.repos.compareCommits).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    const error = new Error('Test error');
    (getActionInputs as jest.Mock).mockImplementation(() => {
      throw error;
    });

    await runTodoBotOrchestrator();

    expect(core.setFailed).toHaveBeenCalledWith('TODO Bot failed: Test error');
  });

  it('should not create an issue if one already exists for a new TODO', async () => {
    const addedTodos: TodoComment[] = [
      { content: 'Existing TODO', filePath: 'file1.js', lineNumber: 1, fingerprint: 'fp-exists', keywords: 'TODO' },
    ];
    (extractTodosFromDiff as jest.Mock).mockReturnValue({ addedTodos, removedTodos: [] });
    (findExistingIssue as jest.Mock).mockResolvedValue(456);

    await runTodoBotOrchestrator();

    expect(findExistingIssue).toHaveBeenCalledWith(mockOctokit, 'test-owner', 'test-repo', 'fp-exists');
    expect(createIssueForTodo).not.toHaveBeenCalled();
    expect(core.info).toHaveBeenCalledWith('Issue #456 already exists for TODO: Existing TODO');
  });

  it('should not try to close an issue if none exists for a removed TODO', async () => {
    const removedTodos: TodoComment[] = [
      {
        content: 'Non-existent TODO',
        filePath: 'file2.js',
        lineNumber: 2,
        fingerprint: 'fp-no-issue',
        keywords: 'TODO',
      },
    ];
    (extractTodosFromDiff as jest.Mock).mockReturnValue({ addedTodos: [], removedTodos });
    (findExistingIssue as jest.Mock).mockResolvedValue(null);

    await runTodoBotOrchestrator();

    expect(findExistingIssue).toHaveBeenCalledWith(mockOctokit, 'test-owner', 'test-repo', 'fp-no-issue');
    expect(closeIssueForTodo).not.toHaveBeenCalled();
    expect(core.info).toHaveBeenCalledWith('No existing issue found for removed TODO: Non-existent TODO');
  });

  describe('when handling new branch pushes', () => {
    const zeroSha = '0000000000000000000000000000000000000000';

    beforeEach(() => {
      github.context.payload.before = zeroSha;
      // @ts-ignore
      mockOctokit.rest.repos.getCommit = jest.fn();
    });

    it('should use the parent commit for comparison on a new branch', async () => {
      const parentSha = 'parent-sha-123';
      const headSha = 'head-sha-456';
      github.context.payload.after = headSha;

      (mockOctokit.rest.repos.getCommit as jest.Mock).mockResolvedValue({
        data: {
          parents: [{ sha: parentSha }],
        },
      });

      const addedTodos: TodoComment[] = [
        {
          content: 'New TODO on new branch',
          filePath: 'file.js',
          lineNumber: 10,
          fingerprint: 'fp-new-branch',
          keywords: 'TODO',
        },
      ];
      (extractTodosFromDiff as jest.Mock).mockReturnValue({ addedTodos, removedTodos: [] });
      (findExistingIssue as jest.Mock).mockResolvedValue(null);

      await runTodoBotOrchestrator();

      expect(core.info).toHaveBeenCalledWith('New branch detected. Finding parent commit for comparison.');
      expect(mockOctokit.rest.repos.getCommit).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        ref: headSha,
      });
      expect(core.info).toHaveBeenCalledWith(`Parent commit found: ${parentSha}`);
      expect(mockOctokit.rest.repos.compareCommits).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        base: parentSha,
        head: headSha,
      });
      expect(createIssueForTodo).toHaveBeenCalled();
    });

    it('should handle the first commit in a repository', async () => {
      const headSha = 'first-commit-sha';
      github.context.payload.after = headSha;

      // First getCommit call to find parent (returns none)
      (mockOctokit.rest.repos.getCommit as jest.Mock).mockResolvedValueOnce({
        data: {
          parents: [],
        },
      });

      const commitFiles = [{ filename: 'init.js', patch: '@@ -0,0 +1 @@\n+// TODO: Initial setup' }];
      // Second getCommit call to get commit files
      (mockOctokit.rest.repos.getCommit as jest.Mock).mockResolvedValueOnce({
        data: {
          files: commitFiles,
        },
      });

      const addedTodos: TodoComment[] = [
        { content: 'Initial TODO', filePath: 'init.js', lineNumber: 1, fingerprint: 'fp-init', keywords: 'TODO' },
      ];
      (extractTodosFromDiff as jest.Mock).mockReturnValue({ addedTodos, removedTodos: [] });
      (findExistingIssue as jest.Mock).mockResolvedValue(null);

      await runTodoBotOrchestrator();

      expect(core.info).toHaveBeenCalledWith('First commit in repository. Processing all files in this commit.');
      expect(mockOctokit.rest.repos.getCommit).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        ref: headSha,
      });
      expect(mockOctokit.rest.repos.compareCommits).not.toHaveBeenCalled();
      expect(extractTodosFromDiff).toHaveBeenCalledWith(commitFiles, ['TODO', 'FIXME']);
      expect(createIssueForTodo).toHaveBeenCalled();
      expect(core.info).toHaveBeenCalledWith('✅ TODO Bot completed successfully for the first commit.');
    });
  });
});
