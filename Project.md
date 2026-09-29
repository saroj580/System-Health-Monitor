# System Monitor & Task Automator — Project Specification

---

System Monitor & Task Automator

The App: A customized dashboard that tracks your computer's health and lets you run custom cleanup scripts with one click.

React/TS: A slick dashboard featuring live updating charts (CPU/RAM usage) and a grid of "Action" buttons.

FastAPI & Python: Uses the Python psutil library to read your computer's hardware metrics and stream them to the UI. It also executes local automation scripts (like "Clean Temp Files" or "Backup Documents folder to Zip").

## 1. System Architecture Overview

The application follows an **offline master-worker desktop architecture**:

*   **Host Process (Electron):** Manages the native desktop window and the lifecycle of the Python background daemon. On startup, it spawns `backend.exe`; on termination (`before-quit`), it signals the backend process to terminate cleanly, preventing orphan processes.
*   **Presentation Layer (React + TypeScript):** Single-page application designed with an MVC/component-service structure. It displays real-time hardware telemetry and issues imperative command triggers to the backend.
*   **Application & Automation Server (FastAPI):** Exposes a local REST API and WebSocket streaming channel on `127.0.0.1`. It operates under a strict Model-View-Controller (MVC) separation.
*   **System Diagnostics & Automation Engine (Python `psutil` + OS APIs):** Directly interacts with the Windows OS subsystem to read hardware telemetry, manage processes, and execute filesystem automation routines.
*   **Persistence & Log Layer (SQLite with JSON1):** Stores task automation audit logs, historical system snapshots, and user preferences locally without requiring external services.

---

## 2. Directory Structure

```text
system-monitor-automator/
│
├── frontend/                              # React + TypeScript Client
│   ├── public/                            # Static assets and icons
│   ├── src/
│   │   ├── assets/                        # Stylesheets, icons, fonts
│   │   ├── models/                        # TypeScript interfaces & types (Model)
│   │   │   ├── systemStats.ts
│   │   │   └── taskResult.ts
│   │   ├── services/                      # API client, WebSocket & polling handlers
│   │   │   ├── apiService.ts
│   │   │   └── socketService.ts
│   │   ├── controllers/                   # Custom hooks managing state & events (Controller)
│   │   │   ├── useSystemStats.ts
│   │   │   └── useTaskRunner.ts
│   │   ├── views/                         # UI Presentation Components (View)
│   │   │   ├── components/
│   │   │   │   ├── StatGauge.tsx
│   │   │   │   ├── TaskCard.tsx
│   │   │   │   └── ActivityLogTable.tsx
│   │   │   └── DashboardView.tsx
│   │   ├── App.tsx                        # Root layout
│   │   └── main.tsx                       # React DOM entry
│   ├── electron/                          # Desktop Wrapper Entry
│   │   └── main.js                        # Window management & process lifecycle
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── backend/                               # FastAPI Server (MVC Architecture)
│   ├── app/
│   │   ├── models/                        # Data Schemas & DB Models (Model)
│   │   │   ├── schemas.py                 # Pydantic validation schemas
│   │   │   └── db_models.py               # SQLite tables & query models
│   │   ├── controllers/                   # Business Logic & Automators (Controller)
│   │   │   ├── stats_controller.py        # Hardware telemetry collector
│   │   │   └── task_controller.py         # File & OS automation workflows
│   │   ├── views/                         # Presentation / API Serialization (View)
│   │   │   └── routes.py                  # HTTP & WebSocket route declarations
│   │   ├── core/                          # Cross-cutting concerns
│   │   │   ├── config.py                  # App settings & paths
│   │   │   └── database.py                # SQLite connection & schema initializer
│   │   └── main.py                        # FastAPI application instance
│   ├── requirements.txt                   # Frozen Python dependencies
│   └── run.py                             # Uvicorn entry point for PyInstaller
│
├── build.ps1                              # Automated compilation orchestrator (Planned)
├── setup.nsi                              # NSIS installer definition (Planned)
└── PROJECT.md                             # Specification & Architecture Document