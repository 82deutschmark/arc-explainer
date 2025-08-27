/**
 * Quick script to check actual database schema
 */
const { Pool } = require('pg');
require('dotenv').config();

async function checkSchema() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'explanations' 
      ORDER BY ordinal_position
    `);
    
    console.log('ACTUAL DATABASE COLUMNS:');
    result.rows.forEach(row => {
      console.log(`${row.column_name} - ${row.data_type} (${row.is_nullable})`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkSchema();
