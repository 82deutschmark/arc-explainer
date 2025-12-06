/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-06
 * PURPOSE: Orchestrator component for card pack opening animation sequence.
 * Coordinates animation phases, calculates card positions, and unmounts when complete.
 * SRP/DRY check: Pass - Single responsibility for orchestrating animation flow and position calculation.
 */

import React, { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePackAnimation } from '@/hooks/usePackAnimation';
import { CardPack } from './CardPack';
import { ScatteredCard } from './ScatteredCard';
import { useArcContributors } from '@/hooks/useArcContributors';

interface CardPackOpeningProps {
  onComplete: () => void;
}

export function CardPackOpening({ onComplete }: CardPackOpeningProps) {
  const { phase, handleOpen, onComplete: onAnimationComplete } = usePackAnimation();
  const { data } = useArcContributors();

  // When animation completes, call parent callback after a short delay
  useEffect(() => {
    if (phase === 'complete') {
      const timer = setTimeout(() => {
        onComplete();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [phase, onComplete]);

  // Calculate responsive dimensions
  const getResponsiveDimensions = () => {
    const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
    if (width < 640) {
      return {
        packWidth: 224,
        packHeight: 288,
        scatterDistance: 120,
        settleColumns: 2,
        cardWidth: 128,
        cardHeight: 176,
      };
    }
    return {
      packWidth: 256,
      packHeight: 320,
      scatterDistance: 200,
      settleColumns: width < 1024 ? 3 : 4,
      cardWidth: 160,
      cardHeight: 224,
    };
  };

  const dimensions = useMemo(
    () => getResponsiveDimensions(),
    []
  );

  // Get top contributors for animation (about 15-20)
  const animationContributors = useMemo(() => {
    if (!data?.contributors) return [];
    return data.contributors.slice(0, 15).map((c) => ({
      id: c.id,
      fullName: c.fullName,
      imageUrl: c.imageUrl,
    }));
  }, [data?.contributors]);

  // Calculate scatter positions (starburst)
  const scatterPositions = useMemo(() => {
    return animationContributors.map((_, index) => {
      const angle = (index / animationContributors.length) * Math.PI * 2;
      const distance = dimensions.scatterDistance;
      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
      };
    });
  }, [animationContributors, dimensions.scatterDistance]);

  // Calculate settle grid positions (centered)
  const settlePositions = useMemo(() => {
    const { settleColumns, cardWidth, cardHeight } = dimensions;
    const gap = 12; // 3rem in pixels
    const cols = settleColumns;
    const rows = Math.ceil(animationContributors.length / cols);

    const gridWidth = cols * cardWidth + (cols - 1) * gap;
    const gridHeight = rows * cardHeight + (rows - 1) * gap;

    const offsetX = -gridWidth / 2;
    const offsetY = -gridHeight / 2;

    return animationContributors.map((_, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      return {
        x: offsetX + col * (cardWidth + gap),
        y: offsetY + row * (cardHeight + gap),
      };
    });
  }, [animationContributors.length, dimensions]);

  // Check for reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Skip animation entirely if user prefers reduced motion
  if (prefersReducedMotion) {
    useEffect(() => {
      onAnimationComplete();
    }, [onAnimationComplete]);
  }

  return (
    <AnimatePresence mode="wait">
      {phase !== 'complete' && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm"
          role="dialog"
          aria-label="Card pack opening animation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {phase === 'pack' && (
            <CardPack onOpen={handleOpen} />
          )}

          {(phase === 'opening' || phase === 'scattering' || phase === 'settling') && (
            <div className="relative w-full h-full flex items-center justify-center">
              {animationContributors.map((contributor, index) => (
                <ScatteredCard
                  key={contributor.id}
                  contributor={contributor}
                  scatterPosition={scatterPositions[index]}
                  settlePosition={settlePositions[index]}
                  phase={phase}
                  staggerDelay={index * 0.05}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
