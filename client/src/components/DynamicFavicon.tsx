/*IS THIS FOR USERS??? we already generate a favicon in the public folder automatically, no need for user ui!!
 * Author: Cascade using Qwen 2.5 Pro
 * Date: 2025-09-19
 * PURPOSE: Dynamic favicon component that generates a 3x3 grid of random colors
 * This component creates a dynamic favicon that can be randomized on demand
 * SRP and DRY check: Pass - This component has a single responsibility of managing the favicon
 */

import React, { useEffect, useRef } from 'react';

// Standard ARC colors as RGB tuples
const ARC_COLORS_TUPLES = [
  [0, 0, 0],        // 0 Black
  [0, 116, 217],    // 1 Blue
  [255, 65, 54],    // 2 Red
  [46, 204, 64],    // 3 Green
  [255, 220, 0],    // 4 Yellow
  [128, 128, 128],  // 5 Grey
  [240, 18, 190],   // 6 Magenta/Pink
  [255, 133, 27],   // 7 Orange
  [127, 219, 255],  // 8 Light Blue/Cyan
  [128, 0, 0],      // 9 Maroon
] as const;

type DynamicFaviconProps = {
  randomize?: boolean;
};

const DynamicFavicon: React.FC<DynamicFaviconProps> = ({ randomize = false }) => {
  const faviconRef = useRef<HTMLLinkElement | null>(null);

  /**
   * Get a random color from the ARC_COLORS_TUPLES palette
   * @returns A random color from the ARC color palette as an RGB string
   */
  const getRandomColor = (): string => {
    const randomIndex = Math.floor(Math.random() * ARC_COLORS_TUPLES.length);
    const [r, g, b] = ARC_COLORS_TUPLES[randomIndex];
    return `rgb(${r}, ${g}, ${b})`;
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
    
    // Add a subtle border to make the favicon more visible on white backgrounds
    ctx.strokeStyle = '#EEEEEE';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
    
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
