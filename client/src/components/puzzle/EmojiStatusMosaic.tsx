/**
 * Author: gpt-5-codex
 * Date: 2025-10-17
 * PURPOSE: Renders status-specific emoji mosaics for puzzle cards to reinforce
 *          explained vs unexplained states alongside gradient styling.
 * SRP/DRY check: Pass — Dedicated to status mosaics reused across puzzle cards.
 */
import React from 'react';
import { EmojiMosaicAccent } from '@/components/browser/EmojiMosaicAccent';

type PuzzleStatus = 'explained' | 'unexplained';

type EmojiStatusMosaicProps = {
  status: PuzzleStatus;
  className?: string;
  size?: 'xs' | 'sm';
};

export const EmojiStatusMosaic: React.FC<EmojiStatusMosaicProps> = ({
  status,
  className,
  size = 'xs',
}) => {
  const variant = status === 'explained' ? 'statusExplained' : 'statusUnexplained';

  return (
    <EmojiMosaicAccent
      variant={variant}
      size={size}
      className={className}
      framed
    />
  );
};

export default EmojiStatusMosaic;
