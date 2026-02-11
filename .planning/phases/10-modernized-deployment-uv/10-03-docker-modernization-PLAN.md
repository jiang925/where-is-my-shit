---
id: "10-03"
name: "Docker Modernization"
phase: 10
dependency: "10-02"
files_modified:
  - Dockerfile
  - requirements.txt
autonomous: true
must_haves:
  truths:
    - "Dockerfile uses uv for dependency installation"
    - "requirements.txt is removed"
    - "Docker build succeeds"
  artifacts:
    - Dockerfile
---

# Plan 10-03: Docker Modernization

## Goal
Update the `Dockerfile` to use `uv` for faster, deterministic builds, aligning the container environment with the local `uv` environment.

## Context
We removed `requirements.txt` usage in Plan 10-01 (logically), so the current `Dockerfile` (which relies on `pip install -r requirements.txt`) needs to be updated. Once updated, we can safely delete the legacy `requirements.txt`.

## Tasks

<task>
  <id>DOC-01</id>
  <description>Update Dockerfile to use uv</description>
  <context>
    Refactor `Dockerfile` to:
    1. Install `uv` (copy from `ghcr.io/astral-sh/uv` or install via script).
    2. Copy `pyproject.toml` and `uv.lock`.
    3. Run `uv sync --frozen --no-install-project` to install dependencies into system or venv.
    4. Ensure the run command uses the installed environment.
  </context>
  <file_paths>
    - Dockerfile
  </file_paths>
</task>

<task>
  <id>DOC-02</id>
  <description>Remove legacy requirements.txt</description>
  <context>
    Now that the Dockerfile is updated to use `pyproject.toml` and `uv.lock`, we can safely delete the legacy file.
  </context>
  <command>rm requirements.txt</command>
  <file_paths>
    - requirements.txt
  </file_paths>
</task>

<task>
  <id>DOC-03</id>
  <description>Verify Docker build</description>
  <context>
    Build the container to ensure `uv` is working correctly and all dependencies are available.
  </context>
  <command>docker build -t wims-backend .</command>
  <file_paths>
    - Dockerfile
  </file_paths>
</task>
