/**
 * test-db-connection.ts
 * 
 * A temporary script to diagnose issues with the base database connection.
 */

import 'dotenv/config';
import { initializeDatabase } from '../server/repositories/base/BaseRepository.js';

async function testConnection() {
    console.log('[TEST] Attempting to initialize database directly...');
    const initialized = await initializeDatabase();
    if (initialized) {
        console.log('[TEST] Database connection successful.');
    } else {
        console.log('[TEST] Database connection failed.');
    }
}

testConnection().then(() => {
    console.log('[TEST] Script finished.');
    process.exit(0);
}).catch(err => {
    console.error('[TEST] Script failed with error:', err);
    process.exit(1);
});
