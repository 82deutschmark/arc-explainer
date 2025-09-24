/*IS THIS FOR USERS??? we already generate a favicon in the public folder automatically, no need for user ui!!
 * Author: Cascade using Qwen 2.5 Pro
 * Date: 2025-09-19
 * PURPOSE: Dynamic favicon component that generates a 3x3 grid of random colors
 * This component creates a dynamic favicon that can be randomized on demand
 * SRP and DRY check: Pass - This component has a single responsibility of managing the favicon
 */

import React, { useEffect, useRef } from 'react';

type DynamicFaviconProps = {
  randomize?: boolean;
};

const DynamicFavicon: React.FC<DynamicFaviconProps> = ({ randomize = false }) => {
  const faviconRef = useRef<HTMLLinkElement | null>(null);

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
   * Generate a favicon as a data URL
   * @returns A data URL representing the favicon
   */
  const generateFaviconDataUrl = (): string => {
    // Create an offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }
    
    // Configuration constants
    const GRID_SIZE = 3;
    const squareSize = Math.floor(canvas.width / GRID_SIZE);
    
    // Draw white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
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
    
    // Convert to data URL
    return canvas.toDataURL('image/png');
  };

  const updateFavicon = () => {
    try {
      // Generate favicon data URL
      const dataURL = generateFaviconDataUrl();
      
      // Remove existing favicon if any
      if (faviconRef.current) {
        document.head.removeChild(faviconRef.current);
      }
      
      // Create new favicon link
      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/png';
      link.href = dataURL;
      
      // Add to document head
      document.head.appendChild(link);
      faviconRef.current = link;
    } catch (error) {
      console.error('Error updating favicon:', error);
    }
  };

  useEffect(() => {
    // Update favicon on mount
    updateFavicon();
    
    // If randomize is true, update favicon periodically
    let interval: NodeJS.Timeout;
    if (randomize) {
      interval = setInterval(updateFavicon, 30000); // Update every 30 seconds
    }
    
    // Cleanup interval on unmount
    return () => {
      if (interval) {
        clearInterval(interval);
      }
      // Clean up favicon element
      if (faviconRef.current) {
        document.head.removeChild(faviconRef.current);
      }
    };
  }, [randomize]);

  // This component doesn't render anything visible
  return null;
};

export default DynamicFavicon;
