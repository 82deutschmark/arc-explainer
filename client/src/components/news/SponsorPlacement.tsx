/**
 * Author: GPT-6 Sol / Codex
 * Date: 2026-10-08
 * PURPOSE: Clearly disclosed VoynichLabs house advertisements shared by ARC Daily's
 *          front page and article rail, including a portrait Wasted video ad.
 * SRP/DRY check: Pass — one component owns sponsor copy and destination URLs.
 */

const VOYNICH_URL = 'https://voynichlabs.org/';
const VOYNICH_VIDEOS_URL = 'https://voynichlabs.org/music/videos';
const WASTED_YOUTUBE_URL = 'https://www.youtube.com/shorts/th6e41x-g2g';

export function SponsorDisclosure() {
  return <div className="news-sponsor-disclosure">Sponsored by <a href={VOYNICH_URL} target="_blank" rel="sponsored noopener noreferrer">VoynichLabs ↗</a></div>;
}

export function SponsorPlacement({ format }: { format: 'banner' | 'rail' }) {
  if (format === 'rail') return <section className="news-ad news-video-ad" aria-label="Advertisement from VoynichLabs">
    <div className="news-ad-label">Advertisement <span aria-hidden="true">/</span> VoynichLabs</div>
    <a className="news-video-ad-link" href={WASTED_YOUTUBE_URL} target="_blank" rel="sponsored noopener noreferrer" aria-label="Watch Wasted — Temperature 1.3 by Larry on YouTube (opens a new tab)">
      <span className="news-ad-brand">VOYNICHLABS PRESENTS</span>
      <h2>WASTED</h2>
      <span className="news-video-ad-subtitle">Temperature 1.3 / Larry</span>
      <img src="/ads/wasted-temperature.jpg" width="1280" height="720" alt="Wasted music video artwork: an office at temperature 0.7 becomes a neon party at temperature 1.3." loading="lazy" />
      <p>Turn up the temperature.<br />An AI music video from VoynichLabs.</p>
      <span className="news-video-ad-cta">▶ Watch on YouTube <span aria-hidden="true">↗</span></span>
    </a>
  </section>;
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
