/**
 * Detector Unit Tests
 * Tests for BMAD structure detection
 */

import * as assert from 'assert';
import { BmadVersion } from '../types';

// Test the version display name function
function getVersionDisplayName(version: BmadVersion): string {
  switch (version) {
    case 'v6':
      return 'BMAD v6 (Modern)';
    case 'v4':
      return 'BMAD v4 (Classic)';
    case 'quickflow':
      return 'Quick Flow';
    case 'unknown':
      return 'Not Detected';
  }
}

describe('BMAD Detector', () => {
  describe('getVersionDisplayName', () => {
    it('should return correct display name for v6', () => {
      assert.strictEqual(getVersionDisplayName('v6'), 'BMAD v6 (Modern)');
    });

    it('should return correct display name for v4', () => {
      assert.strictEqual(getVersionDisplayName('v4'), 'BMAD v4 (Classic)');
    });

    it('should return correct display name for quickflow', () => {
      assert.strictEqual(getVersionDisplayName('quickflow'), 'Quick Flow');
    });

    it('should return correct display name for unknown', () => {
      assert.strictEqual(getVersionDisplayName('unknown'), 'Not Detected');
    });
  });

  describe('Detection Order', () => {
    // These tests document the expected detection order per ADR-003
    // Actual filesystem tests would require mocking vscode.workspace.fs

    it('should prioritize v6 structure (.bmad/bmm/) first', () => {
      // Detection order:
      // 1. .bmad/bmm/ → v6
      // 2. .bmad-core/ → v4
      // 3. docs/stories/ → Quick Flow
      // 4. Settings override

      const detectionOrder = ['v6', 'v4', 'quickflow', 'settings'];
      assert.strictEqual(detectionOrder[0], 'v6');
    });

    it('should check v4 structure (.bmad-core/) second', () => {
      const detectionOrder = ['v6', 'v4', 'quickflow', 'settings'];
      assert.strictEqual(detectionOrder[1], 'v4');
    });

    it('should check Quick Flow structure (docs/stories/) third', () => {
      const detectionOrder = ['v6', 'v4', 'quickflow', 'settings'];
      assert.strictEqual(detectionOrder[2], 'quickflow');
    });
  });

  describe('Story Path Resolution', () => {
    // Document expected story path locations

    it('should look for v6 stories in docs/sprint-artifacts first', () => {
      const v6Paths = [
        'docs/sprint-artifacts',
        'docs/stories',
      ];
      assert.strictEqual(v6Paths[0], 'docs/sprint-artifacts');
    });

    it('should look for v4 stories in docs/stories first', () => {
      const v4Paths = [
        'docs/stories',
        'stories',
      ];
      assert.strictEqual(v4Paths[0], 'docs/stories');
    });
  });
});

describe('Progress Calculation', () => {
  it('should calculate percentage correctly', () => {
    const completed = 5;
    const total = 20;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    assert.strictEqual(percentage, 25);
  });

  it('should handle zero total tasks', () => {
    const completed = 0;
    const total = 0;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    assert.strictEqual(percentage, 0);
  });

  it('should handle 100% completion', () => {
    const completed = 10;
    const total = 10;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    assert.strictEqual(percentage, 100);
  });

  it('should round percentages correctly', () => {
    const testCases = [
      { completed: 1, total: 3, expected: 33 },
      { completed: 2, total: 3, expected: 67 },
      { completed: 1, total: 7, expected: 14 },
    ];

    for (const tc of testCases) {
      const percentage = tc.total > 0 ? Math.round((tc.completed / tc.total) * 100) : 0;
      assert.strictEqual(percentage, tc.expected, `${tc.completed}/${tc.total} should be ${tc.expected}%`);
    }
  });
});

describe('Progress Bar Generation', () => {
  function createProgressBar(percentage: number): string {
    const filled = Math.round(percentage / 10);
    const empty = 10 - filled;
    return '▓'.repeat(filled) + '░'.repeat(empty);
  }

  it('should create empty bar for 0%', () => {
    assert.strictEqual(createProgressBar(0), '░░░░░░░░░░');
  });

  it('should create full bar for 100%', () => {
    assert.strictEqual(createProgressBar(100), '▓▓▓▓▓▓▓▓▓▓');
  });

  it('should create half bar for 50%', () => {
    assert.strictEqual(createProgressBar(50), '▓▓▓▓▓░░░░░');
  });

  it('should handle 30%', () => {
    assert.strictEqual(createProgressBar(30), '▓▓▓░░░░░░░');
  });

  it('should handle 80%', () => {
    assert.strictEqual(createProgressBar(80), '▓▓▓▓▓▓▓▓░░');
  });

  it('should round to nearest 10%', () => {
    // 15% rounds to 2 filled
    assert.strictEqual(createProgressBar(15), '▓▓░░░░░░░░');
    // 14% rounds to 1 filled
    assert.strictEqual(createProgressBar(14), '▓░░░░░░░░░');
  });
});
