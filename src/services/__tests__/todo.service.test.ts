import * as core from '@actions/core';
import * as github from '@actions/github';
import {
  getActionInputs,
  extractTodosFromDiff,
  findExistingIssue,
  createIssueForTodo,
  closeIssueForTodo,
} from '../todo.service';
import { GitHubCompareResponse } from '../../types/main.types';

jest.mock('@actions/core');
jest.mock('@actions/github');

describe('todo.service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getActionInputs', () => {
    it('should return correct inputs when all are provided', () => {
      (core.getInput as jest.Mock).mockImplementation((name: string) => {
        switch (name) {
          case 'token':
            return 'test-token';
          case 'keywords':
            return 'TODO,FIXME,TEST';
          case 'assignees':
            return 'user1, user2';
          case 'labels':
            return 'label1, label2';
          default:
            return '';
        }
      });

      const inputs = getActionInputs();

      expect(inputs.token).toBe('test-token');
      expect(inputs.keywords).toEqual(['TODO', 'FIXME', 'TEST']);
      expect(inputs.assignees).toEqual(['user1', 'user2']);
      expect(inputs.labels).toEqual(['label1', 'label2']);
    });

    // TODO fix this 2 getActioninputs test for default values
    xit('should use default values for keywords and labels', () => {
      (core.getInput as jest.Mock).mockImplementation((name: string) => {
        if (name === 'token') {
          return 'test-token';
        }
        return '';
      });

      const inputs = getActionInputs();

      expect(inputs.token).toBe('test-token');
      expect(inputs.keywords).toEqual(['TODO', 'FIXME']);
      expect(inputs.assignees).toEqual([]);
      expect(inputs.labels).toEqual(['todo-bot']);
    });

    xit('should handle empty but defined inputs', () => {
      (core.getInput as jest.Mock).mockImplementation((name: string) => {
        if (name === 'token') {
          return 'test-token';
        }
        if (name === 'keywords') {
          return '';
        }
        if (name === 'assignees') {
          return '';
        }
        if (name === 'labels') {
          return '';
        }
        return '';
      });

      const inputs = getActionInputs();

      expect(inputs.keywords).toEqual([]);
      expect(inputs.assignees).toEqual([]);
      expect(inputs.labels).toEqual([]);
    });

    it('should throw an error if token is not provided', () => {
      (core.getInput as jest.Mock).mockReturnValue('');
      process.env.GITHUB_TOKEN = '';
      process.env.INPUT_TOKEN = '';

      expect(() => getActionInputs()).toThrow('Token is required');
    });
  });

  describe('extractTodosFromDiff', () => {
    const keywords = ['TODO', 'FIXME'];

    it('should return empty arrays if no files are provided', () => {
      const { addedTodos, removedTodos } = extractTodosFromDiff(undefined, keywords);
      expect(addedTodos).toEqual([]);
      expect(removedTodos).toEqual([]);
    });

    it('should return empty arrays if files have no patch', () => {
      const files = [{ filename: 'src/test.ts' }] as GitHubCompareResponse['files'];
      const { addedTodos, removedTodos } = extractTodosFromDiff(files, keywords);
      expect(addedTodos).toEqual([]);
      expect(removedTodos).toEqual([]);
    });

    it('should extract added and removed TODOs from a diff', () => {
      const files = [
        {
          filename: 'src/test.ts',
          patch: `@@ -1,1 +1,3 @@
- // TODO: This is an old todo that was removed
+ // TODO: This is a new todo
+ // Some other line of code
+ // FIXME: This is another new todo
`,
        },
      ] as GitHubCompareResponse['files'];

      const { addedTodos, removedTodos } = extractTodosFromDiff(files, keywords);

      expect(addedTodos).toHaveLength(2);
      expect(addedTodos[0].content).toBe('TODO: This is a new todo');
      expect(addedTodos[0].filePath).toBe('src/test.ts');
      expect(addedTodos[1].content).toBe('FIXME: This is another new todo');
      expect(addedTodos[1].filePath).toBe('src/test.ts');

      expect(removedTodos).toHaveLength(1);
      expect(removedTodos[0].content).toBe('TODO: This is an old todo that was removed');
      expect(removedTodos[0].filePath).toBe('src/test.ts');
    });

    it('should handle multiple files', () => {
      const files = [
        {
          filename: 'file1.js',
          patch: '@@ -10,2 +10,3 @@\n+ // TODO: Task 1 in file 1\n- // FIXME: Old task to be removed',
        },
        {
          filename: 'file2.py',
          patch: '@@ -1,1 +1,2 @@\n+ # TODO: Task 2 in file 2',
        },
      ] as GitHubCompareResponse['files'];

      const { addedTodos, removedTodos } = extractTodosFromDiff(files, keywords);

      expect(addedTodos).toHaveLength(2);
      expect(addedTodos[0].content).toBe('TODO: Task 1 in file 1');
      expect(addedTodos[0].filePath).toBe('file1.js');
      expect(addedTodos[1].content).toBe('TODO: Task 2 in file 2');
      expect(addedTodos[1].filePath).toBe('file2.py');

      expect(removedTodos).toHaveLength(1);
      expect(removedTodos[0].content).toBe('FIXME: Old task to be removed');
      expect(removedTodos[0].filePath).toBe('file1.js');
    });

    it('should not extract TODOs from lines that are not additions or removals', () => {
      const files = [
        {
          filename: 'src/test.ts',
          patch: `@@ -1,3 +1,3 @@
  // TODO: This is an existing todo
- // TODO: This is a removed todo
+ // TODO: This is an added todo
`,
        },
      ] as GitHubCompareResponse['files'];

      const { addedTodos, removedTodos } = extractTodosFromDiff(files, keywords);

      expect(addedTodos).toHaveLength(1);
      expect(addedTodos[0].content).toBe('TODO: This is an added todo');
      expect(removedTodos).toHaveLength(1);
      expect(removedTodos[0].content).toBe('TODO: This is a removed todo');
    });
  });

  describe('findExistingIssue', () => {
    const mockOctokit = {
      rest: {
        issues: {
          listForRepo: jest.fn(),
        },
      },
    };

    beforeEach(() => {
      (github.getOctokit as jest.Mock).mockReturnValue(mockOctokit);
      jest.spyOn(core, 'warning').mockImplementation(() => {});
    });

    it('should return issue number if an issue with the fingerprint is found', async () => {
      const issues = [
        { number: 1, body: 'Some other issue' },
        { number: 2, body: '<!-- TODO-BOT-FINGERPRINT: test-fingerprint -->' },
      ];
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({ data: issues });

      const issueNumber = await findExistingIssue(mockOctokit as any, 'owner', 'repo', 'test-fingerprint');
      expect(issueNumber).toBe(2);
      expect(mockOctokit.rest.issues.listForRepo).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        labels: 'todo-bot',
        state: 'open',
      });
    });

    it('should return null if no issue with the fingerprint is found', async () => {
      const issues = [{ number: 1, body: 'Some other issue' }];
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({ data: issues });

      const issueNumber = await findExistingIssue(mockOctokit as any, 'owner', 'repo', 'test-fingerprint');
      expect(issueNumber).toBeNull();
    });

    it('should return null and warn on API error', async () => {
      mockOctokit.rest.issues.listForRepo.mockRejectedValue(new Error('API Error'));

      const issueNumber = await findExistingIssue(mockOctokit as any, 'owner', 'repo', 'test-fingerprint');

      expect(issueNumber).toBeNull();
      expect(core.warning).toHaveBeenCalledWith('Failed to search for existing issues: Error: API Error');
    });
  });

  describe('createIssueForTodo', () => {
    const mockOctokit = {
      rest: {
        issues: {
          create: jest.fn(),
        },
      },
    };

    const todo = {
      content: 'Test TODO',
      filePath: 'src/test.ts',
      lineNumber: 10,
      fingerprint: 'test-fingerprint',
      keywords: 'TODO',
    };

    beforeEach(() => {
      (github.getOctokit as jest.Mock).mockReturnValue(mockOctokit);
      jest.spyOn(core, 'info').mockImplementation(() => {});
      jest.spyOn(core, 'error').mockImplementation(() => {});
      mockOctokit.rest.issues.create.mockResolvedValue({ data: { number: 123 } });
    });

    it('should create an issue with correct details', async () => {
      await createIssueForTodo(mockOctokit as any, 'owner', 'repo', todo, [], ['todo-bot'], 'sha123');

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        title: 'Test TODO',
        body: expect.stringContaining('<!-- TODO-BOT-FINGERPRINT: test-fingerprint -->'),
        labels: ['todo-bot'],
      });
      expect(core.info).toHaveBeenCalledWith('Created issue #123 for TODO: Test TODO');
    });

    it('should include assignees if provided', async () => {
      await createIssueForTodo(mockOctokit as any, 'owner', 'repo', todo, ['user1'], ['todo-bot'], 'sha123');

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith(
        expect.objectContaining({
          assignees: ['user1'],
        })
      );
    });

    it('should log an error if issue creation fails', async () => {
      mockOctokit.rest.issues.create.mockRejectedValue(new Error('API Error'));

      await createIssueForTodo(mockOctokit as any, 'owner', 'repo', todo, [], [], 'sha123');

      expect(core.error).toHaveBeenCalledWith('Failed to create issue for TODO: Error: API Error');
    });
  });

  describe('closeIssueForTodo', () => {
    const mockOctokit = {
      rest: {
        issues: {
          createComment: jest.fn(),
          update: jest.fn(),
        },
      },
    };

    const todo = {
      content: 'Test TODO',
      filePath: 'src/test.ts',
      lineNumber: 10,
      fingerprint: 'test-fingerprint',
      keywords: 'TODO',
    };

    beforeEach(() => {
      (github.getOctokit as jest.Mock).mockReturnValue(mockOctokit);
      jest.spyOn(core, 'info').mockImplementation(() => {});
      jest.spyOn(core, 'error').mockImplementation(() => {});
    });

    it('should add a comment and close the issue', async () => {
      await closeIssueForTodo(mockOctokit as any, 'owner', 'repo', 123, todo);

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 123,
        body: expect.stringContaining('This issue is being automatically closed'),
      });

      expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 123,
        state: 'closed',
        state_reason: 'completed',
      });

      expect(core.info).toHaveBeenCalledWith('Closed issue #123 for removed TODO: Test TODO');
    });

    it('should log an error if closing the issue fails', async () => {
      mockOctokit.rest.issues.update.mockRejectedValue(new Error('API Error'));

      await closeIssueForTodo(mockOctokit as any, 'owner', 'repo', 123, todo);

      expect(core.error).toHaveBeenCalledWith('Failed to close issue #123: Error: API Error');
    });
  });
});
