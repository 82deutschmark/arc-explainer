# 022126-cicd-setup-plan.md

## Scope & Objectives
The user noted a gap in the test suite and CI/CD integrations. However, an analysis of the repository architecture reveals that a robust testing infrastructure (Vitest for backend/frontend, Playwright for e2e, and React Testing Library) is actually already implemented and tracked via `docs/TEST_COVERAGE_STATUS.md`. The true missing piece is the continuous integration (CI) pipeline to run these tests automatically.

The objective of this plan is to introduce a GitHub Actions CI workflow to automatically enforce type checking, build verification, and the existing test suites on commits and pull requests.

## Architecture Context & Reuse
- **Testing Tools:** We will reuse the existing `package.json` scripts (`npm run check`, `npm run test:all`).
- **Database Dependency:** The `drizzle-orm` setup and integration tests require a PostgreSQL database. We will utilize a GitHub Actions PostgreSQL service container to support these tests.
- **Environment Variables:** The CI workflow will inject necessary test environment variables (e.g., `DATABASE_URL`, `SESSION_SECRET`) so the test harness can boot successfully.

## Task List

### 1. Create GitHub Actions CI Workflow
**Target:** `.github/workflows/ci.yml` (New File)
- **Lines:** 1-50 (approx)
- **Details:** 
  - Add `on: [push, pull_request]` triggers for the `main` branch.
  - Define job: `build-and-test`.
  - Set up a PostgreSQL service container (`postgres:15-alpine`) with default credentials.
  - Set up Node.js v20 with `npm` caching.
  - Execute `npm ci` for clean dependency installation.
  - Execute `npm run check` to verify TypeScript types.
  - Execute `npm run test:all` (which runs `test:unit`, `test:frontend`, and `test:e2e`).
  - Provide inline environment variables: `DATABASE_URL=postgres://postgres:postgres@localhost:5432/arc_test`, `NODE_ENV=test`, `SESSION_SECRET=test_secret`.

### 2. Update Documentation
**Target:** `docs/DEVELOPER_GUIDE.md`
- **Location:** End of the file or within the existing Testing section.
- **Details:** Add a brief section detailing the GitHub Actions CI pipeline, explaining that tests are enforced on PRs and rely on the `test:all` script.

### 3. Update Changelog
**Target:** `CHANGELOG.md`
- **Location:** Top of the file (below the main header).
- **Details:** Add a new SemVer entry detailing the addition of the GitHub Actions CI workflow to enforce the existing test infrastructure.

## SRP/DRY Assessment
- **SRP:** The CI workflow file is strictly responsible for execution environments and orchestration. It does not define test logic.
- **DRY:** The workflow relies exactly on the existing NPM scripts (`test:all`, `check`) avoiding duplication of test commands or configuration across the CI environment and local development environments.
