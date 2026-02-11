---
id: "10-01"
name: "Dependency Consolidation"
phase: 10
dependency: null
files_modified:
  - pyproject.toml
  - uv.lock
autonomous: true
must_haves:
  truths:
    - "pyproject.toml contains pyjwt dependency"
    - "pyproject.toml contains passlib[argon2] dependency"
    - "uv.lock file exists and is valid"
  artifacts:
    - uv.lock
---

# Plan 10-01: Dependency Consolidation

## Goal
Establish `pyproject.toml` as the Single Source of Truth (SSOT) for project dependencies.

## Context
Currently, dependencies are split between `pyproject.toml` and `requirements.txt`. `requirements.txt` contains critical security packages (`pyjwt`, `passlib`) used by Docker that are missing from the project config. We need to merge these into `pyproject.toml` and generate a consistent `uv.lock`.

Note: `requirements.txt` will be kept until Plan 10-03 to avoid breaking existing Docker builds before the Dockerfile is updated.

## Tasks

<task>
  <id>DEP-01</id>
  <description>Add missing dependencies to pyproject.toml</description>
  <context>
    Add `pyjwt>=2.8.0` and `passlib[argon2]>=1.7.4` to the dependencies section of `pyproject.toml`.
    Ensure all other requirements from `requirements.txt` are covered.
  </context>
  <file_paths>
    - pyproject.toml
    - requirements.txt
  </file_paths>
</task>

<task>
  <id>DEP-02</id>
  <description>Generate uv.lock</description>
  <context>
    Run `uv sync` to generate the `uv.lock` file.
    This ensures we have a deterministic build definition.
  </context>
  <command>uv sync</command>
  <file_paths>
    - uv.lock
  </file_paths>
</task>
