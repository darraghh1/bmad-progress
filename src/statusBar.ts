/**
 * Status Bar Management
 * Shows tasks remaining and current story in the status bar
 */

import * as vscode from 'vscode';
import { BmadProject } from './bmadProject';
import { ProjectProgress, StoryData } from './types';

export class BmadStatusBar implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private projects: BmadProject[] = [];
  private disposables: vscode.Disposable[] = [];

  constructor() {
    // Create status bar item on the right side
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'bmad.openCurrentStory';
    this.statusBarItem.tooltip = 'Click to open current story';
  }

  /**
   * Set the projects to track
   */
  setProjects(projects: BmadProject[]): void {
    // Dispose old listeners
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];

    this.projects = projects;

    // Listen to project changes
    for (const project of projects) {
      const disposable = project.onDidChange(() => {
        this.update();
      });
      this.disposables.push(disposable);
    }

    this.update();
  }

  /**
   * Update the status bar display
   */
  private update(): void {
    if (this.projects.length === 0) {
      this.statusBarItem.hide();
      return;
    }

    // Get combined progress from all projects
    const progress = this.getCombinedProgress();

    if (!progress) {
      this.statusBarItem.text = '$(info) No BMAD project';
      this.statusBarItem.tooltip = 'No BMAD project detected';
      this.statusBarItem.show();
      return;
    }

    // Format: "✅ 3 left · Story 2.1"
    const remaining = progress.totalTasks - progress.completedTasks;
    const storyId = progress.currentStory?.storyId || 'None';

    let text = `$(check) ${remaining} left`;

    if (progress.currentStory) {
      text += ` · Story ${storyId}`;
    }

    // Add git delta if available
    if (progress.tasksSinceCommit > 0) {
      text += ` (+${progress.tasksSinceCommit})`;
    }

    this.statusBarItem.text = text;
    this.statusBarItem.tooltip = this.createTooltip(progress);
    this.statusBarItem.show();
  }

  /**
   * Create detailed tooltip
   */
  private createTooltip(progress: ProjectProgress): string {
    const lines: string[] = [
      `BMAD Progress: ${progress.projectName}`,
      `─────────────────────`,
      `Total: ${progress.completedTasks}/${progress.totalTasks} tasks (${progress.percentage}%)`,
    ];

    if (progress.currentStory) {
      lines.push(
        `Current: Story ${progress.currentStory.storyId}`,
        `"${progress.currentStory.title}"`
      );
    }

    if (progress.sessionCompletedTasks > 0) {
      lines.push(`Session: ${progress.sessionCompletedTasks} tasks completed`);
    }

    if (progress.tasksSinceCommit > 0) {
      lines.push(`Since commit: ${progress.tasksSinceCommit} tasks`);
    }

    lines.push('', 'Click to open current story');

    return lines.join('\n');
  }

  /**
   * Get combined progress from all projects
   * For multi-root, aggregates from active/first project
   */
  private getCombinedProgress(): ProjectProgress | null {
    // For now, use the first project with progress
    for (const project of this.projects) {
      const progress = project.getProgress();
      if (progress) {
        return progress;
      }
    }
    return null;
  }

  /**
   * Get current story from tracked projects
   */
  getCurrentStory(): StoryData | null {
    for (const project of this.projects) {
      const progress = project.getProgress();
      if (progress?.currentStory) {
        return progress.currentStory;
      }
    }
    return null;
  }

  /**
   * Show the status bar
   */
  show(): void {
    this.statusBarItem.show();
  }

  /**
   * Hide the status bar
   */
  hide(): void {
    this.statusBarItem.hide();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.statusBarItem.dispose();
  }
}
