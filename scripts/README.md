# Testing Scripts

Practical E2E testing tools for production verification.

## Quick Health Check
```bash
node scripts/health-check.js
node scripts/health-check.js https://your-app.railway.app
```
Fast check if server and database are responsive.

## Full Production Test
```bash
node scripts/test-production.js
node scripts/test-production.js https://your-app.railway.app
```
Comprehensive test of all major endpoints:
- Health check
- Puzzle listing
- Puzzle details
- Explanation generation (if needed)
- Batch sessions
- Repository connectivity

## Migration Verification
```bash
node scripts/verify-migration.js
```
Verifies the repository service migration is working correctly.

## Usage Tips
- Run health check first to verify basic connectivity
- Use production test for comprehensive validation after deployments
- Migration verification is specific to the service layer refactor

All scripts exit with code 0 on success, 1 on failure for CI/CD integration.
