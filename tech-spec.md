# Tech-Spec: BMAD Progress VSCode Extension

**Created:** 2025-12-03
**Status:** Implementation Complete (Pending Manual Testing & Marketplace)
**Author:** Barry (Quick Flow Solo Dev) + Darragh
**Output Location:** `apps/bmad-vscode-dashboard/`

---

## Overview

### Problem Statement

Developers using the BMAD Method lack visibility into their project progress while coding. Currently, they must:
- Manually open story files and count checkboxes
- Run terminal commands to see progress dashboards
- Context-switch away from their IDE to track status

This friction breaks flow and reduces the motivational feedback loop that drives productivity.

### Solution

A **VSCode extension** that provides real-time BMAD project progress directly in the IDE:
- **Focus Mode** (default): Shows current story + next task + session momentum
- **TreeView sidebar**: Hierarchical view of epics/stories with visual progress
- **Status bar**: Quick glance at tasks remaining
- **Zero config**: Auto-detects BMAD project structure (v4, v6, Quick Flow)

### The Pitch

> *"See your BMAD story progress right in VSCode. Zero config."*

### Scope

**In Scope (MVP):**
- TreeView sidebar with epic/story hierarchy
- Focus Mode as default view (current story + next task)
- Status bar with tasks remaining
- Auto-detect BMAD v4, v6, Quick Flow structures
- Multi-root workspace support
- Git-aware messaging ("X tasks since last commit")
- Visual progress characters (`▓▓▓░░`)
- Click-to-open story files
- Auto-refresh via FileSystemWatcher
- Welcome message on activation
- Diagnostic command for troubleshooting

**Out of Scope (MVP):**
- Velocity tracking over time
- Planning phase tracking (Brief/PRD/Architecture)
- Export to markdown/image
- Webview dashboard
- Team/multi-user features
- Milestone manual marking
- Sound effects

---

## Context for Development

### Tech Stack

| Component | Technology |
|-----------|------------|
| Language | TypeScript (strict mode) |
| Platform | VSCode Extension API |
| UI | TreeDataProvider (native TreeView) |
| Bundler | esbuild |
| Testing | Mocha + VSCode test runner |
| Dependencies | js-yaml (max 2 runtime deps) |

### VSCode APIs Used

| API | Purpose |
|-----|---------|
| `TreeDataProvider` | Sidebar tree view |
| `StatusBarItem` | Bottom status bar |
| `FileSystemWatcher` | Auto-refresh on file changes |
| `workspace.workspaceFolders` | Multi-root support |
| `commands.registerCommand` | Command palette commands |
| `window.showInformationMessage` | Welcome/diagnostic messages |

### Codebase Patterns

```
apps/bmad-vscode-dashboard/
├── src/
│   ├── extension.ts           # Activation, command registration
│   ├── bmadProject.ts         # Per-project state management
│   ├── treeProvider.ts        # TreeDataProvider implementation
│   ├── statusBar.ts           # Status bar management
│   ├── parser/
│   │   ├── storyParser.ts     # Parse story files for tasks
│   │   ├── detector.ts        # Detect BMAD version/structure
│   │   └── gitIntegration.ts  # Git commit tracking
│   ├── views/
│   │   ├── focusMode.ts       # Focus mode tree items
│   │   └── mapMode.ts         # Full tree view items
│   └── test/
│       ├── parser.test.ts     # Parser unit tests
│       └── detector.test.ts   # Detection unit tests
├── package.json               # Extension manifest
├── tsconfig.json
├── esbuild.config.js
├── .vscodeignore
└── README.md
```

### Files to Reference

| Reference | Purpose |
|-----------|---------|
| [ibadmore/bmad-progress-dashboard](https://github.com/ibadmore/bmad-progress-dashboard) | Original terminal tool - parsing logic inspiration |
| `.bmad/bmm/` | BMAD v6 structure |
| `.bmad-core/` | BMAD v4 structure |
| `docs/stories/*.md` | Story file location |

---

## Architecture Decisions

### ADR-001: UI Rendering Approach

**Decision:** TreeView API (native sidebar)

**Rationale:** Ship fast, native UX, familiar to VSCode users. Webview can be added later for rich dashboard if needed.

### ADR-002: State Management

**Decision:** In-memory cache + FileSystemWatcher with 500ms debounce

**Rationale:** Performant for large projects, no persistence complexity, fresh state on each activation.

### ADR-003: BMAD Version Detection

**Decision:** Auto-detect with settings override

**Detection Order:**
1. `.bmad/bmm/` → v6
2. `.bmad-core/` → v4
3. `docs/stories/` → Standalone/Quick Flow
4. Settings override if specified

### ADR-004: Multi-Root Workspace Support

**Decision:** Support from day one

**Implementation:** Each workspace folder gets its own `BmadProject` instance. TreeView shows projects as top-level nodes.

### ADR-005: Extension Activation

**Decision:** Lazy activation on folder detection

**Activation Events:**
```json
"activationEvents": [
  "workspaceContains:**/.bmad/**",
  "workspaceContains:**/.bmad-core/**",
  "workspaceContains:**/docs/stories/**"
]
```

---

## Implementation Plan

### Tasks

#### Phase 1: Project Setup
- [x] Task 1.1: Initialize VSCode extension with TypeScript template
- [x] Task 1.2: Configure esbuild bundling
- [x] Task 1.3: Set up test infrastructure (Mocha)
- [x] Task 1.4: Create package.json with activation events and contributions

#### Phase 2: Core Parsing
- [x] Task 2.1: Implement BMAD structure detector (`detector.ts`)
- [x] Task 2.2: Implement story file parser (`storyParser.ts`)
- [x] Task 2.3: Write unit tests for parser with edge cases
- [x] Task 2.4: Implement git integration for "tasks since commit"

#### Phase 3: Data Model
- [x] Task 3.1: Create `BmadProject` class for per-project state
- [x] Task 3.2: Implement file watching with 500ms debounce
- [x] Task 3.3: Create progress calculation logic
- [x] Task 3.4: Handle multi-root workspaces

#### Phase 4: UI - TreeView
- [x] Task 4.1: Implement `TreeDataProvider` with epic/story/task hierarchy
- [x] Task 4.2: Add visual progress characters (`▓▓▓░░`)
- [x] Task 4.3: Implement Focus Mode (current story + next task only)
- [x] Task 4.4: Implement Map Mode (full hierarchy toggle)
- [x] Task 4.5: Add click-to-open functionality

#### Phase 5: UI - Status Bar
- [x] Task 5.1: Create status bar item with tasks remaining
- [x] Task 5.2: Add click action to open current story
- [x] Task 5.3: Show git-aware message ("X since commit")

#### Phase 6: Commands & UX
- [x] Task 6.1: Register `BMAD: Toggle View` command (Focus/Map)
- [x] Task 6.2: Register `BMAD: Refresh` command
- [x] Task 6.3: Register `BMAD: Diagnose` command
- [x] Task 6.4: Implement welcome message on first activation
- [x] Task 6.5: Handle "no project found" gracefully

#### Phase 7: Polish & Ship
- [x] Task 7.1: Create README with screenshots
- [ ] Task 7.2: Create 3 marketplace screenshots
- [ ] Task 7.3: Record GIF demo
- [ ] Task 7.4: Write marketplace description (<50 words)
- [ ] Task 7.5: Test on DigitalMastery project (dogfood)
- [ ] Task 7.6: Publish to VSCode Marketplace

### Acceptance Criteria

- [x] AC1: Extension activates automatically when opening a BMAD project
- [x] AC2: TreeView shows epic/story hierarchy with accurate task counts
- [x] AC3: Focus Mode shows only current story and next task by default
- [x] AC4: Status bar displays "X left · Story Y.Z" format
- [x] AC5: Clicking status bar opens current story file
- [x] AC6: Progress updates within 1 second of saving a story file
- [x] AC7: Works with BMAD v4, v6, and Quick Flow structures
- [x] AC8: Works with multi-root workspaces (multiple BMAD projects)
- [x] AC9: Shows welcome message on first activation
- [x] AC10: `BMAD: Diagnose` shows detection results
- [x] AC11: Gracefully handles malformed story files (no crash)
- [ ] AC12: Extension startup adds <50ms to VSCode load time (needs manual testing)

---

## Additional Context

### Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| `js-yaml` | ^4.1.0 | Parse BMAD config YAML files |
| `@types/vscode` | ^1.85.0 | VSCode API types |
| `esbuild` | ^0.19.0 | Bundling (dev dep) |
| `mocha` | ^10.0.0 | Testing (dev dep) |

**Constraint:** Maximum 2 runtime dependencies to minimize bundle size.

### Testing Strategy

| Test Type | Coverage | Tool |
|-----------|----------|------|
| Unit tests | Parser, detector, progress calculation | Mocha |
| Integration tests | TreeProvider, StatusBar | VSCode test runner |
| Manual testing | Full extension flow | Dogfooding on DigitalMastery |
| Edge case corpus | 20+ weird story files | Test fixtures |

**Required test cases:**
- Story with nested checkboxes
- Story with links in checkbox text `- [ ] See [docs](url)`
- Story with YAML frontmatter
- Empty story file
- Story with only completed tasks
- Story with no checkboxes
- Malformed markdown

### Risk Mitigations

| Risk | Mitigation |
|------|------------|
| Scope creep | MVP scope locked, 1-week deadline |
| Not dogfooding | Install on DigitalMastery immediately |
| Parser edge cases | Unit tests, test corpus, graceful errors |
| Silent failure | Welcome message, diagnostic command |
| VSCode API changes | Use stable APIs only, minimal surface area |
| Bad first impression | Polished marketplace listing before launch |

### Success Criteria

| Metric | Target |
|--------|--------|
| Daily personal use | Darragh uses it every day |
| Marketplace rating | 4.5+ stars |
| Performance | Zero "sluggish" complaints |
| Adoption | 100+ downloads in first month |
| Maintenance | New contributor understands code in 30 min |

### Ship Commitment

**Deadline:** 1 week from development start

**MVP Definition:**
- Focus Mode + TreeView + Status Bar
- Auto-detect BMAD structure
- Multi-root workspace support
- Git-aware messaging
- Welcome message + Diagnose command

**Launch Checklist:**
- [ ] Passes all unit tests
- [ ] Tested on DigitalMastery (dogfood)
- [ ] README with installation instructions
- [ ] 3 screenshots for marketplace
- [ ] 1 GIF demo
- [ ] <50 word marketplace description
- [ ] Published to VSCode Marketplace

---

## UI Specifications

### Status Bar

```
┌─────────────────────────────────────────────────────────────┐
│  [other items]              ✅ 3 left · Story 2.1  [BMAD]  │
└─────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Click → Opens current story file
- Updates on file save
- Shows "No BMAD project" if not detected

### TreeView - Focus Mode (Default)

```
BMAD PROGRESS
├── 🎯 FOCUS: Story 2.1 - Add user login
│   ├── ✅ 5 done
│   ├── 📋 3 remaining
│   ├── → Next: Add form validation        ← clickable
│   └── 🔥 4 tasks this session
└── [Toggle to Map Mode]
```

### TreeView - Map Mode

```
BMAD PROGRESS
├── 📁 DigitalMastery (68%)
│   ├── ▼ Epic 1: Authentication ▓▓▓▓▓▓▓▓░░ 80%
│   │   ├── ✅ Story 1.1: Login flow
│   │   ├── ✅ Story 1.2: Registration
│   │   └── 🔄 Story 1.3: Password reset (60%)
│   └── ▼ Epic 2: Dashboard ▓▓▓░░░░░░░ 30%
│       ├── 🔄 Story 2.1: Metrics display (45%)
│       └── ⏳ Story 2.2: Charts
└── [Toggle to Focus Mode]
```

### Progress Characters

| Percentage | Visual |
|------------|--------|
| 0% | `░░░░░░░░░░` |
| 30% | `▓▓▓░░░░░░░` |
| 50% | `▓▓▓▓▓░░░░░` |
| 80% | `▓▓▓▓▓▓▓▓░░` |
| 100% | `▓▓▓▓▓▓▓▓▓▓` |

---

## Commands

| Command | Keybinding | Description |
|---------|------------|-------------|
| `BMAD: Toggle View` | `Cmd+Shift+B` | Switch between Focus and Map mode |
| `BMAD: Refresh` | - | Force refresh progress data |
| `BMAD: Diagnose` | - | Show detection results and debug info |
| `BMAD: Open Current Story` | - | Open the current story file |

---

## Settings

```json
{
  "bmad.defaultView": {
    "type": "string",
    "enum": ["focus", "map"],
    "default": "focus",
    "description": "Default view mode"
  },
  "bmad.showSessionStreak": {
    "type": "boolean",
    "default": true,
    "description": "Show tasks completed this session"
  },
  "bmad.gitIntegration": {
    "type": "boolean",
    "default": true,
    "description": "Show tasks since last commit"
  },
  "bmad.storiesPath": {
    "type": "string",
    "default": "",
    "description": "Override auto-detected stories path"
  }
}
```

---

## Future Enhancements (P1+)

| Feature | Priority | Notes |
|---------|----------|-------|
| 🔥 Streak counter ("5-day streak") | P1 | Motivation mechanic |
| Generic markdown mode | P1 | Work with any `- [ ]` project |
| Completion sound | P1 | Optional dopamine hit |
| Stale story detection | P2 | "Not touched in 5 days" |
| Export to markdown | P2 | For standups/reporting |
| Webview dashboard | P3 | Rich visual dashboard |
| Velocity tracking | P3 | Requires persistence |
| Planning phase tracking | P3 | Brief/PRD/Architecture % |

---

## References

- [VSCode Extension API](https://code.visualstudio.com/api)
- [TreeView API Guide](https://code.visualstudio.com/api/extension-guides/tree-view)
- [ibadmore/bmad-progress-dashboard](https://github.com/ibadmore/bmad-progress-dashboard) - Original terminal tool
- [BMAD Method Documentation](https://bmad.dev)

---

**Tech-Spec Complete!**

Ready for implementation with `*quick-dev` workflow.
