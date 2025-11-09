/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-09
 * PURPOSE: Fetch and view all ARC3 games to analyze their visual patterns
 * SRP/DRY check: Pass - Single purpose script for exploring ARC3 game states
 */

const ARC3_API_KEY = "de61d386-c2e7-4c0f-9546-511c505a4381";
const BASE_URL = "https://three.arcprize.org";

interface GameInfo {
  game_id: string;
  title: string;
}

interface FrameData {
  guid: string;
  game_id: string;
  frame: number[][][];
  score: number;
  state: string;
  action_counter: number;
  max_actions: number;
}

async function makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': ARC3_API_KEY,
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ARC3 API request failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return await response.json() as T;
}

async function openScorecard(): Promise<string> {
  const response = await makeRequest<{ card_id: string }>('/api/scorecard/open', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return response.card_id;
}

async function listGames(): Promise<GameInfo[]> {
  return makeRequest<GameInfo[]>('/api/games');
}

async function startGame(gameId: string, cardId: string): Promise<FrameData> {
  return makeRequest<FrameData>('/api/cmd/RESET', {
    method: 'POST',
    body: JSON.stringify({
      game_id: gameId,
      card_id: cardId,
    }),
  });
}

function visualizeGrid(frame: number[][][]): string {
  // ARC3 uses color codes 0-15
  const colorMap: { [key: number]: string } = {
    0: '⬛', // black
    1: '🟦', // blue
    2: '🟥', // red
    3: '🟩', // green
    4: '🟨', // yellow
    5: '⬜', // white/gray
    6: '🟪', // purple
    7: '🟧', // orange
    8: '🟦', // light blue
    9: '🟥', // dark red
    10: '🟩', // light green
    11: '🟨', // light yellow
    12: '⬜', // light gray
    13: '🟪', // magenta
    14: '🟧', // light orange
    15: '⬜', // white
  };

  let output = '';

  // Handle multi-layer frames (typically only layer 0 is used)
  const layer = frame[0] || [];

  for (let y = 0; y < layer.length; y++) {
    const row = layer[y] || [];
    for (let x = 0; x < row.length; x++) {
      const color = row[x] ?? 0;
      output += colorMap[color] || '⬜';
    }
    output += '\n';
  }

  return output;
}

async function main() {
  console.log('🎮 ARC3 GAMES EXPLORER');
  console.log('='.repeat(80));
  console.log('Fetching all available games and their initial states...\n');

  // Open a scorecard (required before starting games)
  console.log('📋 Opening scorecard...');
  const cardId = await openScorecard();
  console.log(`✓ Scorecard opened: ${cardId}\n`);

  // Get list of games
  console.log('📜 Fetching games list...');
  const games = await listGames();
  console.log(`✓ Found ${games.length} games\n`);
  console.log('='.repeat(80));

  // View each game
  for (const game of games) {
    console.log(`\n🎯 Game: ${game.game_id} - "${game.title}"`);
    console.log('-'.repeat(80));

    try {
      const frameData = await startGame(game.game_id, cardId);

      console.log(`   State: ${frameData.state}`);
      console.log(`   Score: ${frameData.score}`);
      console.log(`   Max Actions: ${frameData.max_actions}`);
      console.log(`   Grid Dimensions: ${frameData.frame[0]?.length || 0} rows × ${frameData.frame[0]?.[0]?.length || 0} cols`);
      console.log('\n   Initial Grid:');
      console.log(visualizeGrid(frameData.frame).split('\n').map(line => '   ' + line).join('\n'));

    } catch (error) {
      console.log(`   ❌ Failed to load: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Small delay between games
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '='.repeat(80));
  console.log('✨ Exploration complete!');
}

main().catch(console.error);
