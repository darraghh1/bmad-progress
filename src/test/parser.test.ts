/**
 * Parser Unit Tests
 * Tests for story file parsing with various edge cases
 */

import * as assert from 'assert';

// Mock the task parsing logic (will be tested without vscode dependency)
const CHECKBOX_PATTERN = /^(\s*)- \[([ xX])\] (.+)$/;

interface TaskItem {
  text: string;
  completed: boolean;
  line: number;
  subtasks?: TaskItem[];
}

function parseTasksFromLines(lines: string[]): TaskItem[] {
  const tasks: TaskItem[] = [];
  const stack: { indent: number; task: TaskItem }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(CHECKBOX_PATTERN);

    if (match) {
      const indent = match[1].length;
      const completed = match[2].toLowerCase() === 'x';
      const text = match[3].trim();

      const task: TaskItem = {
        text,
        completed,
        line: i + 1,
        subtasks: [],
      };

      while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }

      if (stack.length === 0) {
        tasks.push(task);
      } else {
        const parent = stack[stack.length - 1].task;
        if (!parent.subtasks) {
          parent.subtasks = [];
        }
        parent.subtasks.push(task);
      }

      stack.push({ indent, task });
    }
  }

  return tasks;
}

function countCompleted(tasks: TaskItem[]): number {
  let count = 0;
  for (const task of tasks) {
    if (task.completed) count++;
    if (task.subtasks) count += countCompleted(task.subtasks);
  }
  return count;
}

function countTotal(tasks: TaskItem[]): number {
  let count = 0;
  for (const task of tasks) {
    count++;
    if (task.subtasks) count += countTotal(task.subtasks);
  }
  return count;
}

describe('Story Parser', () => {
  describe('parseTasksFromLines', () => {
    it('should parse simple checkboxes', () => {
      const lines = [
        '- [ ] Task 1',
        '- [x] Task 2',
        '- [X] Task 3',
      ];

      const tasks = parseTasksFromLines(lines);

      assert.strictEqual(tasks.length, 3);
      assert.strictEqual(tasks[0].text, 'Task 1');
      assert.strictEqual(tasks[0].completed, false);
      assert.strictEqual(tasks[1].text, 'Task 2');
      assert.strictEqual(tasks[1].completed, true);
      assert.strictEqual(tasks[2].text, 'Task 3');
      assert.strictEqual(tasks[2].completed, true);
    });

    it('should handle nested checkboxes', () => {
      const lines = [
        '- [ ] Parent task',
        '  - [ ] Child task 1',
        '  - [x] Child task 2',
        '- [x] Another parent',
      ];

      const tasks = parseTasksFromLines(lines);

      assert.strictEqual(tasks.length, 2);
      assert.strictEqual(tasks[0].subtasks?.length, 2);
      assert.strictEqual(tasks[0].subtasks?.[0].text, 'Child task 1');
      assert.strictEqual(tasks[0].subtasks?.[1].completed, true);
    });

    it('should handle links in checkbox text', () => {
      const lines = [
        '- [ ] See [docs](https://example.com)',
        '- [x] Check [API reference](./api.md)',
      ];

      const tasks = parseTasksFromLines(lines);

      assert.strictEqual(tasks.length, 2);
      assert.strictEqual(tasks[0].text, 'See [docs](https://example.com)');
      assert.strictEqual(tasks[1].text, 'Check [API reference](./api.md)');
    });

    it('should skip non-checkbox lines', () => {
      const lines = [
        '# Header',
        '',
        'Some text',
        '- [ ] Task 1',
        '- Regular list item',
        '- [x] Task 2',
      ];

      const tasks = parseTasksFromLines(lines);

      assert.strictEqual(tasks.length, 2);
    });

    it('should handle YAML frontmatter', () => {
      const lines = [
        '---',
        'title: My Story',
        'status: in-progress',
        '---',
        '',
        '- [ ] Task 1',
      ];

      const tasks = parseTasksFromLines(lines);

      assert.strictEqual(tasks.length, 1);
      assert.strictEqual(tasks[0].text, 'Task 1');
    });

    it('should handle empty story file', () => {
      const lines: string[] = [];

      const tasks = parseTasksFromLines(lines);

      assert.strictEqual(tasks.length, 0);
    });

    it('should handle story with only completed tasks', () => {
      const lines = [
        '- [x] Done 1',
        '- [x] Done 2',
        '- [x] Done 3',
      ];

      const tasks = parseTasksFromLines(lines);

      assert.strictEqual(tasks.length, 3);
      assert.strictEqual(countCompleted(tasks), 3);
      assert.strictEqual(countTotal(tasks), 3);
    });

    it('should handle story with no checkboxes', () => {
      const lines = [
        '# Story Title',
        '',
        'This is a description.',
        '',
        '## Section',
        'More content.',
      ];

      const tasks = parseTasksFromLines(lines);

      assert.strictEqual(tasks.length, 0);
    });

    it('should track line numbers correctly', () => {
      const lines = [
        '# Header',
        '',
        '- [ ] Task on line 3',
        '',
        '- [x] Task on line 5',
      ];

      const tasks = parseTasksFromLines(lines);

      assert.strictEqual(tasks[0].line, 3);
      assert.strictEqual(tasks[1].line, 5);
    });

    it('should handle deeply nested tasks', () => {
      const lines = [
        '- [ ] Level 1',
        '  - [ ] Level 2',
        '    - [ ] Level 3',
        '      - [x] Level 4',
      ];

      const tasks = parseTasksFromLines(lines);

      assert.strictEqual(tasks.length, 1);
      assert.strictEqual(tasks[0].subtasks?.[0].subtasks?.[0].subtasks?.[0].text, 'Level 4');
    });

    it('should handle malformed markdown gracefully', () => {
      const lines = [
        '- [  ] Not a valid checkbox (double space)',
        '- [] Not a valid checkbox (no space)',
        '-[ ] Not a valid checkbox (no space before bracket)',
        '- [ ]No space after bracket',
        '- [ ] Valid task',
      ];

      const tasks = parseTasksFromLines(lines);

      // Only the last one should be parsed as valid
      assert.strictEqual(tasks.length, 1);
      assert.strictEqual(tasks[0].text, 'Valid task');
    });
  });

  describe('countCompleted', () => {
    it('should count flat completed tasks', () => {
      const tasks: TaskItem[] = [
        { text: 'A', completed: true, line: 1 },
        { text: 'B', completed: false, line: 2 },
        { text: 'C', completed: true, line: 3 },
      ];

      assert.strictEqual(countCompleted(tasks), 2);
    });

    it('should count nested completed tasks', () => {
      const tasks: TaskItem[] = [
        {
          text: 'Parent',
          completed: true,
          line: 1,
          subtasks: [
            { text: 'Child 1', completed: true, line: 2 },
            { text: 'Child 2', completed: false, line: 3 },
          ],
        },
      ];

      assert.strictEqual(countCompleted(tasks), 2);
    });
  });

  describe('countTotal', () => {
    it('should count all tasks including nested', () => {
      const tasks: TaskItem[] = [
        {
          text: 'Parent',
          completed: false,
          line: 1,
          subtasks: [
            { text: 'Child 1', completed: false, line: 2 },
            {
              text: 'Child 2',
              completed: false,
              line: 3,
              subtasks: [
                { text: 'Grandchild', completed: false, line: 4 },
              ],
            },
          ],
        },
        { text: 'Sibling', completed: false, line: 5 },
      ];

      assert.strictEqual(countTotal(tasks), 5);
    });
  });
});
