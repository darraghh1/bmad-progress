# 🎯 BMAD Progress - See Your Story Progress Right in VSCode

Hey BMAD community! 👋

I built a thing and wanted to share it with you all.

---

## The Problem

You know that feeling when you're deep in a story, checking off tasks, and you want to know "how close am I to done?" — but you have to:

1. Open the story file
2. Scroll through looking for checkboxes
3. Mentally count `- [x]` vs `- [ ]`
4. Context switch back to coding

It breaks flow. It's annoying. So I fixed it.

---

## The Solution: BMAD Progress

A VSCode extension that shows your BMAD story progress **right in the sidebar**. Zero config — it auto-detects your project structure.

### Focus Mode (Default)

See exactly what matters: your current story, next task, and session momentum.

```
BMAD PROGRESS
├── 🎯 FOCUS: Story 2.1 - Add user login
│   ├── ✅ 5 done
│   ├── 📋 3 remaining
│   ├── → Next: Add form validation
│   └── 🔥 4 tasks this session
└── [Toggle to Map Mode]
```

### Map Mode

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

### Status Bar

Quick glance at tasks remaining — click to open your current story.

```
✅ 3 left · Story 2.1 (+2 since commit)
```

---

## Features

- **Auto-detects** BMAD v4, v6, and Quick Flow projects
- **Multi-root workspace** support (multiple BMAD projects)
- **Git integration** — shows tasks completed since last commit
- **Session streak** — see your momentum this session
- **Click to open** — click any story to jump to the file
- **Keyboard shortcut** — `Ctrl+Shift+B` to toggle views

---

## How to Get It

### Download from GitHub

1. Go to the [Releases page](https://github.com/darraghh1/bmad-progress/releases)
2. Download `bmad-progress-0.1.0.vsix`
3. In VSCode: Extensions → `...` menu → "Install from VSIX..."
4. Select the downloaded file

### Or via command line

```bash
code --install-extension bmad-progress-0.1.0.vsix
```

---

## Links

- **GitHub Repo**: https://github.com/darraghh1/bmad-progress
- **Download v0.1.0**: https://github.com/darraghh1/bmad-progress/releases/tag/v0.1.0

---

## What's Next?

This is v0.1.0 — the MVP. Things I'm considering for future versions:

- 🔥 Streak counter ("5-day streak!")
- 🔊 Optional completion sounds (dopamine hits)
- 📊 Velocity tracking over time
- 🌐 VSCode Marketplace publishing

---

## Feedback Welcome!

Try it out and let me know what you think! Found a bug? Have a feature idea? Drop a comment or open an issue on GitHub.

Built this because I wanted it myself — hope it helps you too! 🚀

---

*Built with the BMAD Method, for the BMAD Method* ✨
