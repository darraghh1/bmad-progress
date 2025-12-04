/**
 * BMAD Structure Detector
 * Auto-detects BMAD version (v6, v4, Quick Flow) from workspace structure
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { BmadVersion, DetectionResult } from '../types';

/**
 * Detection order (per ADR-003):
 * 1. .bmad/bmm/ → v6
 * 2. .bmad-core/ → v4
 * 3. docs/stories/ → Standalone/Quick Flow
 * 4. Settings override if specified
 */
export async function detectBmadStructure(
  workspaceRoot: string,
  settingsOverride?: string
): Promise<DetectionResult> {
  // Check settings override first
  if (settingsOverride && settingsOverride.trim() !== '') {
    const overridePath = path.isAbsolute(settingsOverride)
      ? settingsOverride
      : path.join(workspaceRoot, settingsOverride);

    const exists = await pathExists(overridePath);
    if (exists) {
      return {
        version: 'quickflow',
        storiesPath: overridePath,
      };
    }
  }

  // Check v6 structure: .bmad/bmm/
  const v6Path = path.join(workspaceRoot, '.bmad', 'bmm');
  if (await pathExists(v6Path)) {
    const storiesPath = await findStoriesPath(workspaceRoot, 'v6');
    return {
      version: 'v6',
      storiesPath,
      configPath: path.join(v6Path, 'config.yaml'),
      epicsPath: path.join(workspaceRoot, 'docs', 'sprint-artifacts'),
    };
  }

  // Check v4 structure: .bmad-core/
  const v4Path = path.join(workspaceRoot, '.bmad-core');
  if (await pathExists(v4Path)) {
    const storiesPath = await findStoriesPath(workspaceRoot, 'v4');
    return {
      version: 'v4',
      storiesPath,
      configPath: path.join(v4Path, 'config.yaml'),
    };
  }

  // Check Quick Flow / standalone: docs/stories/
  const quickFlowPath = path.join(workspaceRoot, 'docs', 'stories');
  if (await pathExists(quickFlowPath)) {
    return {
      version: 'quickflow',
      storiesPath: quickFlowPath,
    };
  }

  // Try alternative story locations
  const alternativePaths = [
    path.join(workspaceRoot, 'stories'),
    path.join(workspaceRoot, 'docs', 'sprint-artifacts'),
  ];

  for (const altPath of alternativePaths) {
    if (await pathExists(altPath)) {
      return {
        version: 'quickflow',
        storiesPath: altPath,
      };
    }
  }

  // No BMAD structure found
  return {
    version: 'unknown',
    storiesPath: '',
  };
}

/**
 * Find the stories path based on BMAD version
 */
async function findStoriesPath(
  workspaceRoot: string,
  version: BmadVersion
): Promise<string> {
  const possiblePaths =
    version === 'v6'
      ? [
          path.join(workspaceRoot, 'docs', 'sprint-artifacts'),
          path.join(workspaceRoot, 'docs', 'stories'),
        ]
      : [
          path.join(workspaceRoot, 'docs', 'stories'),
          path.join(workspaceRoot, 'stories'),
        ];

  for (const p of possiblePaths) {
    if (await pathExists(p)) {
      return p;
    }
  }

  return possiblePaths[0];
}

/**
 * Check if a path exists
 */
async function pathExists(filePath: string): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
    return true;
  } catch {
    return false;
  }
}

/**
 * Get a friendly name for the BMAD version
 */
export function getVersionDisplayName(version: BmadVersion): string {
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
