/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); Claude Opus 5.5
 * Date: 14-Nov-2026
 * 14-Nov-2026 (Claude Opus 5.5): faces load from a 280/420/560/750 srcSet with sizes matching the pair's layout, so
 *          tablets and retina screens get sharp faces; the thumb address and srcSet helpers are shared with the binder.
 * PURPOSE: Show the existing card's separate front and back together, with keyboard-accessible
 * enlargement. Reuse the current image endpoints and version; never create another card design.
 * SRP/DRY check: Pass — existing renderer, Dialog and card data own the content.
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { collectionShareVersion, type CollectionCard } from '@shared/newsCollection';
import './cardPair.css';

/** Widths the thumb endpoint renders for a face (its maximum is 750): enough for retina screens without the full PNG. */
export const CARD_FACE_WIDTHS = [280, 420, 560, 750] as const;
export const cardFaceThumb = (card: CollectionCard, side: 'front' | 'back', width: number, version = collectionShareVersion(card)) =>
  `/api/news/cards/${encodeURIComponent(card.id)}/thumb.webp?side=${side}&w=${width}&v=${version}`;
export const cardFaceSrcSet = (card: CollectionCard, side: 'front' | 'back', version = collectionShareVersion(card)) =>
  CARD_FACE_WIDTHS.map(width => `${cardFaceThumb(card, side, width, version)} ${width}w`).join(', ');
/** Each face is half of .card-pair (max 1100px wide, 20px gap; 12px gap on phones). */
const PAIR_SIZES = '(max-width: 700px) calc(50vw - 22px), (max-width: 1140px) calc(50vw - 30px), 540px';

export function CardPair({ card }: { card: CollectionCard }) {
  const [side, setSide] = useState<'front' | 'back' | null>(null);
  const [fullSize, setFullSize] = useState(false);
  const source = (face: 'front' | 'back') => `/api/news/cards/${encodeURIComponent(card.id)}/image.png?side=${face}&v=${collectionShareVersion(card)}`;
  return <>
    <section className="card-pair" aria-label={`${card.name} card front and back`}>
      {(['front', 'back'] as const).map(face => <figure key={face}>
        <figcaption>{face === 'front' ? 'Front' : 'Back'} <span>Enlarge ↗</span></figcaption>
        <button type="button" aria-label={`Enlarge ${face} of ${card.name}’s card`} onClick={() => { setFullSize(false); setSide(face); }}>
          <img src={cardFaceThumb(card, face, 560)} srcSet={cardFaceSrcSet(card, face)} sizes={PAIR_SIZES} alt={`${card.name}, card ${face}`} width="560" height="784" decoding="async" />
        </button>
      </figure>)}
    </section>
    <Dialog open={side !== null} onOpenChange={open => { if (!open) setSide(null); }}>
      <DialogContent className="card-pair-dialog">
        <DialogTitle>{card.name} · {side === 'back' ? 'Back' : 'Front'}</DialogTitle>
        <DialogDescription>Select full size to read the card; Escape closes this view.</DialogDescription>
        <button className="card-pair-zoom" type="button" onClick={() => setFullSize(!fullSize)}>{fullSize ? 'Fit to screen' : 'Full size'}</button>
        <div className={`card-pair-scroll${fullSize ? ' is-full' : ''}`} tabIndex={0} role="region" aria-label="Enlarged card">{side && <img src={source(side)} alt={`${card.name} card ${side}`} width="750" height="1050" />}</div>
      </DialogContent>
    </Dialog>
  </>;
}
