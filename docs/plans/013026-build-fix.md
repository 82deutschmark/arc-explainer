---
Title: 013026-build-fix
---

# 013026-build-fix

## Goal
Restore Railway Docker build by ensuring crontab file is copied from the correct path during image build.

## Tasks
- [ ] Dockerfile: update crontab COPY source to match repository location (`scripts/crontab`) so build context resolves file.
- [ ] CHANGELOG.md: add SemVer entry documenting build fix, rationale, and files touched.

## Notes
- Build failure message: `failed to calculate checksum ... "/crontab": not found` indicates missing source path in COPY step.
- No runtime behavior change expected beyond successful image build.
