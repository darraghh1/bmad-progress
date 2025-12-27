# BMAD Progress

> See your BMAD story progress right in VSCode. Zero config.

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![VSCode](https://img.shields.io/badge/vscode-%5E1.85.0-blue)

## Features

### 🎯 Focus Mode (Default)
See your current story, next task, and session momentum at a glance.

```
BMAD PROGRESS
├── 🎯 FOCUS: Story 2.1 - Add user login
│   ├── ✅ 5 done
│   ├── 📋 3 remaining
│   ├── → Next: Add form validation
│   └── 🔥 4 tasks this session
└── [Toggle to Map Mode]
```

### 🗺️ Map Mode
Full epic/story hierarchy with visual progress bars.

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

### 📊 Status Bar
Quick glance at tasks remaining in the bottom status bar.

```
✅ 3 left · Story 2.1 (+2)
```
- Click to open your current story
- Shows tasks completed since last commit

## Installation

### Option 1: Download from GitHub Releases

1. Download the latest `.vsix` file from [Releases](https://github.com/darraghh1/bmad-progress/releases)
2. Open VSCode
3. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
4. Click the `...` menu (top right) → "Install from VSIX..."
5. Select the downloaded `.vsix` file

### Option 2: Install via Command Line

```bash
# Download the .vsix file, then:
code --install-extension bmad-progress-0.1.0.vsix
```

### Option 3: VSCode Marketplace (Coming Soon)

Once published, you'll be able to search for "BMAD Progress" directly in VSCode.

## Usage

The extension activates automatically when you open a folder containing:
- `.bmad/bmm/` or `_bmad/bmm/` (BMAD v6)
- `_bmad-output/stories/` (BMAD v6 output folder)
- `.bmad-core/` (BMAD v4)
- `docs/stories/` (Quick Flow)

### Commands

| Command | Keybinding | Description |
|---------|------------|-------------|
| `BMAD: Toggle View` | `Ctrl+Shift+B` | Switch between Focus and Map mode |
| `BMAD: Refresh` | - | Force refresh progress data |
| `BMAD: Diagnose` | - | Show detection results and debug info |
| `BMAD: Open Current Story` | - | Open the current story file |

### Settings

```json
{
  "bmad.defaultView": "focus",        // "focus" or "map"
  "bmad.showSessionStreak": true,     // Show tasks completed this session
  "bmad.gitIntegration": true,        // Show tasks since last commit
  "bmad.storiesPath": ""              // Override auto-detected path
}
```

## How It Works

BMAD Progress parses your story markdown files for task checkboxes:
- `- [ ]` = Incomplete task
- `- [x]` = Completed task

It automatically detects:
- **Current Story**: Most recently modified in-progress story
- **Progress**: Completed vs total tasks per story/epic/project
- **Session Stats**: Tasks completed since opening VSCode
- **Git Stats**: Tasks completed since last commit

## Supported BMAD Structures

| Version | Detection | Stories Location |
|---------|-----------|------------------|
| BMAD v6 | `.bmad/bmm/` or `_bmad/bmm/` | `docs/sprint-artifacts/` or `_bmad-output/stories/` |
| BMAD v4 | `.bmad-core/` | `docs/stories/` |
| Quick Flow | `docs/stories/` | `docs/stories/` |

## Multi-Root Workspaces

Full support for multi-root workspaces. Each workspace folder is tracked as a separate project.

## Requirements

- VSCode 1.85.0 or higher
- A BMAD project with story markdown files

## Known Issues

- None yet! Report issues on [GitHub](https://github.com/bmad-method/bmad-progress/issues)

## Release Notes

### 0.1.2

- **Fix**: Support new BMAD v6.0+ folder structure
- Added `_bmad-output/implementation-artifacts/` as stories location
- Added `_bmad-output/project-planning-artifacts/` as epics location
- Added `in-progress` and `done` epic statuses
- Added support for `hs-epic-X` and `hs-X-Y` prefixes (hook system epics/stories)
- Improved sprint-status.yaml parsing for newer BMAD projects

### 0.1.1

- **Fix**: Support both `.bmad/` and `_bmad/` folder naming conventions
- Added `_bmad/bmm/` detection for BMAD v6 projects using underscore prefix
- Updated activation events to trigger on `_bmad` folders
- Improved diagnostics messaging

### 0.1.0

- Initial release
- Focus Mode and Map Mode views
- Status bar with click-to-open
- Auto-detect BMAD v4, v6, Quick Flow
- Multi-root workspace support
- Git integration for "tasks since commit"
- Session streak tracking

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

MIT

---

**Made with ❤️ by the BMAD Method community**
