/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); GPT-6.1 Sol / Codex; GPT-6 Sol / Codex
 * Date: 02-November-2026
 * PURPOSE: News cycle and editorial standards for the unified About the Paper page,
 *          shared by the browser and crawler HTML. Operational instructions remain in docs/newsroom.
 * SRP/DRY check: Pass — one source for institutional production and standards copy.
 */
import { NEWS_BRAND } from './newsBrand';

export const NEWS_PRODUCTION = NEWS_BRAND.goose ? [
  { heading: 'Follow the changing field', text: 'Research follows substantial Kaggle competitions, public methods and discussions. Verified closing dates raise the attention given to a contest. Partial or failed source reads remain visible to the newsroom.' },
  { heading: 'Develop the story', text: 'Meaningful developments become source-linked reporting assignments. A continuing story is updated at its permanent address; a changed team name does not create a new identity.' },
  { heading: 'Use the original record', text: 'The newsroom keeps durable context, editorial choices and artwork references. Current standings remain at Kaggle or in a clearly dated data cache, with direct source links.' },
  { heading: 'Publish a checked report', text: 'Every story carries its date, writer and sources. Major stories receive a new illustration made from approved character references. Public standings remain provisional until official results.' },
] : [
  { heading: 'Gather the record', text: 'The paper saves both public Kaggle boards every half hour. A research desk checks public posts, discussions and linked releases every six hours. Saved observations and original sources give the reporting its dates and its starting point.' },
  { heading: 'File to the wire', text: 'The wire desk looks for consequential uncovered moves. Short reports appear on the wire and the front page as they are filed. The desk can file nothing when there is no worthwhile new story; larger developments can receive a separate feature or dispatch between editions.' },
  { heading: 'Make the edition', text: 'Editions record their actual publication times in UTC. The edition desk reviews the wire, dispatches, research and open editorial assignments, chooses the leads, and adds context. The morning intake includes reports filed since the previous evening, including overnight news. Items held for further reporting remain in the next desk’s intake.' },
  { heading: 'Publish and keep the record', text: 'Stories carry source links, observation dates and their actual writer’s credit. Each edition keeps its reporting evidence and a record of the desk’s story selections. Distribution follows the editor’s selected destinations and exact-post review.' },
];

export const NEWS_METHOD = [
  { heading: 'Evidence and interpretation', text: 'Reporting helpers check article structure, citations and box-score figures; wire figures are checked against the saved brief. The reporting desk checks narrative numbers, comparisons and identities against its sources. Claims are attributed, analysis is identified, and missing or inaccessible evidence is stated. Automated checks support the desk’s source review and editorial judgment.' },
  { heading: 'Dates matter', text: 'Competitions have separate standings. Publication dates, deadlines and observation clocks are displayed in UTC, using a 24-hour clock. Each report names its actual comparison observations. A story’s comparison window is distinct from the edition’s news intake. Missing history stays unknown, and public ranks and medal bands remain provisional.' },
  { heading: 'People, credit and pictures', text: 'Account identities and team memberships need sources and dates. A roster observation does not establish a joining date, leadership or credit for a submission. Competitor pictures come from the person’s verified Kaggle account or their own Hall of Fame artwork; editorial illustrations are labeled. Mark also competes on Kaggle, and coverage of his team follows the same sourcing and attribution rules. Public reporting uses public sources; restricted subscriber material stays in the private briefing.' },
  { heading: 'Corrections and support', text: 'Published editions retain their original evidence. Corrections are identified, and follow-up reporting adds new facts as a story develops. Readers can send corrections, retraction requests or complaints to Mark with the story link and the relevant source. VoynichLabs sponsors the publication, and its placements are labeled advertisements.' },
];
