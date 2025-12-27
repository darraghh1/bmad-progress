/**
 * Sprint Status YAML Parser
 * Parses sprint-status.yaml for authoritative BMAD workflow status
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { SprintStatus, BmadEpicStatus, BmadStoryStatus } from '../types';

/** Valid story statuses from BMAD workflow */
const VALID_STORY_STATUSES: BmadStoryStatus[] = [
  'backlog',
  'drafted',
  'ready-for-dev',
  'in-progress',
  'review',
  'done',
  'deprecated',
];

/** Valid epic statuses */
const VALID_EPIC_STATUSES: BmadEpicStatus[] = ['backlog', 'in-progress', 'done', 'contexted', 'cancelled', 'deprecated'];

/**
 * Parse sprint-status.yaml from the stories directory
 */
export async function parseSprintStatus(storiesPath: string): Promise<SprintStatus | null> {
  const yamlPath = path.join(storiesPath, 'sprint-status.yaml');

  try {
    const uri = vscode.Uri.file(yamlPath);
    const content = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(content).toString('utf-8');

    return parseSprintStatusContent(text);
  } catch (error) {
    // File doesn't exist or can't be read - that's OK
    console.log('No sprint-status.yaml found, using task-based status');
    return null;
  }
}

/**
 * Parse the YAML content and extract status information
 */
function parseSprintStatusContent(content: string): SprintStatus {
  const epicStatuses = new Map<string, BmadEpicStatus>();
  const storyStatuses = new Map<string, BmadStoryStatus>();
  const epicGoals = new Map<string, string>();

  // Parse YAML
  const data = yaml.load(content) as Record<string, unknown>;

  // Extract project info
  const project = (data.project as string) || 'Unknown';
  const storyLocation = (data.story_location as string) || 'docs/sprint-artifacts';

  // Parse development_status section
  const devStatus = data.development_status as Record<string, string> | undefined;
  if (devStatus) {
    for (const [key, value] of Object.entries(devStatus)) {
      // Epic status: epic-1, epic-2, hs-epic-6, etc.
      const epicMatch = key.match(/^(?:hs-)?epic-(\d+)$/);
      if (epicMatch) {
        // Preserve prefix for hs-epics (e.g., "hs-6" vs "6")
        const epicId = key.startsWith('hs-') ? `hs-${epicMatch[1]}` : epicMatch[1];
        if (VALID_EPIC_STATUSES.includes(value as BmadEpicStatus)) {
          epicStatuses.set(epicId, value as BmadEpicStatus);
        }
        continue;
      }

      // Retrospective entries - skip
      if (key.includes('retrospective')) {
        continue;
      }

      // Story status: 1-1-story-name, hs-6-1-project-init, etc.
      const storyMatch = key.match(/^(hs-)?(\d+)-(\d+)/);
      if (storyMatch) {
        // Preserve prefix for hs-stories
        const prefix = storyMatch[1] || '';
        const storyKey = `${prefix}${storyMatch[2]}.${storyMatch[3]}`;
        if (VALID_STORY_STATUSES.includes(value as BmadStoryStatus)) {
          storyStatuses.set(storyKey, value as BmadStoryStatus);
        }
      }
    }
  }

  // Extract epic goals from comments
  // Parse lines looking for "# Goal:" patterns after "epic-X:" sections
  const lines = content.split(/\r?\n/);
  let currentEpic: string | null = null;

  for (const line of lines) {
    // Check for epic section header in comments
    const epicHeaderMatch = line.match(/^[\s#]*Epic\s+(\d+):\s*(.+?)(?:\s*\(|$)/i);
    if (epicHeaderMatch) {
      currentEpic = epicHeaderMatch[1];
      continue;
    }

    // Check for Goal line
    const goalMatch = line.match(/^[\s#]*Goal:\s*(.+)$/i);
    if (goalMatch && currentEpic) {
      epicGoals.set(currentEpic, goalMatch[1].trim());
      currentEpic = null;
    }
  }

  return {
    project,
    storyLocation,
    epicStatuses,
    storyStatuses,
    epicGoals,
  };
}

/**
 * Get status icon for a BMAD story status
 */
export function getStoryStatusIcon(status: BmadStoryStatus): string {
  switch (status) {
    case 'done':
      return 'check';
    case 'review':
      return 'eye';
    case 'in-progress':
      return 'sync~spin';
    case 'ready-for-dev':
      return 'rocket';
    case 'drafted':
      return 'edit';
    case 'deprecated':
      return 'archive';
    case 'backlog':
      return 'circle-outline';
    default:
      return 'circle-outline';
  }
}

/**
 * Get status icon for a BMAD epic status
 */
export function getEpicStatusIcon(status: BmadEpicStatus): string {
  switch (status) {
    case 'done':
      return 'check-all';
    case 'in-progress':
      return 'sync~spin';
    case 'contexted':
      return 'pass-filled';
    case 'cancelled':
      return 'close';
    case 'deprecated':
      return 'archive';
    case 'backlog':
      return 'circle-outline';
    default:
      return 'circle-outline';
  }
}

/**
 * Get display label for story status
 */
export function getStoryStatusLabel(status: BmadStoryStatus): string {
  switch (status) {
    case 'done':
      return 'Done';
    case 'review':
      return 'Review';
    case 'in-progress':
      return 'In Progress';
    case 'ready-for-dev':
      return 'Ready';
    case 'drafted':
      return 'Drafted';
    case 'deprecated':
      return 'Deprecated';
    case 'backlog':
      return 'Backlog';
    default:
      return status;
  }
}

/**
 * Get display label for epic status
 */
export function getEpicStatusLabel(status: BmadEpicStatus): string {
  switch (status) {
    case 'done':
      return 'Done';
    case 'in-progress':
      return 'In Progress';
    case 'contexted':
      return 'Active';
    case 'cancelled':
      return 'Cancelled';
    case 'deprecated':
      return 'Deprecated';
    case 'backlog':
      return 'Backlog';
    default:
      return status;
  }
}

/**
 * Check if a story is "active" (needs attention)
 */
export function isActiveStatus(status: BmadStoryStatus): boolean {
  return status === 'in-progress' || status === 'review' || status === 'ready-for-dev';
}
