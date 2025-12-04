/**
 * BMAD Progress Extension
 * See your BMAD story progress right in VSCode. Zero config.
 */

import * as vscode from 'vscode';
import { BmadProject } from './bmadProject';
import { BmadTreeProvider } from './treeProvider';
import { BmadStatusBar } from './statusBar';
import { ExtensionSettings, StoryData, ViewMode } from './types';
import { getVersionDisplayName } from './parser/detector';

let treeProvider: BmadTreeProvider;
let statusBar: BmadStatusBar;
let projects: BmadProject[] = [];
let isFirstActivation = true;

/**
 * Extension activation
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('BMAD Progress: Activating...');

  // Get settings
  const settings = getSettings();

  // Initialize UI components
  treeProvider = new BmadTreeProvider();
  statusBar = new BmadStatusBar();

  // Set initial view mode from settings
  treeProvider.setMode(settings.defaultView);

  // Register tree view
  const treeView = vscode.window.createTreeView('bmadProgressView', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);
  context.subscriptions.push(treeProvider);
  context.subscriptions.push(statusBar);

  // Register commands
  registerCommands(context);

  // Initialize projects for all workspace folders
  await initializeProjects(settings);

  // Show welcome message on first activation
  if (isFirstActivation && projects.length > 0) {
    isFirstActivation = false;
    showWelcomeMessage();
  }

  // Watch for workspace folder changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      await initializeProjects(settings);
    })
  );

  // Watch for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('bmad')) {
        const newSettings = getSettings();
        treeProvider.setMode(newSettings.defaultView);
      }
    })
  );

  console.log('BMAD Progress: Activated successfully');
}

/**
 * Initialize projects for all workspace folders
 */
async function initializeProjects(settings: ExtensionSettings): Promise<void> {
  // Dispose existing projects
  projects.forEach((p) => p.dispose());
  projects = [];

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    treeProvider.setProjects([]);
    statusBar.setProjects([]);
    return;
  }

  // Initialize each workspace folder
  for (const folder of workspaceFolders) {
    const project = new BmadProject(folder, settings);
    const success = await project.initialize();

    if (success) {
      projects.push(project);
    }
  }

  // Update UI components
  treeProvider.setProjects(projects);
  statusBar.setProjects(projects);
}

/**
 * Register extension commands
 */
function registerCommands(context: vscode.ExtensionContext): void {
  // Toggle View command
  context.subscriptions.push(
    vscode.commands.registerCommand('bmad.toggleView', () => {
      const newMode = treeProvider.toggleMode();
      vscode.window.showInformationMessage(
        `BMAD: Switched to ${newMode === 'focus' ? 'Focus' : 'Map'} Mode`
      );
    })
  );

  // Refresh command
  context.subscriptions.push(
    vscode.commands.registerCommand('bmad.refresh', async () => {
      for (const project of projects) {
        await project.refresh();
      }
      treeProvider.refresh();
      vscode.window.showInformationMessage('BMAD: Progress refreshed');
    })
  );

  // Diagnose command
  context.subscriptions.push(
    vscode.commands.registerCommand('bmad.diagnose', () => {
      showDiagnostics();
    })
  );

  // Open current story command
  context.subscriptions.push(
    vscode.commands.registerCommand('bmad.openCurrentStory', () => {
      const story = statusBar.getCurrentStory();
      if (story) {
        openStoryFile(story);
      } else {
        vscode.window.showInformationMessage('BMAD: No current story');
      }
    })
  );

  // Open story command (from tree view)
  context.subscriptions.push(
    vscode.commands.registerCommand('bmad.openStory', (story: StoryData) => {
      openStoryFile(story);
    })
  );

  // Open story at line command (from focus mode)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'bmad.openStoryAtLine',
      (story: StoryData, line: number) => {
        openStoryFile(story, line);
      }
    )
  );
}

/**
 * Open a story file, optionally at a specific line
 */
async function openStoryFile(story: StoryData, line?: number): Promise<void> {
  const uri = vscode.Uri.file(story.filePath);
  const doc = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(doc);

  if (line && line > 0) {
    const position = new vscode.Position(line - 1, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(
      new vscode.Range(position, position),
      vscode.TextEditorRevealType.InCenter
    );
  }
}

/**
 * Show welcome message on first activation
 */
function showWelcomeMessage(): void {
  const projectCount = projects.length;
  const totalTasks = projects.reduce(
    (sum, p) => sum + (p.getProgress()?.totalTasks || 0),
    0
  );

  vscode.window.showInformationMessage(
    `🎯 BMAD Progress activated! Tracking ${totalTasks} tasks across ${projectCount} project(s).`,
    'View Progress'
  ).then((action) => {
    if (action === 'View Progress') {
      vscode.commands.executeCommand('bmadProgressView.focus');
    }
  });
}

/**
 * Show diagnostic information
 */
function showDiagnostics(): void {
  const lines: string[] = ['# BMAD Progress Diagnostics', ''];

  if (projects.length === 0) {
    lines.push('No BMAD projects detected.', '');
    lines.push('## Detection looks for:');
    lines.push('- `.bmad/bmm/` → BMAD v6');
    lines.push('- `.bmad-core/` → BMAD v4');
    lines.push('- `docs/stories/` → Quick Flow');
  } else {
    lines.push(`Found ${projects.length} project(s):`, '');
    for (const project of projects) {
      lines.push(project.getDiagnostics());
      lines.push('');
    }
  }

  // Show in output channel
  const channel = vscode.window.createOutputChannel('BMAD Diagnostics');
  channel.clear();
  channel.appendLine(lines.join('\n'));
  channel.show();
}

/**
 * Get extension settings
 */
function getSettings(): ExtensionSettings {
  const config = vscode.workspace.getConfiguration('bmad');
  return {
    defaultView: config.get<ViewMode>('defaultView', 'focus'),
    showSessionStreak: config.get<boolean>('showSessionStreak', true),
    gitIntegration: config.get<boolean>('gitIntegration', true),
    storiesPath: config.get<string>('storiesPath', ''),
  };
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
  projects.forEach((p) => p.dispose());
  console.log('BMAD Progress: Deactivated');
}
