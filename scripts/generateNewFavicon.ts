/*
 * Author: Cascade using Qwen 2.5 Pro
 * Date: 2025-09-19
 * PURPOSE: Generate a single new favicon with a different 3x3 grid of random colors
 * This script creates one new favicon with random colors for immediate use
 * SRP and DRY check: Pass - This file has a single responsibility of generating a single new favicon
 * This functionality is unique in the project and doesn't violate DRY principles
 */

import { generateAllFavicons } from './generateFavicons';

/**
 * Generate a new favicon with random colors
 * This function can be called to create a new color pattern for the favicon
 */
const generateNewFavicon = () => {
  console.log('Generating new favicon with random colors...');
  generateAllFavicons();
  console.log('New favicon generated! Refresh your browser to see the new colors.');
};

// Execute the new favicon generation when script is run directly
const argv1 = process.argv[1];
if (argv1 && argv1.endsWith('generateNewFavicon.ts')) {
  generateNewFavicon();
}

// Export for use in other modules
export { generateNewFavicon };
