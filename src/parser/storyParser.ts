/**
 * Story File Parser
 * Parses markdown story files for task checkboxes
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { TaskItem, StoryData, EpicData, SprintStatus, BmadStoryStatus, BmadEpicStatus } from '../types';

/** Regex patterns for parsing */
const CHECKBOX_PATTERN = /^(\s*)- \[([ xX])\] (.+)$/;
const STORY_ID_PATTERN = /story[_-]?(\d+)[_-]?(\d+)?/i;
const EPIC_ID_PATTERN = /epic[_-]?(\d+)/i;

/**
 * Parse a story file and extract task data
 * @param filePath Path to the story file
 * @param bmadStatus Optional BMAD status from sprint-status.yaml
 */
export async function parseStoryFile(
  filePath: string,
  bmadStatus: BmadStoryStatus = 'backlog'
): Promise<StoryData | null> {
  try {
    const uri = vscode.Uri.file(filePath);
    const content = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(content).toString('utf-8');
    // Handle Windows line endings (\r\n) and normalize
    const lines = text.split(/\r?\n/);

    const tasks = parseTasksFromLines(lines);
    const title = extractTitle(lines);
    const storyId = extractStoryId(filePath, lines);

    const completedCount = countCompleted(tasks);
    const totalCount = countTotal(tasks);
    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const stat = await vscode.workspace.fs.stat(uri);

    return {
      filePath,
      fileName: path.basename(filePath),
      storyId,
      title,
      tasks,
      completedCount,
      totalCount,
      percentage,
      taskStatus: getTaskStatus(completedCount, totalCount),
      bmadStatus,
      lastModified: new Date(stat.mtime),
    };
  } catch (error) {
    // Gracefully handle malformed files (AC11)
    console.error(`Failed to parse story file: ${filePath}`, error);
    return null;
  }
}

/**
 * Parse task items from lines, handling nested checkboxes
 */
function parseTasksFromLines(lines: string[]): TaskItem[] {
  const tasks: TaskItem[] = [];
  const stack: { indent: number; task: TaskItem }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(CHECKBOX_PATTERN);

    if (match) {
      const indent = match[1].length;
      const completed = match[2].toLowerCase() === 'x';
      // Handle links in checkbox text: `- [ ] See [docs](url)`
      const text = match[3].trim();

      const task: TaskItem = {
        text,
        completed,
        line: i + 1,
        subtasks: [],
      };

      // Find parent based on indentation
      while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }

      if (stack.length === 0) {
        // Top-level task
        tasks.push(task);
      } else {
        // Nested task
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

/**
 * Extract title from frontmatter or first heading
 */
function extractTitle(lines: string[]): string {
  let inFrontmatter = false;

  for (const line of lines) {
    // Check frontmatter
    if (line.trim() === '---') {
      inFrontmatter = !inFrontmatter;
      continue;
    }

    if (inFrontmatter) {
      const titleMatch = line.match(/^title:\s*["']?(.+?)["']?\s*$/);
      if (titleMatch) {
        return titleMatch[1];
      }
      continue;
    }

    // Check for heading
    const headingMatch = line.match(/^#\s+(.+)$/);
    if (headingMatch) {
      return headingMatch[1];
    }
  }

  return 'Untitled Story';
}

/**
 * Extract story ID from filename or content
 */
function extractStoryId(filePath: string, lines: string[]): string {
  const fileName = path.basename(filePath, path.extname(filePath));

  // Try to extract from filename
  const fileMatch = fileName.match(STORY_ID_PATTERN);
  if (fileMatch) {
    return fileMatch[2] ? `${fileMatch[1]}.${fileMatch[2]}` : fileMatch[1];
  }

  // Try to extract from content
  for (const line of lines.slice(0, 10)) {
    const contentMatch = line.match(/story\s+(\d+\.?\d*)/i);
    if (contentMatch) {
      return contentMatch[1];
    }
  }

  // Fallback to filename
  return fileName;
}

/**
 * Count completed tasks recursively
 */
function countCompleted(tasks: TaskItem[]): number {
  let count = 0;
  for (const task of tasks) {
    if (task.completed) {
      count++;
    }
    if (task.subtasks) {
      count += countCompleted(task.subtasks);
    }
  }
  return count;
}

/**
 * Count total tasks recursively
 */
function countTotal(tasks: TaskItem[]): number {
  let count = 0;
  for (const task of tasks) {
    count++;
    if (task.subtasks) {
      count += countTotal(task.subtasks);
    }
  }
  return count;
}

/**
 * Get task-based status from completion counts
 */
function getTaskStatus(completed: number, total: number): 'completed' | 'in-progress' | 'not-started' {
  if (total === 0) return 'not-started';
  if (completed === total) return 'completed';
  if (completed > 0) return 'in-progress';
  return 'not-started';
}

/** Pattern to match story files: {epic}-{story}-name.md (e.g., 1-2-sunset-ember-theme.md) */
const STORY_FILE_PATTERN = /^(\d+)-(\d+)-(.+)\.md$/;

/** Files to skip (not stories) */
const SKIP_PATTERNS = [
  /^tech-spec/i,
  /^sprint-status/i,
  /^index\./i,
  /\.context\./i,
  /^readme/i,
];

/**
 * Parse all stories in a directory into epics
 * Supports both flat structure ({epic}-{story}-name.md) and epic subfolders
 * @param storiesPath Path to stories directory
 * @param sprintStatus Optional sprint status for BMAD workflow status lookup
 */
export async function parseStoriesDirectory(
  storiesPath: string,
  sprintStatus?: SprintStatus | null
): Promise<EpicData[]> {
  const epicMap: Map<string, StoryData[]> = new Map();

  try {
    const uri = vscode.Uri.file(storiesPath);
    const entries = await vscode.workspace.fs.readDirectory(uri);

    // Process all entries
    for (const [name, type] of entries) {
      // Handle epic subfolders (epic-1/, epic-2/, etc.)
      if (type === vscode.FileType.Directory) {
        const epicMatch = name.match(EPIC_ID_PATTERN);
        if (epicMatch) {
          const epicId = epicMatch[1];
          const epicStories = await parseEpicFolder(path.join(storiesPath, name), sprintStatus);
          if (epicStories.length > 0) {
            const existing = epicMap.get(epicId) || [];
            epicMap.set(epicId, [...existing, ...epicStories]);
          }
        }
        continue;
      }

      // Handle flat structure files: {epic}-{story}-name.md
      if (type === vscode.FileType.File && name.endsWith('.md')) {
        // Skip non-story files
        if (SKIP_PATTERNS.some((pattern) => pattern.test(name))) {
          continue;
        }

        const fileMatch = name.match(STORY_FILE_PATTERN);
        if (fileMatch) {
          const epicId = fileMatch[1];
          const storyNum = fileMatch[2];
          const storyKey = `${epicId}.${storyNum}`;

          // Get BMAD status from sprint-status.yaml
          const bmadStatus = sprintStatus?.storyStatuses.get(storyKey) || 'backlog';

          const storyData = await parseStoryFile(path.join(storiesPath, name), bmadStatus);
          if (storyData) {
            const existing = epicMap.get(epicId) || [];
            epicMap.set(epicId, [...existing, storyData]);
          }
        }
      }
    }
  } catch (error) {
    console.error(`Failed to parse stories directory: ${storiesPath}`, error);
  }

  // Convert map to EpicData array
  const epics: EpicData[] = [];
  for (const [epicId, stories] of epicMap) {
    // Sort stories by story number
    stories.sort((a, b) => {
      const aMatch = a.storyId.match(/(\d+)\.?(\d*)/);
      const bMatch = b.storyId.match(/(\d+)\.?(\d*)/);
      const aNum = aMatch ? parseInt(aMatch[2] || aMatch[1]) : 0;
      const bNum = bMatch ? parseInt(bMatch[2] || bMatch[1]) : 0;
      return aNum - bNum;
    });

    // Get epic metadata from sprint status
    const epicStatus = sprintStatus?.epicStatuses.get(epicId) || 'backlog';
    const epicGoal = sprintStatus?.epicGoals.get(epicId);

    epics.push(createEpicData(epicId, `Epic ${epicId}`, storiesPath, stories, epicStatus, epicGoal));
  }

  // Include backlogged/contexted epics from sprint-status.yaml that have no story files yet
  // This ensures the full roadmap is visible even for epics without stories
  if (sprintStatus) {
    for (const [epicId, epicStatus] of sprintStatus.epicStatuses) {
      // Skip if we already have this epic from story files
      if (epicMap.has(epicId)) {
        continue;
      }

      const epicGoal = sprintStatus.epicGoals.get(epicId);
      // Create empty epic entry so it shows in the tree view
      epics.push(createEpicData(epicId, `Epic ${epicId}`, storiesPath, [], epicStatus, epicGoal));
    }
  }

  // Sort epics by ID
  return epics.sort((a, b) => {
    const aNum = parseInt(a.id) || 0;
    const bNum = parseInt(b.id) || 0;
    return aNum - bNum;
  });
}

/**
 * Parse stories from an epic subfolder
 */
async function parseEpicFolder(
  epicFolder: string,
  sprintStatus?: SprintStatus | null
): Promise<StoryData[]> {
  const stories: StoryData[] = [];

  try {
    const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(epicFolder));

    for (const [name, type] of entries) {
      if (type === vscode.FileType.File && name.endsWith('.md')) {
        if (SKIP_PATTERNS.some((pattern) => pattern.test(name))) {
          continue;
        }

        // Try to extract story key for status lookup
        const fileMatch = name.match(STORY_FILE_PATTERN);
        let bmadStatus: BmadStoryStatus = 'backlog';
        if (fileMatch && sprintStatus) {
          const storyKey = `${fileMatch[1]}.${fileMatch[2]}`;
          bmadStatus = sprintStatus.storyStatuses.get(storyKey) || 'backlog';
        }

        const storyData = await parseStoryFile(path.join(epicFolder, name), bmadStatus);
        if (storyData) {
          stories.push(storyData);
        }
      }
    }
  } catch (error) {
    console.error(`Failed to parse epic folder: ${epicFolder}`, error);
  }

  return stories;
}

/**
 * Create epic data from stories
 */
function createEpicData(
  id: string,
  name: string,
  folderPath: string,
  stories: StoryData[],
  bmadStatus: BmadEpicStatus = 'backlog',
  goal?: string
): EpicData {
  const completedCount = stories.reduce((sum, s) => sum + s.completedCount, 0);
  const totalCount = stories.reduce((sum, s) => sum + s.totalCount, 0);

  return {
    id,
    name,
    goal,
    folderPath,
    stories,
    completedCount,
    totalCount,
    percentage: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
    bmadStatus,
  };
}

/**
 * Get the next uncompleted task from a story
 */
export function getNextTask(story: StoryData): TaskItem | null {
  function findNext(tasks: TaskItem[]): TaskItem | null {
    for (const task of tasks) {
      if (!task.completed) {
        return task;
      }
      if (task.subtasks) {
        const nextSubtask = findNext(task.subtasks);
        if (nextSubtask) {
          return nextSubtask;
        }
      }
    }
    return null;
  }

  return findNext(story.tasks);
}
