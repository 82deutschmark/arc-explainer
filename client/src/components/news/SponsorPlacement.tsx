/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-08
 * PURPOSE: Clearly disclosed VoynichLabs house advertisements shared by ARC Daily's
 *          front page and article rail, with links to the lab and its real videos.
 * SRP/DRY check: Pass — one component owns sponsor copy and destination URLs.
 */

const VOYNICH_URL = 'https://voynichlabs.org/';
const VOYNICH_VIDEOS_URL = 'https://voynichlabs.org/music/videos';

export function SponsorDisclosure() {
  return <div className="news-sponsor-disclosure">Sponsored by <a href={VOYNICH_URL} target="_blank" rel="sponsored noopener noreferrer">VoynichLabs ↗</a></div>;
}

export function SponsorPlacement({ format }: { format: 'banner' | 'rail' }) {
  return <section className={`news-ad news-ad-${format}`} aria-label="Advertisement from VoynichLabs">
    <div className="news-ad-label">Advertisement <span aria-hidden="true">/</span> VoynichLabs</div>
    <div className="news-ad-body">
      <div className="news-ad-mark" aria-hidden="true">🦞</div>
      <div className="news-ad-message">
        <span className="news-ad-brand">VOYNICHLABS</span>
        <h2>After the final move, hit play.</h2>
        <p>AI music videos, code-drawn scenes and experiments from the lab.</p>
      </div>
      <div className="news-ad-actions">
        <a href={VOYNICH_VIDEOS_URL} target="_blank" rel="sponsored noopener noreferrer">Watch the videos <span aria-hidden="true">↗</span></a>
        <a href={VOYNICH_URL} target="_blank" rel="sponsored noopener noreferrer">Explore VoynichLabs <span aria-hidden="true">↗</span></a>
      </div>
    </div>
  </section>;
}
