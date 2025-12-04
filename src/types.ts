/**
 * Core types for BMAD Progress extension
 */

/** BMAD project version/structure type */
export type BmadVersion = 'v6' | 'v4' | 'quickflow' | 'unknown';

/** BMAD workflow status from sprint-status.yaml */
export type BmadStoryStatus =
  | 'backlog'
  | 'drafted'
  | 'ready-for-dev'
  | 'in-progress'
  | 'review'
  | 'done';

/** BMAD epic status from sprint-status.yaml */
export type BmadEpicStatus = 'backlog' | 'contexted' | 'cancelled';

/** Task status parsed from markdown checkboxes */
export interface TaskItem {
  text: string;
  completed: boolean;
  line: number;
  subtasks?: TaskItem[];
}

/** Parsed story file data */
export interface StoryData {
  filePath: string;
  fileName: string;
  storyId: string;
  title: string;
  tasks: TaskItem[];
  completedCount: number;
  totalCount: number;
  percentage: number;
  /** Task-based status (from checkboxes) */
  taskStatus: 'completed' | 'in-progress' | 'not-started';
  /** BMAD workflow status (from sprint-status.yaml) */
  bmadStatus: BmadStoryStatus;
  lastModified: Date;
}

/** Epic containing multiple stories */
export interface EpicData {
  id: string;
  name: string;
  /** Epic goal from YAML comments */
  goal?: string;
  folderPath: string;
  stories: StoryData[];
  completedCount: number;
  totalCount: number;
  percentage: number;
  /** BMAD epic status */
  bmadStatus: BmadEpicStatus;
}

/** Parsed sprint-status.yaml data */
export interface SprintStatus {
  project: string;
  storyLocation: string;
  epicStatuses: Map<string, BmadEpicStatus>;
  storyStatuses: Map<string, BmadStoryStatus>;
  epicGoals: Map<string, string>;
}

/** Project-level progress data */
export interface ProjectProgress {
  rootPath: string;
  projectName: string;
  version: BmadVersion;
  epics: EpicData[];
  currentStory: StoryData | null;
  totalTasks: number;
  completedTasks: number;
  percentage: number;
  sessionCompletedTasks: number;
  tasksSinceCommit: number;
}

/** Detection result for BMAD structure */
export interface DetectionResult {
  version: BmadVersion;
  storiesPath: string;
  configPath?: string;
  epicsPath?: string;
}

/** Extension settings from VSCode configuration */
export interface ExtensionSettings {
  defaultView: 'focus' | 'map';
  showSessionStreak: boolean;
  gitIntegration: boolean;
  storiesPath: string;
}

/** View mode for the TreeView */
export type ViewMode = 'focus' | 'map';
