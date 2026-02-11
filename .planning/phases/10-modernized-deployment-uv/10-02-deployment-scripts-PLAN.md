---
id: "10-02"
name: "Deployment Scripts"
phase: 10
dependency: "10-01"
files_modified:
  - setup.sh
  - start.sh
autonomous: true
must_haves:
  truths:
    - "setup.sh is executable"
    - "start.sh is executable"
    - "setup.sh installs uv if missing"
    - "setup.sh pre-downloads embedding models"
  artifacts:
    - setup.sh
    - start.sh
---

# Plan 10-02: Deployment Scripts

## Goal
Create standardized `setup.sh` and `start.sh` scripts that utilize `uv` for a consistent "one-command" developer experience.

## Context
Users currently need to know how to install dependencies manually or use Docker. We want to simplify this to:
1. `setup.sh`: Installs tools (uv), env, and downloads models.
2. `start.sh`: Runs the app.

## Tasks

<task>
  <id>SCR-01</id>
  <description>Create setup.sh</description>
  <context>
    Create a script that:
    1. Checks for `uv` and installs it if missing (using `curl -LsSf https://astral.sh/uv/install.sh | sh`).
    2. Runs `uv sync` to install dependencies.
    3. Pre-downloads the embedding model (`BAAI/bge-small-en-v1.5`) using `fastembed` to prevent first-request timeouts.
  </context>
  <file_paths>
    - setup.sh
  </file_paths>
</task>

<task>
  <id>SCR-02</id>
  <description>Create start.sh</description>
  <context>
    Create a script that runs the application using `uv run`.
    Command: `uv run uvicorn src.app.main:app --host 0.0.0.0 --port 8000 --reload`
  </context>
  <file_paths>
    - start.sh
  </file_paths>
</task>

<task>
  <id>SCR-03</id>
  <description>Set script permissions</description>
  <context>
    Make both scripts executable.
  </context>
  <command>chmod +x setup.sh start.sh</command>
  <file_paths>
    - setup.sh
    - start.sh
  </file_paths>
</task>
