/**
 * Author: GPT-6.1 Terra / Codex (reasoning effort not exposed)
 * Date: 13-November-2026
 * PURPOSE: Share the On the Private video still gallery between the newspaper and its server-rendered page.
 * SRP/DRY check: Pass — both renderers use this one list of public images and descriptions.
 */
const base = '/news-images/on-the-private-gallery/';
export const ON_THE_PRIVATE_ART = [
  ['03-ensemble-candidate.jpg', 'The band and the rabbits take the stage.'],
  ['ensemble-watching-board.jpg', 'The whole room watches the leaderboard.'],
  ['leaderboard-stage-concept.jpg', 'Dries at the microphone, singing to the board.'],
  ['ensemble-chase.jpg', 'A chase across the dance floor.'],
  ['ensemble-formation.jpg', 'The band and its dancing companions strike a pose.'],
  ['ensemble-slowdance.jpg', 'A slow dance while the private board stays hidden.'],
  ['insert-heart.jpg', 'A glowing heart for a much-loved score.'],
  ['insert-door.jpg', 'The locked door to the private results.'],
  ['01-club-empty.jpg', 'The nightclub before the cast arrives.'],
  ['production-end-card.jpg', 'Mark and Son at the controls, with the animals.'],
].map(([file, caption]) => ({ src: base + file, caption }));
