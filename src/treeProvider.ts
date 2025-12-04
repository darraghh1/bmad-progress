/**
 * TreeDataProvider Implementation
 * Manages the TreeView sidebar with Focus and Map modes
 */

import * as vscode from 'vscode';
import { BmadProject } from './bmadProject';
import { ViewMode, StoryData, EpicData, ProjectProgress } from './types';
import { getNextTask } from './parser/storyParser';
import {
  getStoryStatusIcon,
  getStoryStatusLabel,
  getEpicStatusIcon,
} from './parser/sprintStatusParser';

/**
 * Base tree element type
 */
type TreeElement =
  | ProjectTreeItem
  | EpicTreeItem
  | StoryTreeItem
  | FocusHeaderItem
  | InfoTreeItem
  | ActionTreeItem;

/**
 * Project tree item (top-level in Map Mode)
 */
class ProjectTreeItem extends vscode.TreeItem {
  constructor(
    public readonly project: BmadProject,
    public readonly progress: ProjectProgress
  ) {
    super(progress.projectName, vscode.TreeItemCollapsibleState.Expanded);
    this.iconPath = new vscode.ThemeIcon('folder');
    this.description = `${progress.percentage}%`;
    this.tooltip = `${progress.completedTasks}/${progress.totalTasks} tasks`;
    this.contextValue = 'project';
  }
}

/**
 * Epic tree item (contains stories)
 */
class EpicTreeItem extends vscode.TreeItem {
  constructor(public readonly epic: EpicData) {
    super(
      epic.name,
      epic.stories.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );

    // Icon based on epic status
    const iconName = getEpicStatusIcon(epic.bmadStatus);
    if (epic.bmadStatus === 'cancelled') {
      this.iconPath = new vscode.ThemeIcon(iconName, new vscode.ThemeColor('disabledForeground'));
      this.description = `[Cancelled]`;
    } else {
      this.iconPath = new vscode.ThemeIcon(
        epic.bmadStatus === 'contexted' ? 'pass-filled' : 'circle-outline'
      );
      this.description = `${createProgressBar(epic.percentage)} ${epic.percentage}%`;
    }

    // Tooltip with goal if available
    const tooltipLines = [`Epic ${epic.id}: ${epic.completedCount}/${epic.totalCount} tasks`];
    if (epic.goal) {
      tooltipLines.push(`Goal: ${epic.goal}`);
    }
    tooltipLines.push(`Status: ${epic.bmadStatus}`);
    this.tooltip = tooltipLines.join('\n');

    this.contextValue = 'epic';
  }
}

/**
 * Story tree item (leaf node, clickable)
 */
class StoryTreeItem extends vscode.TreeItem {
  constructor(public readonly story: StoryData) {
    super(story.storyId, vscode.TreeItemCollapsibleState.None);

    // Description with BMAD status badge
    const statusLabel = getStoryStatusLabel(story.bmadStatus);
    this.description = `${truncate(story.title, 30)} [${statusLabel}]`;

    // Tooltip with full details
    this.tooltip = [
      story.title,
      `Tasks: ${story.completedCount}/${story.totalCount} (${story.percentage}%)`,
      `Status: ${statusLabel}`,
    ].join('\n');

    this.contextValue = 'story';

    // Icon based on BMAD status
    const iconName = getStoryStatusIcon(story.bmadStatus);
    switch (story.bmadStatus) {
      case 'done':
        this.iconPath = new vscode.ThemeIcon(iconName, new vscode.ThemeColor('charts.green'));
        break;
      case 'review':
        this.iconPath = new vscode.ThemeIcon(iconName, new vscode.ThemeColor('charts.purple'));
        break;
      case 'in-progress':
        this.iconPath = new vscode.ThemeIcon(iconName, new vscode.ThemeColor('charts.yellow'));
        break;
      case 'ready-for-dev':
        this.iconPath = new vscode.ThemeIcon(iconName, new vscode.ThemeColor('charts.blue'));
        break;
      case 'drafted':
        this.iconPath = new vscode.ThemeIcon(iconName, new vscode.ThemeColor('charts.orange'));
        break;
      case 'backlog':
      default:
        this.iconPath = new vscode.ThemeIcon(iconName);
        break;
    }

    // Click to open
    this.command = {
      command: 'bmad.openStory',
      title: 'Open Story',
      arguments: [story],
    };
  }
}

/**
 * Focus mode header item (expandable to show details)
 */
class FocusHeaderItem extends vscode.TreeItem {
  constructor(
    public readonly story: StoryData,
    public readonly progress: ProjectProgress
  ) {
    const statusLabel = getStoryStatusLabel(story.bmadStatus);
    super(`FOCUS: Story ${story.storyId} [${statusLabel}]`, vscode.TreeItemCollapsibleState.Expanded);
    this.iconPath = new vscode.ThemeIcon('target');
    this.description = truncate(story.title, 35);
    this.tooltip = `${story.title}\nStatus: ${statusLabel}\nTasks: ${story.completedCount}/${story.totalCount}`;
    this.contextValue = 'focusHeader';
  }
}

/**
 * Info tree item (non-interactive display)
 */
class InfoTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    icon: string,
    description?: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon(icon);
    if (description) {
      this.description = description;
    }
    this.contextValue = 'info';
  }
}

/**
 * Action tree item (clickable)
 */
class ActionTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    icon: string,
    command: vscode.Command
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon(icon);
    this.command = command;
    this.contextValue = 'action';
  }
}

export class BmadTreeProvider implements vscode.TreeDataProvider<TreeElement> {
  private viewMode: ViewMode = 'focus';
  private projects: BmadProject[] = [];
  private disposables: vscode.Disposable[] = [];

  private readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeElement | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor() {}

  setProjects(projects: BmadProject[]): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.projects = projects;

    for (const project of projects) {
      const disposable = project.onDidChange(() => {
        this._onDidChangeTreeData.fire();
      });
      this.disposables.push(disposable);
    }

    this._onDidChangeTreeData.fire();
  }

  toggleMode(): ViewMode {
    this.viewMode = this.viewMode === 'focus' ? 'map' : 'focus';
    this._onDidChangeTreeData.fire();
    return this.viewMode;
  }

  setMode(mode: ViewMode): void {
    this.viewMode = mode;
    this._onDidChangeTreeData.fire();
  }

  getMode(): ViewMode {
    return this.viewMode;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeElement): vscode.TreeItem {
    return element;
  }

  /**
   * Get children - this is where the hierarchy magic happens
   */
  getChildren(element?: TreeElement): vscode.ProviderResult<TreeElement[]> {
    // Root level
    if (!element) {
      return this.getRootItems();
    }

    // Project children (epics) - Map Mode
    if (element instanceof ProjectTreeItem) {
      return element.progress.epics.map((epic) => new EpicTreeItem(epic));
    }

    // Epic children (stories) - Map Mode
    if (element instanceof EpicTreeItem) {
      return element.epic.stories.map((story) => new StoryTreeItem(story));
    }

    // Focus header children (stats + next task)
    if (element instanceof FocusHeaderItem) {
      return this.getFocusChildren(element.story, element.progress);
    }

    return [];
  }

  /**
   * Get root level items based on mode
   */
  private getRootItems(): TreeElement[] {
    if (this.projects.length === 0) {
      return [new InfoTreeItem('No BMAD project detected', 'warning')];
    }

    const items: TreeElement[] = [];

    if (this.viewMode === 'focus') {
      items.push(...this.getFocusRootItems());
    } else {
      items.push(...this.getMapRootItems());
    }

    // Add mode toggle at bottom
    items.push(
      new ActionTreeItem(
        `Switch to ${this.viewMode === 'focus' ? 'Map' : 'Focus'} Mode`,
        'sync',
        { command: 'bmad.toggleView', title: 'Toggle View' }
      )
    );

    return items;
  }

  /**
   * Focus Mode: Show current story with expandable details
   */
  private getFocusRootItems(): TreeElement[] {
    const project = this.projects[0];
    const progress = project?.getProgress();

    if (!progress) {
      return [new InfoTreeItem('Loading...', 'loading~spin')];
    }

    if (!progress.currentStory) {
      return [new InfoTreeItem('No story in progress', 'info')];
    }

    return [new FocusHeaderItem(progress.currentStory, progress)];
  }

  /**
   * Focus Mode children: stats and next task
   */
  private getFocusChildren(story: StoryData, progress: ProjectProgress): TreeElement[] {
    const items: TreeElement[] = [];

    // Done count
    items.push(new InfoTreeItem(`${story.completedCount} done`, 'check'));

    // Remaining count
    const remaining = story.totalCount - story.completedCount;
    items.push(new InfoTreeItem(`${remaining} remaining`, 'list-ordered'));

    // Next task (clickable)
    const nextTask = getNextTask(story);
    if (nextTask) {
      items.push(
        new ActionTreeItem(
          `Next: ${truncate(nextTask.text, 45)}`,
          'arrow-right',
          {
            command: 'bmad.openStoryAtLine',
            title: 'Open Story',
            arguments: [story, nextTask.line],
          }
        )
      );
    }

    // Session streak
    if (progress.sessionCompletedTasks > 0) {
      items.push(new InfoTreeItem(`${progress.sessionCompletedTasks} tasks this session`, 'flame'));
    }

    // Git stats
    if (progress.tasksSinceCommit > 0) {
      items.push(new InfoTreeItem(`${progress.tasksSinceCommit} since last commit`, 'git-commit'));
    }

    return items;
  }

  /**
   * Map Mode: Show epics directly at root level (no project wrapper)
   */
  private getMapRootItems(): TreeElement[] {
    const items: TreeElement[] = [];

    for (const project of this.projects) {
      const progress = project.getProgress();
      if (progress) {
        // Add epics directly - no project wrapper
        for (const epic of progress.epics) {
          items.push(new EpicTreeItem(epic));
        }
      }
    }

    return items;
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this._onDidChangeTreeData.dispose();
  }
}

/**
 * Create visual progress bar
 */
function createProgressBar(percentage: number): string {
  const filled = Math.round(percentage / 10);
  const empty = 10 - filled;
  return '▓'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Truncate string with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
