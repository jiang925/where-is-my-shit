---
phase: 10
wave: 1
name: Dependency Consolidation
depends_on: []
files_modified:
  - pyproject.toml
  - requirements.txt
  - uv.lock
---

# Dependency Consolidation Plan

## Tasks

<task>
  <id>DEP-01</id>
  <description>Add missing security dependencies (pyjwt, passlib) to pyproject.toml</description>
  <file_paths>
    <path>pyproject.toml</path>
  </file_paths>
</task>

<task>
  <id>DEP-02</id>
  <description>Remove requirements.txt as it is superseded by pyproject.toml</description>
  <file_paths>
    <path>requirements.txt</path>
  </file_paths>
</task>

<task>
  <id>DEP-03</id>
  <description>Generate uv.lock using `uv lock` to ensure dependencies are resolved</description>
  <file_paths>
    <path>uv.lock</path>
  </file_paths>
</task>

## Verification

- [ ] `uv sync` runs successfully
- [ ] `pyproject.toml` contains `pyjwt` and `passlib`
- [ ] `requirements.txt` is removed
