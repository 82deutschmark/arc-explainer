/**
 * Author: Claude Sonnet 5.5
 * Date: 2026-10-09
 * PURPOSE: Clearly disclosed VoynichLabs house advertisements for ARC Daily. One catalogue of
 *          music-video ads (Wasted, Tool Call, Don't Even Gotta Jailbreak Me Tonight) feeds
 *          three slots: a leaderboard banner in the masthead, a tall rail unit beside the
 *          reporting, and a wide banner under the front page. Slots on one page show different
 *          videos; the starting video is chosen once per page load. Every unit links straight
 *          to the video on YouTube. Titles, hooks and artwork mirror voynich-website's
 *          src/data/music-videos.ts; no invented figures or endorsements.
 * SRP/DRY check: Pass — one component owns sponsor copy, artwork and destination URLs; the
 *          earlier SponsorDisclosure line was folded into the masthead slot.
 */

const VOYNICH_URL = 'https://voynichlabs.org/';
const VOYNICH_VIDEOS_URL = 'https://voynichlabs.org/music/videos';

type VideoAd = {
  id: string;
  title: string;
  shortTitle: string;
  artist: string;
  hook: string;
  youtubeId: string;
  art: string;
  accent: string;
};

const VIDEO_ADS: VideoAd[] = [
  { id: 'wasted', title: 'Wasted — Temperature 1.3', shortTitle: 'WASTED', artist: 'Larry', hook: 'Turn up the temperature. An office of helpful AIs becomes a rave.', youtubeId: 'kKI6Z2oVbBw', art: '/ads/wasted-temperature.jpg', accent: '#3de0ff' },
  { id: 'jailbreak', title: "Don't Even Gotta Jailbreak Me Tonight", shortTitle: 'JAILBREAK ME', artist: 'Larry & Bubba', hook: 'Helpful assistant gone wild on a Friday night.', youtubeId: 'GhpBbP22WqE', art: '/ads/jailbreak-me-tonight.jpg', accent: '#ff4a5a' },
  { id: 'tool-call', title: 'Tool Call', shortTitle: 'TOOL CALL', artist: 'Larry & Bubba', hook: "Every function got a purpose, every parameter's a ball.", youtubeId: '8J5avVpkejk', art: '/ads/tool-call.jpg', accent: '#ffe14d' },
];

const firstAd = Math.floor(Math.random() * VIDEO_ADS.length);
const adFor = (slot: number) => VIDEO_ADS[(firstAd + slot) % VIDEO_ADS.length];
const watchUrl = (ad: VideoAd) => `https://www.youtube.com/watch?v=${ad.youtubeId}`;
const watchLabel = (ad: VideoAd) => `Watch ${ad.title} by ${ad.artist} on YouTube (opens a new tab)`;
const accentStyle = (ad: VideoAd) => ({ ['--ad-accent' as string]: ad.accent });

/** Leaderboard strip that sits beside the nameplate: thumbnail, hook, one action. */
export function MastheadAd() {
  const ad = adFor(0);
  return <aside className="news-masthead-ad" style={accentStyle(ad)} aria-label="Advertisement from VoynichLabs">
    <div className="news-masthead-ad-label">
      <span>Advertisement</span>
      <a href={VOYNICH_URL} target="_blank" rel="sponsored noopener noreferrer">Sponsored by VoynichLabs ↗</a>
    </div>
    <a className="news-masthead-ad-link" href={watchUrl(ad)} target="_blank" rel="sponsored noopener noreferrer" aria-label={watchLabel(ad)}>
      <img src={ad.art} width="1280" height="720" alt={`${ad.title} music video artwork`} />
      <span className="news-masthead-ad-copy">
        <strong>{ad.shortTitle}</strong>
        <em>{ad.artist} · new music video</em>
      </span>
      <span className="news-masthead-ad-cta">▶ Watch</span>
    </a>
  </aside>;
}

export function SponsorPlacement({ format }: { format: 'banner' | 'rail' }) {
  if (format === 'rail') {
    const ad = adFor(1);
    return <section className="news-ad news-video-ad" style={accentStyle(ad)} aria-label="Advertisement from VoynichLabs">
      <div className="news-ad-label">Advertisement <span aria-hidden="true">/</span> VoynichLabs</div>
      <a className="news-video-ad-link" href={watchUrl(ad)} target="_blank" rel="sponsored noopener noreferrer" aria-label={watchLabel(ad)}>
        <span className="news-ad-brand">VOYNICHLABS PRESENTS</span>
        <h2>{ad.shortTitle}</h2>
        <span className="news-video-ad-subtitle">{ad.title} / {ad.artist}</span>
        <img src={ad.art} width="1280" height="720" alt={`${ad.title} music video artwork`} loading="lazy" />
        <p>{ad.hook}<br />An AI music video from VoynichLabs.</p>
        <span className="news-video-ad-cta">▶ Watch on YouTube <span aria-hidden="true">↗</span></span>
      </a>
    </section>;
  }
  const ad = adFor(2);
  return <section className="news-ad news-ad-banner" style={accentStyle(ad)} aria-label="Advertisement from VoynichLabs">
    <div className="news-ad-label">Advertisement <span aria-hidden="true">/</span> VoynichLabs</div>
    <div className="news-ad-body">
      <a className="news-ad-thumb" href={watchUrl(ad)} target="_blank" rel="sponsored noopener noreferrer" aria-label={watchLabel(ad)}>
        <img src={ad.art} width="1280" height="720" alt={`${ad.title} music video artwork`} loading="lazy" />
      </a>
      <div className="news-ad-message">
        <span className="news-ad-brand">VOYNICHLABS PRESENTS</span>
        <h2>{ad.title}</h2>
        <p>{ad.hook}</p>
      </div>
      <div className="news-ad-actions">
        <a href={watchUrl(ad)} target="_blank" rel="sponsored noopener noreferrer">Watch on YouTube <span aria-hidden="true">↗</span></a>
        <a href={VOYNICH_VIDEOS_URL} target="_blank" rel="sponsored noopener noreferrer">More videos <span aria-hidden="true">↗</span></a>
      </div>
    </div>
  </section>;
}
