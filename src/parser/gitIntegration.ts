/**
 * Git Integration
 * Tracks tasks completed since last commit
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Count completed tasks since the last git commit
 * Compares current story files with their committed versions
 */
export async function getTasksSinceCommit(
  workspaceRoot: string,
  storyFiles: string[]
): Promise<number> {
  let tasksDelta = 0;

  for (const filePath of storyFiles) {
    const relativePath = path.relative(workspaceRoot, filePath);
    const delta = await getFileTaskDelta(workspaceRoot, relativePath);
    tasksDelta += delta;
  }

  return Math.max(0, tasksDelta);
}

/**
 * Get the task completion delta for a single file
 */
async function getFileTaskDelta(
  workspaceRoot: string,
  relativePath: string
): Promise<number> {
  try {
    // Get current file content
    const currentUri = vscode.Uri.file(path.join(workspaceRoot, relativePath));
    const currentContent = await vscode.workspace.fs.readFile(currentUri);
    const currentText = Buffer.from(currentContent).toString('utf-8');

    // Get committed file content
    const committedText = await getCommittedFileContent(workspaceRoot, relativePath);
    if (!committedText) {
      // File is new, count all completed tasks
      return countCompletedTasks(currentText);
    }

    // Compare task counts
    const currentCompleted = countCompletedTasks(currentText);
    const committedCompleted = countCompletedTasks(committedText);

    return currentCompleted - committedCompleted;
  } catch {
    return 0;
  }
}

/**
 * Get the content of a file from the last commit
 */
async function getCommittedFileContent(
  workspaceRoot: string,
  relativePath: string
): Promise<string | null> {
  try {
    const { stdout } = await execAsync(
      `git show HEAD:"${relativePath.replace(/\\/g, '/')}"`,
      { cwd: workspaceRoot }
    );
    return stdout;
  } catch {
    // File might not exist in git or git not available
    return null;
  }
}

/**
 * Count completed tasks in text
 */
function countCompletedTasks(text: string): number {
  const matches = text.match(/- \[[xX]\]/g);
  return matches ? matches.length : 0;
}

/**
 * Check if git is available in the workspace
 */
export async function isGitAvailable(workspaceRoot: string): Promise<boolean> {
  try {
    await execAsync('git rev-parse --git-dir', { cwd: workspaceRoot });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the last commit hash
 */
export async function getLastCommitHash(workspaceRoot: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync('git rev-parse HEAD', { cwd: workspaceRoot });
    return stdout.trim();
  } catch {
    return null;
  }
}
