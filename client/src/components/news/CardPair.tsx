/**
 * Author: GPT-6 / Codex (reasoning effort not exposed)
 * Date: 02-November-2026
 * PURPOSE: Show the existing card's separate front and back together, with keyboard-accessible
 * enlargement. Reuse the current image endpoints and version; never create another card design.
 * SRP/DRY check: Pass — existing renderer, Dialog and card data own the content.
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { collectionShareVersion, type CollectionCard } from '@shared/newsCollection';
import './cardPair.css';

export function CardPair({ card }: { card: CollectionCard }) {
  const [side, setSide] = useState<'front' | 'back' | null>(null);
  const [fullSize, setFullSize] = useState(false);
  const source = (face: 'front' | 'back') => `/api/news/cards/${encodeURIComponent(card.id)}/image.png?side=${face}&v=${collectionShareVersion(card)}`;
  return <>
    <section className="card-pair" aria-label={`${card.name} card front and back`}>
      {(['front', 'back'] as const).map(face => <figure key={face}>
        <figcaption>{face === 'front' ? 'Front' : 'Back'} <span>Enlarge ↗</span></figcaption>
        <button type="button" aria-label={`Enlarge ${face} of ${card.name}’s card`} onClick={() => { setFullSize(false); setSide(face); }}>
          <img src={source(face)} alt={`${card.name}, card ${card.number}, ${face}`} width="750" height="1050" decoding="async" />
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
