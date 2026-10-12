/**
 * Author: GPT-6.1 Sol / Codex; GPT-6 Sol / Codex
 * Date: 2026-10-11
 * PURPOSE: News cycle and editorial standards for the unified About the Paper page,
 *          shared by the browser and crawler HTML. Operational instructions remain in docs/newsroom.
 * SRP/DRY check: Pass — one source for institutional production and standards copy.
 */
export const NEWS_PRODUCTION = [
  { heading: 'Gather the record', text: 'The paper saves both public Kaggle boards every half hour. A research desk checks public posts, discussions and linked releases every six hours. Saved observations and original sources give the reporting its dates and its starting point.' },
  { heading: 'File to the wire', text: 'Every two hours, including midnight Eastern, the wire desk looks for consequential uncovered moves. Short reports appear on the wire and the front page as they are filed. The desk can file nothing when there is no worthwhile new story; larger developments can receive a separate feature or dispatch between editions.' },
  { heading: 'Make the edition', text: 'The early edition publishes at 6 am and the late edition at 6 pm Eastern. The edition desk reviews the wire, dispatches, research and open editorial assignments, chooses the leads, and adds context. The morning intake includes reports filed since the previous evening, including overnight news. Items held for further reporting remain in the next desk’s intake.' },
  { heading: 'Publish and keep the record', text: 'Stories carry source links, observation dates and their actual writer’s credit. Each edition keeps its reporting evidence and a record of the desk’s story selections. The editions are announced on X; a separate afternoon recap runs at 2 pm Eastern.' },
];

export const NEWS_METHOD = [
  { heading: 'Evidence and interpretation', text: 'Reporting helpers check article structure, citations and box-score figures; wire figures are checked against the saved brief. The reporting desk checks narrative numbers, comparisons and identities against its sources. Claims are attributed, analysis is identified, and missing or inaccessible evidence is stated. Automated checks support the desk’s source review and editorial judgment.' },
  { heading: 'Dates matter', text: 'ARC-AGI-2 and ARC-AGI-3 have separate standings. Morning score comparisons begin at UTC midnight; evening comparisons use the previous calendar day’s 6 pm Eastern observation. Live movers generally compare with a save about a day earlier. A story’s comparison window is distinct from the edition’s news intake. Missing history stays unknown, and public ranks and medal bands remain provisional.' },
  { heading: 'People, credit and pictures', text: 'Account identities and team memberships need sources and dates. A roster observation does not establish a joining date, leadership or credit for a submission. Competitor pictures come from the person’s verified Kaggle account or their own Hall of Fame artwork; editorial illustrations are labeled. Mark also competes on Kaggle, and coverage of his team follows the same sourcing and attribution rules. Public reporting uses public sources; restricted subscriber material stays in the private briefing.' },
  { heading: 'Corrections and support', text: 'Published editions retain their original evidence. Corrections are identified, and follow-up reporting adds new facts as a story develops. Readers can send corrections, retraction requests or complaints to Mark with the story link and the relevant source. VoynichLabs sponsors the publication, and its placements are labeled advertisements.' },
];
