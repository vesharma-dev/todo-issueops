import { generateFingerprint, parseTodoFromLine } from '../todo.helpers';

describe('todo.helpers', () => {
  describe('generateFingerprint', () => {
    it('should generate a consistent fingerprint for the same input', () => {
      const content = 'Refactor this function';
      const filePath = 'src/services/api.ts';
      const lineContent = '// TODO: Refactor this function';
      const fingerprint1 = generateFingerprint(content, filePath, lineContent);
      const fingerprint2 = generateFingerprint(content, filePath, lineContent);
      expect(fingerprint1).toBe(fingerprint2);
    });

    it('should generate a different fingerprint for different content', () => {
      const filePath = 'src/services/api.ts';
      const lineContent = '// TODO: Refactor this function';
      const fingerprint1 = generateFingerprint('Content 1', filePath, lineContent);
      const fingerprint2 = generateFingerprint('Content 2', filePath, lineContent);
      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should generate a different fingerprint for different file paths', () => {
      const content = 'Refactor this function';
      const lineContent = '// TODO: Refactor this function';
      const fingerprint1 = generateFingerprint(content, 'src/services/api.ts', lineContent);
      const fingerprint2 = generateFingerprint(content, 'src/utils/helpers.ts', lineContent);
      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should generate a 16-character fingerprint', () => {
      const fingerprint = generateFingerprint('any content', 'any/path', 'any line');
      expect(fingerprint.length).toBe(16);
    });
  });

  describe('parseTodoFromLine', () => {
    const keywords = ['TODO', 'FIXME'];

    it('should parse a TODO comment with a colon', () => {
      const line = '// TODO: Implement feature';
      expect(parseTodoFromLine(line, keywords)).toBe('TODO: Implement feature');
    });

    it('should parse a FIXME comment without a colon', () => {
      const line = '# FIXME Implement feature';
      expect(parseTodoFromLine(line, keywords)).toBe('FIXME: Implement feature');
    });

    it('should parse a multiline comment start', () => {
      const line = '/* TODO: Implement feature */';
      expect(parseTodoFromLine(line, keywords)).toBe('TODO: Implement feature');
    });

    it('should return null if no keyword is found', () => {
      const line = '// This is a regular comment';
      expect(parseTodoFromLine(line, keywords)).toBeNull();
    });

    it('should be case-insensitive', () => {
      const line = '// todo: Implement feature';
      expect(parseTodoFromLine(line, keywords)).toBe('TODO: Implement feature');
    });

    it('should handle HTML comments', () => {
      const line = '<!-- FIXME: Fix this layout issue -->';
      expect(parseTodoFromLine(line, keywords)).toBe('FIXME: Fix this layout issue');
    });

    it('should extract the content correctly', () => {
      const line = '// TODO: This is the content';
      expect(parseTodoFromLine(line, keywords)).toBe('TODO: This is the content');
    });
  });
});
