/**
 * Epics File Parser
 * Parses epics.md to extract planned epic and story information
 * This allows showing stories that exist in the plan but don't have story files yet
 */

import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Planned story extracted from epics.md
 */
export interface PlannedStory {
  epicId: string;
  storyNum: string;
  storyId: string; // e.g., "1.1"
  title: string;
}

/**
 * Planned epic extracted from epics.md
 */
export interface PlannedEpic {
  id: string;
  title: string;
  goal?: string;
  stories: PlannedStory[];
}

/**
 * Result of parsing epics.md
 */
export interface EpicsFileData {
  projectName?: string;
  epics: PlannedEpic[];
  storyMap: Map<string, PlannedStory>; // storyId -> PlannedStory for quick lookup
}

/** Pattern to match epic headers: ## Epic 1: Developer Foundation */
const EPIC_HEADER_PATTERN = /^##\s+Epic\s+(\d+):\s*(.+)$/;

/** Pattern to match story headers: ### Story 1.1: Monorepo Scaffold with pnpm Workspaces */
const STORY_HEADER_PATTERN = /^###\s+Story\s+(\d+)\.(\d+):\s*(.+)$/;

/** Pattern to match epic goal: **Goal:** or **Done when:** */
const GOAL_PATTERN = /^\*\*(?:Goal|Done when):\*\*\s*(.+)$/;

/**
 * Parse all epics*.md files to extract epic and story information
 * Supports multiple files: epics.md, epics-phase2.md, hook-system-epics.md, etc.
 * @param epicsPath Path to the epics folder (e.g., _bmad-output or docs/sprint-artifacts)
 */
export async function parseEpicsFile(epicsPath: string): Promise<EpicsFileData | null> {
  const allEpics: PlannedEpic[] = [];
  const allStoryMap = new Map<string, PlannedStory>();
  let projectName: string | undefined;

  try {
    // Read all files in the epics directory
    const uri = vscode.Uri.file(epicsPath);
    const entries = await vscode.workspace.fs.readDirectory(uri);

    // Find all epic files (any .md file containing "epic" in the name)
    const epicFiles = entries
      .filter(([name, type]) =>
        type === vscode.FileType.File &&
        name.toLowerCase().includes('epic') &&
        name.endsWith('.md')
      )
      .map(([name]) => path.join(epicsPath, name));

    // Parse each epic file
    for (const filePath of epicFiles) {
      try {
        const fileUri = vscode.Uri.file(filePath);
        const content = await vscode.workspace.fs.readFile(fileUri);
        const text = Buffer.from(content).toString('utf-8');
        const parsed = parseEpicsContent(text);

        // Merge results
        if (parsed.projectName && !projectName) {
          projectName = parsed.projectName;
        }

        // Add epics (avoid duplicates by ID)
        for (const epic of parsed.epics) {
          const existing = allEpics.find(e => e.id === epic.id);
          if (!existing) {
            allEpics.push(epic);
          }
        }

        // Merge story map
        for (const [storyId, story] of parsed.storyMap) {
          if (!allStoryMap.has(storyId)) {
            allStoryMap.set(storyId, story);
          }
        }
      } catch {
        // File read error, continue with next
        continue;
      }
    }

    if (allEpics.length === 0) {
      console.log('No epic content found in epics path');
      return null;
    }

    return {
      projectName,
      epics: allEpics.sort((a, b) => parseInt(a.id) - parseInt(b.id)),
      storyMap: allStoryMap,
    };
  } catch {
    console.log('Failed to read epics directory');
    return null;
  }
}

/**
 * Parse the epics.md content and extract epic/story information
 */
function parseEpicsContent(content: string): EpicsFileData {
  const lines = content.split(/\r?\n/);
  const epics: PlannedEpic[] = [];
  const storyMap = new Map<string, PlannedStory>();

  let currentEpic: PlannedEpic | null = null;
  let projectName: string | undefined;

  // Try to extract project name from frontmatter or title
  const projectMatch = content.match(/project_name:\s*['"]?([^'"\n]+)['"]?/);
  if (projectMatch) {
    projectName = projectMatch[1].trim();
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for epic header
    const epicMatch = line.match(EPIC_HEADER_PATTERN);
    if (epicMatch) {
      // Save previous epic
      if (currentEpic) {
        epics.push(currentEpic);
      }

      currentEpic = {
        id: epicMatch[1],
        title: epicMatch[2].trim(),
        stories: [],
      };

      // Look for goal in the next few lines
      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        const goalMatch = lines[j].match(GOAL_PATTERN);
        if (goalMatch) {
          currentEpic.goal = goalMatch[1].trim();
          break;
        }
        // Stop if we hit another header
        if (lines[j].startsWith('##') || lines[j].startsWith('###')) {
          break;
        }
      }

      continue;
    }

    // Check for story header
    const storyMatch = line.match(STORY_HEADER_PATTERN);
    if (storyMatch && currentEpic) {
      const epicId = storyMatch[1];
      const storyNum = storyMatch[2];
      const storyId = `${epicId}.${storyNum}`;
      const title = storyMatch[3].trim();

      const plannedStory: PlannedStory = {
        epicId,
        storyNum,
        storyId,
        title,
      };

      // Only add if epic ID matches current epic
      if (epicId === currentEpic.id) {
        currentEpic.stories.push(plannedStory);
      }

      // Always add to story map for lookup
      storyMap.set(storyId, plannedStory);
    }
  }

  // Don't forget the last epic
  if (currentEpic) {
    epics.push(currentEpic);
  }

  return {
    projectName,
    epics,
    storyMap,
  };
}

/**
 * Get planned story title by story ID
 */
export function getPlannedStoryTitle(
  epicsData: EpicsFileData | null,
  storyId: string
): string | undefined {
  if (!epicsData) return undefined;
  return epicsData.storyMap.get(storyId)?.title;
}

/**
 * Get planned epic by ID
 */
export function getPlannedEpic(
  epicsData: EpicsFileData | null,
  epicId: string
): PlannedEpic | undefined {
  if (!epicsData) return undefined;
  return epicsData.epics.find((e) => e.id === epicId);
}
