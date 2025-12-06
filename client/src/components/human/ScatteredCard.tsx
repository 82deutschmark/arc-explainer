/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-06
 * PURPOSE: Single animated card component for card pack opening sequence.
 * Animates between scatter and settle positions based on phase prop.
 * SRP/DRY check: Pass - Single responsibility for individual card animation and rendering.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { AnimationPhase } from '@/hooks/usePackAnimation';

interface ScatteredCardProps {
  contributor: {
    id: number;
    fullName: string;
    imageUrl: string | null;
  };
  scatterPosition: { x: number; y: number };
  settlePosition: { x: number; y: number };
  phase: AnimationPhase;
  staggerDelay: number;
}

export function ScatteredCard({
  contributor,
  scatterPosition,
  settlePosition,
  phase,
  staggerDelay,
}: ScatteredCardProps) {
  // Determine animation state based on phase
  let x = 0;
  let y = 0;
  let rotation = 0;
  let opacity = 1;

  if (phase === 'scattering' || phase === 'settling' || phase === 'complete') {
    // During scatter phase, animate to scatter position
    if (phase === 'scattering') {
      x = scatterPosition.x;
      y = scatterPosition.y;
      rotation = Math.random() * 60 - 30; // ±30 degrees
      opacity = 1;
    } else {
      // During settle and complete, animate to settle position
      x = settlePosition.x;
      y = settlePosition.y;
      rotation = 0;
      opacity = 1;
    }
  }

  return (
    <motion.div
      className="absolute w-32 h-44 sm:w-40 sm:h-56"
      initial={{ x: 0, y: 0, rotate: 0, opacity: 0 }}
      animate={{
        x,
        y,
        rotate: rotation,
        opacity,
      }}
      transition={{
        duration: phase === 'scattering' ? 0.5 : phase === 'settling' ? 0.8 : 0,
        delay: staggerDelay,
        ease: phase === 'scattering' ? 'easeOut' : 'easeInOut',
      }}
    >
      <div className="w-full h-full rounded-lg overflow-hidden border border-zinc-700 bg-black shadow-lg">
        {contributor.imageUrl ? (
          <img
            src={contributor.imageUrl}
            alt={contributor.fullName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-xs text-zinc-500">
            {contributor.fullName}
          </div>
        )}
      </div>
    </motion.div>
  );
}
