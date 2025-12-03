# 2025-12-02 – Beetree deps plan

## Goal
Stop Beetree solver runs from failing with `ModuleNotFoundError` by ensuring all python requirements are installed automatically and by documenting how the Beetree bridge plugs into the Node stack.

## Context
- User sees Beetree wrapper complaining about missing modules (likely the beetreeARC pinned requirements).
- Current setup only installs `requirements.txt`, so beetreeARC/requirements.txt is skipped unless developers do it manually or build via Dockerfile.
- Need tight integration notes for future debugging.

## Tasks
1. Review Beetree integration (pythonBridge, wrapper, Dockerfile, README/docs) to confirm where dependencies should be loaded.
2. Update the shared `requirements.txt` to include beetreeARC dependencies (reduces duplicate setup steps) and keep Docker build consistent.
3. Document Beetree integration touchpoints + installation instructions (docs/README or DEVELOPER_GUIDE section).
4. Update CHANGELOG with semantic version bump summarizing the fixes and files touched.

## Impacted files (expected)
- `requirements.txt`
- `docs/README.md` or `docs/DEVELOPER_GUIDE.md` (add Beetree setup note)
- `CHANGELOG.md`
