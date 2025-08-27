/**
 * Quick Health Check Script
 * Verifies core system components are working
 * 
 * Usage: node scripts/health-check.js [url]
 * 
 * @author Cascade
 */

import fetch from 'node-fetch';

const BASE_URL = process.argv[2] || 'http://localhost:5000';

async function quickHealthCheck() {
  console.log(`🏥 Health Check for: ${BASE_URL}`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/health`, { timeout: 5000 });
    const data = await response.json();
    
    console.log(`✅ Server: Online (${response.status})`);
    console.log(`✅ Database: ${data.database ? 'Connected' : '❌ Disconnected'}`);
    console.log(`✅ Environment: ${data.environment || 'Unknown'}`);
    console.log(`✅ Uptime: ${data.uptime || 'N/A'}`);
    
    if (data.database) {
      console.log(`🎉 System is healthy!`);
      process.exit(0);
    } else {
      console.log(`⚠️ Database connection issue`);
      process.exit(1);
    }
  } catch (error) {
    console.log(`❌ Health check failed: ${error.message}`);
    process.exit(1);
  }
}

quickHealthCheck();
