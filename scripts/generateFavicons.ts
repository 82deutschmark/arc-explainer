/*
 * Author: Cascade using Qwen 2.5 Pro
 * Date: 2025-09-19
 * PURPOSE: Generate dynamic favicon with 3x3 grid of random colors for ARC Explainer
 * This script creates multiple favicon sizes and a dynamic 3x3 grid with random colors
 * SRP and DRY check: Pass - This file has a single responsibility of generating favicons
 * This functionality is unique in the project and doesn't violate DRY principles
 */

import { createCanvas } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';

// Configuration constants for favicon generation
const GRID_SIZE = 3; // 3x3 grid as requested
const SIZES = [
  { width: 16, height: 16, name: 'favicon-16x16.png' },
  { width: 32, height: 32, name: 'favicon-32x32.png' },
  { width: 180, height: 180, name: 'apple-touch-icon.png' },
  { width: 192, height: 192, name: 'android-chrome-192x192.png' },
  { width: 512, height: 512, name: 'android-chrome-512x512.png' }
];

/**
 * Generate a random hex color
 * @returns A random hex color string
 */
const getRandomColor = (): string => {
  // Generate a random number between 0 and 16777215 (0xFFFFFF)
  // Convert to hexadecimal and pad with zeros to ensure 6 digits
  return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
};

/**
 * Generate a single favicon canvas with 3x3 grid of random colors
 * @param size The width and height of the canvas
 * @returns Canvas object with the favicon drawn
 */
const generateFaviconCanvas = (size: number) => {
  // Create canvas with specified size
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Calculate square size based on canvas size and grid
  const squareSize = Math.floor(size / GRID_SIZE);
  
  // Draw white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);

  // Draw 3x3 grid of colored squares
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      // Generate random color for each square
      const color = getRandomColor();
      ctx.fillStyle = color;
      
      // Draw square at calculated position
      ctx.fillRect(col * squareSize, row * squareSize, squareSize, squareSize);
    }
  }

  return canvas;
};

/**
 * Generate all required favicon sizes
 * This function creates multiple PNG files with different dimensions
 */
const generateAllFavicons = () => {
  // Determine output directory
  const publicDir = path.join(process.cwd(), 'client', 'public');
  
  // Ensure public directory exists
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  
  // Generate each required size
  SIZES.forEach(size => {
    try {
      // Create canvas for this size
      const canvas = generateFaviconCanvas(size.width);
      
      // Convert to buffer
      const buffer = canvas.toBuffer('image/png');
      
      // Write to file
      const outputPath = path.join(publicDir, size.name);
      fs.writeFileSync(outputPath, buffer);
      
      console.log(`Generated ${size.name} favicon (${size.width}x${size.height})`);
    } catch (error) {
      console.error(`Error generating ${size.name}:`, error);
    }
  });
  
  // Generate a simple ICO file (using 32x32 version)
  try {
    const canvas = generateFaviconCanvas(32);
    const buffer = canvas.toBuffer('image/png');
    const icoPath = path.join(publicDir, 'favicon.ico');
    fs.writeFileSync(icoPath, buffer);
    console.log('Generated favicon.ico');
  } catch (error) {
    console.error('Error generating favicon.ico:', error);
  }
  
  console.log('All favicon generation complete!');
};

// Execute the favicon generation when script is run directly
const argv1 = process.argv[1];
if (argv1) {
  // Check if called directly via npm script
  if (argv1.endsWith('generateFavicons.ts')) {
    generateAllFavicons();
  }
  // Check if run directly as a module
  else if (import.meta.url.startsWith('file://') && import.meta.url.endsWith(argv1.replace(/\\/g, '/').split('/').pop() || '')) {
    generateAllFavicons();
  }
}

// Export for use in other modules
export { generateAllFavicons, generateFaviconCanvas };