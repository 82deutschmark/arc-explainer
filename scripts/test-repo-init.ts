/**
 * test-repo-init.ts
 * 
 * A temporary script to diagnose issues with RepositoryService initialization.
 */

import 'dotenv/config';
import { RepositoryService } from '../server/repositories/RepositoryService.js';

async function test() {
    console.log('[TEST] Attempting to initialize RepositoryService...');
    const repositoryService = new RepositoryService();
    const initialized = await repositoryService.initialize();
    if (initialized) {
        console.log('[TEST] RepositoryService initialized successfully.');
    } else {
        console.log('[TEST] RepositoryService failed to initialize.');
    }
}

test().then(() => {
    console.log('[TEST] Script finished.');
    process.exit(0);
}).catch(err => {
    console.error('[TEST] Script failed with error:', err);
    process.exit(1);
});
