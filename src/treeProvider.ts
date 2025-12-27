/**
 * TreeDataProvider Implementation
 * Manages the TreeView sidebar showing epic/story progress
 */

import * as vscode from 'vscode';
import { BmadProject } from './bmadProject';
import { StoryData, EpicData, ProjectProgress } from './types';
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
  | InfoTreeItem;

/**
 * Project tree item (top-level)
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
    // Extract title from "Epic X: Title" format
    // Handle cases: "Epic 1: Some Title" → "Some Title", "Epic 6" → null
    const titleMatch = epic.name.match(/^Epic\s+\d+:\s*(.+)$/i);
    const title = titleMatch ? titleMatch[1] : null;

    // Compact label: "1 · Title" if title exists, otherwise just "1"
    const compactLabel = title ? `${epic.id} · ${title}` : epic.id;

    // Always show as collapsible for visual consistency
    super(compactLabel, vscode.TreeItemCollapsibleState.Collapsed);

    // Icon and description based on epic status
    const iconName = getEpicStatusIcon(epic.bmadStatus);

    // Count done stories for progress display
    const doneStories = epic.stories.filter(s => s.bmadStatus === 'done').length;
    const storyProgress = `${doneStories}/${epic.stories.length}`;

    switch (epic.bmadStatus) {
      case 'done':
        this.iconPath = new vscode.ThemeIcon(iconName, new vscode.ThemeColor('charts.green'));
        this.description = `[Done] ${storyProgress}`;
        break;
      case 'in-progress':
        this.iconPath = new vscode.ThemeIcon(iconName, new vscode.ThemeColor('charts.yellow'));
        this.description = epic.goal ? truncate(epic.goal, 40) : storyProgress;
        break;
      case 'contexted':
        this.iconPath = new vscode.ThemeIcon(iconName, new vscode.ThemeColor('charts.blue'));
        this.description = epic.goal ? truncate(epic.goal, 40) : storyProgress;
        break;
      case 'cancelled':
        this.iconPath = new vscode.ThemeIcon(iconName, new vscode.ThemeColor('disabledForeground'));
        this.description = '[Cancelled]';
        break;
      case 'deprecated':
        this.iconPath = new vscode.ThemeIcon(iconName, new vscode.ThemeColor('disabledForeground'));
        this.description = '[Deprecated]';
        break;
      case 'backlog':
      default:
        this.iconPath = new vscode.ThemeIcon(iconName);
        this.description = epic.goal ? truncate(epic.goal, 40) : storyProgress;
        break;
    }

    // Tooltip with full details
    const tooltipLines = [title ? `Epic ${epic.id}: ${title}` : `Epic ${epic.id}`];
    tooltipLines.push(`Tasks: ${epic.completedCount}/${epic.totalCount} (${epic.percentage}%)`);
    if (epic.goal) {
      tooltipLines.push(`Goal: ${epic.goal}`);
    }
    tooltipLines.push(`Status: ${epic.bmadStatus}`);
    if (epic.stories.length === 0) {
      tooltipLines.push(`Stories: None yet`);
    } else {
      tooltipLines.push(`Stories: ${doneStories}/${epic.stories.length} done`);
    }
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
      case 'deprecated':
        this.iconPath = new vscode.ThemeIcon(iconName, new vscode.ThemeColor('disabledForeground'));
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

export class BmadTreeProvider implements vscode.TreeDataProvider<TreeElement> {
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
    // Root level - show epics
    if (!element) {
      return this.getRootItems();
    }

    // Project children (epics)
    if (element instanceof ProjectTreeItem) {
      return element.progress.epics.map((epic) => new EpicTreeItem(epic));
    }

    // Epic children (stories)
    if (element instanceof EpicTreeItem) {
      if (element.epic.stories.length === 0) {
        // Show placeholder for empty epics
        return [new InfoTreeItem('No stories yet', 'info', element.epic.bmadStatus === 'backlog' ? 'Backlog' : undefined)];
      }
      return element.epic.stories.map((story) => new StoryTreeItem(story));
    }

    return [];
  }

  /**
   * Get root level items - show epics directly
   */
  private getRootItems(): TreeElement[] {
    if (this.projects.length === 0) {
      return [new InfoTreeItem('No BMAD project detected', 'warning')];
    }

    const items: TreeElement[] = [];

    for (const project of this.projects) {
      const progress = project.getProgress();
      if (progress) {
        // Add epics directly at root level
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
 * Truncate string with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
