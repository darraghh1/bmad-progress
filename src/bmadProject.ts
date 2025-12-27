/**
 * BmadProject - Per-project state management
 * Manages project detection, file watching, and progress calculation
 */

import * as vscode from 'vscode';
import * as path from 'path';
import {
  ProjectProgress,
  DetectionResult,
  StoryData,
  EpicData,
  ExtensionSettings,
  SprintStatus,
} from './types';
import { detectBmadStructure, getVersionDisplayName } from './parser/detector';
import { parseStoriesDirectory, parseStoryFile } from './parser/storyParser';
import { getTasksSinceCommit, isGitAvailable } from './parser/gitIntegration';
import { parseSprintStatus, isActiveStatus } from './parser/sprintStatusParser';

/** Debounce delay for file watching (ms) */
const DEBOUNCE_DELAY = 500;

export class BmadProject implements vscode.Disposable {
  private readonly workspaceRoot: string;
  private readonly projectName: string;
  private detection: DetectionResult | null = null;
  private progress: ProjectProgress | null = null;
  private fileWatcher: vscode.FileSystemWatcher | null = null;
  private epicsWatcher: vscode.FileSystemWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private sessionStartCompletedTasks = 0;
  private gitAvailable = false;

  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(
    workspaceFolder: vscode.WorkspaceFolder,
    private readonly settings: ExtensionSettings
  ) {
    this.workspaceRoot = workspaceFolder.uri.fsPath;
    this.projectName = workspaceFolder.name;
  }

  /**
   * Initialize the project - detect structure and set up watching
   */
  async initialize(): Promise<boolean> {
    // Detect BMAD structure
    this.detection = await detectBmadStructure(
      this.workspaceRoot,
      this.settings.storiesPath
    );

    if (this.detection.version === 'unknown' || !this.detection.storiesPath) {
      return false;
    }

    // Check git availability
    if (this.settings.gitIntegration) {
      this.gitAvailable = await isGitAvailable(this.workspaceRoot);
    }

    // Set up file watcher
    this.setupFileWatcher();

    // Initial load
    await this.refresh();

    // Record session start
    if (this.progress) {
      this.sessionStartCompletedTasks = this.progress.completedTasks;
    }

    return true;
  }

  /**
   * Set up file system watcher with debounce
   */
  private setupFileWatcher(): void {
    if (!this.detection?.storiesPath) return;

    const handleChange = () => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = setTimeout(() => {
        this.refresh();
      }, DEBOUNCE_DELAY);
    };

    // Watch stories directory
    const storiesPattern = new vscode.RelativePattern(
      this.detection.storiesPath,
      '**/*.md'
    );
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(storiesPattern);
    this.fileWatcher.onDidChange(handleChange);
    this.fileWatcher.onDidCreate(handleChange);
    this.fileWatcher.onDidDelete(handleChange);

    // Also watch epics.md for planned story changes
    if (this.detection.epicsPath) {
      const epicsPattern = new vscode.RelativePattern(
        this.detection.epicsPath,
        'epics*.md'
      );
      this.epicsWatcher = vscode.workspace.createFileSystemWatcher(epicsPattern);
      this.epicsWatcher.onDidChange(handleChange);
      this.epicsWatcher.onDidCreate(handleChange);
      this.epicsWatcher.onDidDelete(handleChange);
    }
  }

  /**
   * Refresh progress data
   */
  async refresh(): Promise<void> {
    if (!this.detection || this.detection.version === 'unknown') {
      return;
    }

    try {
      // Load sprint status from YAML (if available)
      const sprintStatus = await parseSprintStatus(this.detection.storiesPath);

      // Parse stories with sprint status for BMAD workflow states
      // Also pass epicsPath to load planned stories from epics.md
      const epics = await parseStoriesDirectory(
        this.detection.storiesPath,
        sprintStatus,
        this.detection.epicsPath
      );
      const currentStory = this.findCurrentStory(epics);

      const totalTasks = epics.reduce((sum, e) => sum + e.totalCount, 0);
      const completedTasks = epics.reduce((sum, e) => sum + e.completedCount, 0);

      // Calculate tasks since commit
      let tasksSinceCommit = 0;
      if (this.settings.gitIntegration && this.gitAvailable) {
        const storyFiles = this.getAllStoryFiles(epics);
        tasksSinceCommit = await getTasksSinceCommit(this.workspaceRoot, storyFiles);
      }

      // Calculate session tasks
      const sessionCompletedTasks = Math.max(
        0,
        completedTasks - this.sessionStartCompletedTasks
      );

      this.progress = {
        rootPath: this.workspaceRoot,
        projectName: this.projectName,
        version: this.detection.version,
        epics,
        currentStory,
        totalTasks,
        completedTasks,
        percentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        sessionCompletedTasks,
        tasksSinceCommit,
      };

      this._onDidChange.fire();
    } catch (error) {
      console.error('Failed to refresh BMAD progress:', error);
    }
  }

  /**
   * Find the current story using BMAD workflow status
   * Priority: review > in-progress > ready-for-dev > (by last modified)
   */
  private findCurrentStory(epics: EpicData[]): StoryData | null {
    // First, look for stories with active BMAD status
    // Priority order: review, in-progress, ready-for-dev
    const priorityOrder = ['review', 'in-progress', 'ready-for-dev'];

    for (const status of priorityOrder) {
      for (const epic of epics) {
        // Skip cancelled/deprecated epics
        if (epic.bmadStatus === 'cancelled' || epic.bmadStatus === 'deprecated') continue;

        for (const story of epic.stories) {
          if (story.bmadStatus === status) {
            return story;
          }
        }
      }
    }

    // Fallback: find most recently modified story with task progress
    let currentStory: StoryData | null = null;
    let latestModified = new Date(0);

    for (const epic of epics) {
      if (epic.bmadStatus === 'cancelled' || epic.bmadStatus === 'deprecated') continue;

      for (const story of epic.stories) {
        if (story.taskStatus === 'in-progress' && story.lastModified > latestModified) {
          currentStory = story;
          latestModified = story.lastModified;
        }
      }
    }

    return currentStory;
  }

  /**
   * Get all story file paths (excluding planned stories without files)
   */
  private getAllStoryFiles(epics: EpicData[]): string[] {
    const files: string[] = [];
    for (const epic of epics) {
      for (const story of epic.stories) {
        // Skip planned stories that don't have files yet
        if (story.filePath) {
          files.push(story.filePath);
        }
      }
    }
    return files;
  }

  /**
   * Get current progress
   */
  getProgress(): ProjectProgress | null {
    return this.progress;
  }

  /**
   * Get detection result
   */
  getDetection(): DetectionResult | null {
    return this.detection;
  }

  /**
   * Get project name
   */
  getName(): string {
    return this.projectName;
  }

  /**
   * Get workspace root
   */
  getRoot(): string {
    return this.workspaceRoot;
  }

  /**
   * Get diagnostic information
   */
  getDiagnostics(): string {
    const lines: string[] = [
      `## Project: ${this.projectName}`,
      `- Root: ${this.workspaceRoot}`,
      `- Version: ${this.detection ? getVersionDisplayName(this.detection.version) : 'Not initialized'}`,
      `- Stories Path: ${this.detection?.storiesPath || 'Not found'}`,
      `- Epics Path: ${this.detection?.epicsPath || 'Not found'}`,
      `- Git Available: ${this.gitAvailable ? 'Yes' : 'No'}`,
    ];

    if (this.progress) {
      lines.push(
        `- Total Tasks: ${this.progress.totalTasks}`,
        `- Completed: ${this.progress.completedTasks}`,
        `- Progress: ${this.progress.percentage}%`,
        `- Epics: ${this.progress.epics.length}`,
        `- Current Story: ${this.progress.currentStory?.storyId || 'None'}`
      );
    }

    return lines.join('\n');
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.fileWatcher?.dispose();
    this.epicsWatcher?.dispose();
    this._onDidChange.dispose();
  }
}
