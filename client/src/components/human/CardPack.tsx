/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-06
 * PURPOSE: Holographic card pack visual component with click/keyboard interaction.
 * Handles user interaction to trigger pack opening, emits onOpen callback.
 * SRP/DRY check: Pass - Single responsibility for pack visual and interaction handling.
 */

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Crown, Sparkles } from 'lucide-react';

interface CardPackProps {
  onOpen: () => void;
}

export function CardPack({ onOpen }: CardPackProps) {
  // Handle keyboard interaction
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onOpen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpen]);

  return (
    <div className="flex flex-col items-center justify-center">
      {/* Pack visual */}
      <motion.button
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen();
          }
        }}
        className="relative focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 rounded-lg transition-all"
        role="button"
        aria-label="Click or press Enter to open the card pack"
        tabIndex={0}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {/* Holographic background shimmer */}
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-amber-400/60 via-yellow-500/40 to-orange-400/60 pack-shimmer" />

        {/* Pack body */}
        <div className="relative w-56 h-72 sm:w-64 sm:h-80 rounded-lg bg-gradient-to-br from-amber-900 via-yellow-900 to-orange-900 border-2 border-amber-500/60 shadow-2xl overflow-hidden">
          {/* Internal holographic shine */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent" />

          {/* Center crown icon */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Crown className="w-12 h-12 text-amber-300 mb-4 drop-shadow-lg" />
            <p className="text-sm text-amber-200 font-semibold text-center px-4">
              Hall of Fame
            </p>
          </div>

          {/* Corner accent sparkles */}
          <motion.div
            className="absolute top-4 right-4"
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          >
            <Sparkles className="w-4 h-4 text-yellow-300" />
          </motion.div>
          <motion.div
            className="absolute bottom-4 left-4"
            animate={{ rotate: -360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          >
            <Sparkles className="w-4 h-4 text-yellow-300" />
          </motion.div>
        </div>
      </motion.button>

      {/* Hint text with pulse animation */}
      <motion.p
        className="mt-8 text-sm text-amber-300 text-center"
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        Click or press Enter to open
      </motion.p>
    </div>
  );
}
