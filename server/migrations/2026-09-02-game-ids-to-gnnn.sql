-- Author: Claude Opus 5
-- Date: 02-September-2026
-- PURPOSE: Repoint collected play data at the authoring game ids. The repo renamed its 50
-- published tasks from the old hashed ids (t00810611) to the ids they carry in
-- autoresearch-arena (g007) so a game is called one thing in both places; these rows were
-- written under the old name and would otherwise key nothing.
--
-- SAFE TO RUN TWICE. Every statement joins against the map below, so a row already
-- carrying gNNN matches nothing and is left alone.
--
-- Run:  psql "$DATABASE_URL" -f server/migrations/2026-09-02-game-ids-to-gnnn.sql
-- It prints before/after counts and commits only if every count reconciles.

BEGIN;

CREATE TEMP TABLE id_map (old_id TEXT PRIMARY KEY, new_id TEXT NOT NULL) ON COMMIT DROP;
INSERT INTO id_map (old_id, new_id) VALUES
    ('t8dbff678', 'g001'),
    ('td6b934b7', 'g005'),
    ('t74db26e1', 'g006'),
    ('t00810611', 'g007'),
    ('tdbd4af05', 'g008'),
    ('t521bcd1b', 'g009'),
    ('t6d44af56', 'g010'),
    ('t33bdec30', 'g011'),
    ('ta3597a87', 'g012'),
    ('t35352a03', 'g013'),
    ('t4049adae', 'g014'),
    ('t3d56da2d', 'g015'),
    ('t3722717c', 'g016'),
    ('t643da6ee', 'g017'),
    ('tfd14806f', 'g018'),
    ('tc6f8ee4c', 'g019'),
    ('t715ea045', 'g020'),
    ('tfdb1fc6f', 'g021'),
    ('t2774d7a8', 'g022'),
    ('t999ce20d', 'g023'),
    ('t98b12bb2', 'g024'),
    ('t6acac767', 'g025'),
    ('t088853a8', 'g026'),
    ('t89a4dc45', 'g027'),
    ('t7114b1e1', 'g028'),
    ('taa5fdde0', 'g029'),
    ('t027cce33', 'g030'),
    ('td1047401', 'g031'),
    ('t61abcaed', 'g032'),
    ('t6381e4da', 'g033'),
    ('t64b427c7', 'g034'),
    ('t18586acc', 'g035'),
    ('t0bf293c2', 'g036'),
    ('t562e07f7', 'g037'),
    ('t99e8274e', 'g038'),
    ('t77f54ade', 'g039'),
    ('t056a6b16', 'g040'),
    ('t18c1e5f2', 'g041'),
    ('tcd57bacb', 'g042'),
    ('t61247d23', 'g043'),
    ('t80d5b02c', 'g044'),
    ('ta6acc86e', 'g045'),
    ('tca5096fc', 'g046'),
    ('t4409a16e', 'g047'),
    ('tb4f43900', 'g050'),
    ('t7725dccf', 'g136'),
    ('te5f94dfe', 'g155'),
    ('tf17bd2df', 'g162'),
    ('t63b03ddb', 'g171'),
    ('ta6b3b4a0', 'g178');

-- What is about to change, per table, before anything is written.
\echo '--- rows still on the old hashed ids ---'
SELECT 'community_human_sessions' AS table_name, count(*) AS to_migrate
  FROM community_human_sessions s JOIN id_map m ON s.game_id = m.old_id
UNION ALL
SELECT 'community_game_feedback', count(*)
  FROM community_game_feedback f JOIN id_map m ON f.game_id = m.old_id
UNION ALL
SELECT 'arc3_sessions', count(*)
  FROM arc3_sessions a JOIN id_map m ON a.game_id = m.old_id;

-- Anything on a t-shaped id that is NOT one of our 50 is not ours to touch; it is listed
-- rather than migrated, because a silent rename of someone else's key is unrecoverable.
\echo '--- t-shaped ids NOT in the map (left alone; investigate if non-empty) ---'
SELECT game_id, count(*) FROM (
  SELECT game_id FROM community_human_sessions
  UNION ALL SELECT game_id FROM community_game_feedback
  UNION ALL SELECT game_id FROM arc3_sessions
) q
WHERE game_id ~ '^t[0-9a-f]{8}$' AND game_id NOT IN (SELECT old_id FROM id_map)
GROUP BY game_id ORDER BY 2 DESC;

UPDATE community_human_sessions s SET game_id = m.new_id FROM id_map m WHERE s.game_id = m.old_id;
UPDATE community_game_feedback  f SET game_id = m.new_id FROM id_map m WHERE f.game_id = m.old_id;
UPDATE arc3_sessions            a SET game_id = m.new_id FROM id_map m WHERE a.game_id = m.old_id;

\echo '--- remaining on old ids (must be 0) ---'
SELECT count(*) AS still_old FROM (
  SELECT game_id FROM community_human_sessions
  UNION ALL SELECT game_id FROM community_game_feedback
  UNION ALL SELECT game_id FROM arc3_sessions
) q JOIN id_map m ON q.game_id = m.old_id;

COMMIT;
