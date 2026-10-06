/* Author: GPT-6 / Codex
 * Date: 2026-10-05
 * PURPOSE: Compare official human and AI snapshots using sortable metrics, model/configuration
 * selection, outcome filters, and a run inspector. Never counts a partial run as a cheap win.
 * SRP/DRY check: Pass — run selection is shared by cells, sorting and the inspector;
 * completion filters deliberately inspect all runs allowed by the chosen configuration.
 */
(() => {
  'use strict';
  const names = {
    'gpt-6-1-sol': 'GPT-6.1 Sol', 'gpt-6-sol': 'GPT-6 Sol', 'gpt-6-luna': 'GPT-6 Luna',
    'gemini-3.8-flash': 'Gemini 3.8 Flash', 'claude-opus-5': 'Claude Opus 5', 'grok-4.6': 'Grok 4.6',
    'gpt-5-6-sol': 'GPT-5.6 Sol', 'gpt-5-6-terra': 'GPT-5.6 Terra', 'gpt-5-6-luna': 'GPT-5.6 Luna',
    'claude-opus-4-8': 'Claude Opus 4.8', 'claude-opus-4-7': 'Claude Opus 4.7',
    'claude-opus-4-6': 'Claude Opus 4.6', 'gpt-5.5-2026-04-23': 'GPT-5.5',
    'gpt-5.4-2026-03-05': 'GPT-5.4', 'gemini-3.1-pro-preview': 'Gemini 3.1 Pro Preview',
    'grok-4.20-beta-0309-reasoning': 'Grok 4.20 Beta Reasoning',
  };
  const defaultModels = Object.keys(names).slice(0, 6);
  const $ = id => document.getElementById(id);
  const number = value => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
  const exactScore = value => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value) + '%';
  const signed = value => (value >= 0 ? '+' : '−') + number(Math.abs(value));
  const isWin = run => run.state === 'WIN';
  const actionValue = run => Number.isFinite(run.actions) ? run.actions : Infinity;
  const byScore = (a, b) => b.score - a.score || actionValue(a) - actionValue(b) || a.session_id.localeCompare(b.session_id);
  const byActions = (a, b) => actionValue(a) - actionValue(b) || byScore(a, b);
  function make(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function external(text, href) {
    const link = make('a', text);
    link.href = href; link.target = '_blank'; link.rel = 'noopener';
    return link;
  }
  function scoreLabel(value) {
    if (value > 0 && value < 1) return '<1%';
    if (value > 99 && value < 100) return '>99%';
    return number(value) + '%';
  }
  function configLabel(config) {
    const effort = config.match(/-(none|low|medium|high|xhigh|max)(?:-provider-adapter)?$/)?.[1];
    const name = effort ? ({ xhigh: 'XHigh' }[effort] || effort[0].toUpperCase() + effort.slice(1)) : 'Published';
    return name + (config.endsWith('-provider-adapter') ? ' · adapter' : ' · standard');
  }
  let games = [], models = [], configs = new Map();
  let state = { metric: 'score', models: defaultModels, filter: 'all', limit: '', query: '', sort: 'human-best', dir: 'asc', configs: {} };
  function eligible(game, model) {
    const setting = state.configs[model];
    return (game.runs.get(model) || []).filter(run => !setting || run.config === setting);
  }
  function selectedRun(game, model) {
    const runs = eligible(game, model);
    if (state.metric === 'actions') return runs.filter(run => isWin(run) && Number.isFinite(run.actions)).sort(byActions)[0] || null;
    return [...runs].sort(byScore)[0] || null;
  }
  function hasWin(game, model) { return eligible(game, model).some(isWin); }
  function readState() {
    const params = new URLSearchParams(location.search);
    const selected = (params.get('models') || '').split(',').filter(model => models.includes(model));
    if (selected.length) state.models = models.filter(model => selected.includes(model));
    if (params.get('metric') === 'actions') state.metric = 'actions';
    if (['all', 'some-unwon', 'none-won', 'all-won'].includes(params.get('filter'))) state.filter = params.get('filter');
    if (Math.floor(Number(params.get('limit'))) > 0) state.limit = String(Math.floor(Number(params.get('limit'))));
    state.query = (params.get('q') || '').slice(0, 32);
    const sort = params.get('sort');
    if (['game', 'human-best', 'human-average', 'human-gap', ...state.models].includes(sort)) state.sort = sort;
    if (['asc', 'desc'].includes(params.get('dir'))) state.dir = params.get('dir');
    try {
      const saved = JSON.parse(params.get('configs') || '{}');
      if (saved && typeof saved === 'object') for (const model of models) {
        if (configs.get(model).includes(saved[model])) state.configs[model] = saved[model];
      }
    } catch (_) { /* Invalid bookmarked settings simply use best available. */ }
  }
  function saveState() {
    const url = new URL(location.href);
    const values = { metric: state.metric, models: state.models.join(','), filter: state.filter, limit: state.limit,
      q: state.query, sort: state.sort, dir: state.dir, configs: Object.keys(state.configs).length ? JSON.stringify(state.configs) : '' };
    for (const [key, value] of Object.entries(values)) value ? url.searchParams.set(key, value) : url.searchParams.delete(key);
    history.replaceState(null, '', url);
  }
  function humanValue(game, key) {
    return ({ 'human-best': game.best, 'human-average': game.average, 'human-gap': game.average - game.best })[key];
  }
  function sortValue(game) {
    if (state.sort === 'game') return game.id;
    if (state.sort.startsWith('human-')) return humanValue(game, state.sort);
    const run = selectedRun(game, state.sort);
    return run ? (state.metric === 'actions' ? run.actions : run.score) : null;
  }
  function visibleGames() {
    return games.filter(game => {
      if (!game.id.includes(state.query.toLowerCase().trim())) return false;
      if (state.limit && game.best > Number(state.limit)) return false;
      if (state.filter === 'all') return true;
      // Missing configurations are unknown, not evidence of failure.
      if (!state.models.every(model => eligible(game, model).length)) return false;
      const wins = state.models.map(model => hasWin(game, model));
      if (state.filter === 'none-won') return !wins.some(Boolean);
      if (state.filter === 'all-won') return wins.every(Boolean);
      return !wins.every(Boolean);
    }).sort((a, b) => {
      const x = sortValue(a), y = sortValue(b);
      if (x === null || y === null) return x === y ? a.best - b.best || a.id.localeCompare(b.id) : x === null ? 1 : -1;
      const order = typeof x === 'string' ? x.localeCompare(y) : x - y;
      return (state.dir === 'asc' ? order : -order) || a.best - b.best || a.id.localeCompare(b.id);
    });
  }
  function sortHeader(key, label, className) {
    const cell = make('th', undefined, className); cell.scope = 'col';
    const current = state.sort === key;
    cell.setAttribute('aria-sort', current ? state.dir === 'asc' ? 'ascending' : 'descending' : 'none');
    const button = make('button', label + (current ? state.dir === 'asc' ? ' ↑' : ' ↓' : ''), 'sort-button');
    button.type = 'button';
    button.addEventListener('click', () => {
      state.dir = current ? (state.dir === 'asc' ? 'desc' : 'asc') : key === 'human-gap' || (models.includes(key) && state.metric === 'score') ? 'desc' : 'asc';
      state.sort = key; render(); saveState();
    });
    cell.append(button); return cell;
  }
  function renderHeader() {
    const row = make('tr');
    row.append(sortHeader('game', 'Game', 'game-heading'), sortHeader('human-best', 'Human best', 'human-heading'));
    const average = sortHeader('human-average', 'Human avg', 'human-heading'); average.append(make('small', 'top-10 wins', 'header-note'));
    row.append(average, sortHeader('human-gap', 'Avg − best', 'human-heading'));
    for (const model of state.models) {
      const th = sortHeader(model, names[model] || model, 'model-heading');
      const covered = games.filter(game => eligible(game, model).length).length;
      const wins = games.filter(game => hasWin(game, model)).length;
      th.append(make('small', `${wins}/${covered} games won`, 'header-note'));
      if (configs.get(model).length > 1) {
        const select = make('select', undefined, 'config-select'); select.setAttribute('aria-label', `Configuration for ${names[model] || model}`);
        const best = make('option', 'Best available'); best.value = ''; select.append(best);
        for (const config of configs.get(model)) { const option = make('option', configLabel(config)); option.value = config; select.append(option); }
        select.value = state.configs[model] || '';
        select.addEventListener('change', () => { if (select.value) state.configs[model] = select.value; else delete state.configs[model]; render(); updatePickerCounts(); saveState(); });
        th.append(select);
      } else th.append(make('span', configLabel(configs.get(model)[0]), 'single-config'));
      row.append(th);
    }
    $('comparison').tHead.replaceChildren(row);
  }
  function resultCell(game, model) {
    const td = make('td'), runs = eligible(game, model), run = selectedRun(game, model);
    if (!runs.length) { td.append(make('span', 'No result', 'missing')); return td; }
    const button = make('button', undefined, 'result-button'); button.type = 'button';
    if (!run) {
      button.classList.add('no-win');
      const completed = Math.max(...runs.map(item => item.levels_completed));
      const missingActions = runs.some(isWin);
      button.append(make('strong', missingActions ? 'Count unavailable' : 'No win'), make('small', missingActions ? 'Winning run has no action count' : `Best progress ${completed}/${game.levels}`));
    } else if (state.metric === 'actions') {
      button.style.setProperty('--fill', '100%');
      button.append(make('strong', number(run.actions)), make('small', `${signed(run.actions - game.best)} vs human best`, 'win'));
    } else {
      button.style.setProperty('--fill', `${Math.max(0, Math.min(100, run.score))}%`);
      button.append(make('strong', scoreLabel(run.score)));
      const progress = isWin(run) ? 'WIN' : `${run.levels_completed}/${game.levels} levels`;
      const actions = Number.isFinite(run.actions) ? `${number(run.actions)} actions` : 'actions unavailable';
      button.append(make('small', `${progress} · ${actions}`, isWin(run) ? 'win' : undefined));
      if (!isWin(run) && runs.some(isWin)) button.append(make('small', 'Win in another run', 'other-win'));
    }
    button.setAttribute('aria-label', `${game.id}, ${names[model] || model}: ${button.textContent}. Open published runs.`);
    if (run) button.title = `${exactScore(run.score)}; ${run.config}; ${run.state}`;
    button.addEventListener('click', () => showRuns(game, model));
    td.append(button); return td;
  }
  function render() {
    renderHeader();
    const visible = visibleGames(), body = $('comparison').tBodies[0], fragment = document.createDocumentFragment();
    for (const game of visible) {
      const row = make('tr'), label = make('th'); label.scope = 'row';
      label.append(external(game.id, `https://arcprize.org/tasks/${encodeURIComponent(game.id)}#model-performance`));
      row.append(label, make('td', number(game.best), 'human-cell'), make('td', number(game.average), 'human-cell'), make('td', signed(game.average-game.best), 'human-gap'));
      for (const model of state.models) row.append(resultCell(game, model));
      fragment.append(row);
    }
    body.replaceChildren(fragment);
    $('empty-state').hidden = visible.length > 0;
    $('model-count').textContent = `Choose models · ${state.models.length} of ${models.length} shown`;
    const sortName = ({ game: 'game ID', 'human-best': 'human best', 'human-average': 'human average', 'human-gap': 'human average gap' })[state.sort] || names[state.sort] || state.sort;
    $('results-status').textContent = `${visible.length} of ${games.length} games · sorted by ${sortName}, ${state.dir === 'asc' ? 'low to high' : 'high to low'}`;
    $('metric-explanation').textContent = state.metric === 'score'
      ? 'Higher score is better. Each cell shows the highest-scoring eligible run, with its completion and actions. Column win counts cover the full 25-game set.'
      : 'Fewer actions is better. Each cell shows the shortest eligible full-game win and its extra actions versus the human best. No win means no published full-game win in those settings.';
    document.querySelectorAll('[data-metric]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.metric === state.metric)));
  }
  function updatePickerCounts() {
    document.querySelectorAll('#model-options label').forEach(label => {
      const model = label.querySelector('input').value;
      label.querySelector('small').textContent = `${games.filter(game => hasWin(game, model)).length} wins`;
    });
  }
  function buildPicker() {
    const fragment = document.createDocumentFragment();
    for (const model of models) {
      const label = make('label'), input = make('input'); input.type = 'checkbox'; input.value = model; input.checked = state.models.includes(model);
      label.append(input, make('span', names[model] || model), make('small'));
      input.addEventListener('change', () => {
        const selected = [...document.querySelectorAll('#model-options input:checked')].map(item => item.value);
        if (!selected.length) { input.checked = true; $('results-status').textContent = 'Keep at least one model selected.'; return; }
        state.models = selected;
        if (models.includes(state.sort) && !selected.includes(state.sort)) { state.sort = 'human-best'; state.dir = 'asc'; }
        render(); saveState();
      });
      fragment.append(label);
    }
    $('model-options').replaceChildren(fragment); updatePickerCounts();
  }
  function syncControls() {
    $('game-filter').value = state.filter; $('action-limit').value = state.limit; $('game-search').value = state.query;
  }
  function showRuns(game, model) {
    const chosen = selectedRun(game, model), currentConfig = state.configs[model];
    const all = [...(game.runs.get(model) || [])].sort((a,b) => state.metric === 'actions' ? Number(isWin(b))-Number(isWin(a)) || (isWin(a) && isWin(b) ? byActions(a,b) : byScore(a,b)) : byScore(a,b));
    $('run-title').textContent = `${game.id} · ${names[model] || model}`;
    $('run-context').textContent = `Human best: ${number(game.best)} actions. Top-10 average: ${number(game.average)} actions. ${game.levels} levels.`;
    $('run-selection').textContent = chosen
      ? `Highlighted: ${state.metric === 'score' ? 'highest score' : 'fewest actions in a complete win'} under ${currentConfig ? configLabel(currentConfig) : 'best available settings'}.`
      : 'No complete winning action count in the selected settings. All published configurations are listed below.';
    const body = $('run-table').tBodies[0]; body.replaceChildren();
    for (const run of all) {
      const row = make('tr');
      if (chosen?.session_id === run.session_id) row.classList.add('selected-run');
      if (currentConfig && currentConfig !== run.config) row.classList.add('excluded-run');
      const config = make('td'); config.append(make('strong', configLabel(run.config)), make('small', run.config, 'config-id'));
      if (currentConfig && currentConfig !== run.config) config.append(make('small', 'Outside current setting'));
      const day = new Date(run.published_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric', timeZone:'America/New_York' });
      config.append(make('small', `${day} · game version ${run.game_version}`));
      const completed = isWin(run) ? `WIN · ${game.levels}/${game.levels}` : `${run.levels_completed}/${game.levels}`;
      const actions = make('td', Number.isFinite(run.actions) ? number(run.actions) : 'Unavailable');
      if (isWin(run) && Number.isFinite(run.actions)) actions.append(make('small', `${signed(run.actions-game.best)} vs human best`));
      const replay = make('td'); replay.append(external('Replay ↗', `https://arcprize.org/replay/${encodeURIComponent(run.session_id)}`));
      row.append(config, make('td', exactScore(run.score)), make('td', completed), actions, replay); body.append(row);
    }
    $('run-note').textContent = `${all.length} published runs. Human and AI runs come from separate published sources; game version and configuration are preserved here. A score is not a completion percentage.`;
    $('run-dialog').showModal();
  }
  async function start() {
    try {
      const [human, ai] = await Promise.all(['./static/human-records-2026-10-05.json', './static/ai-game-results-2026-10-05.json'].map(async url => {
        const response = await fetch(url); if (!response.ok) throw new Error('Source data unavailable'); return response.json();
      }));
      const published = ai.games.flatMap(game => game.runs).filter(run => run.verified_publish === true && Number.isFinite(run.score));
      const found = new Set(published.map(run => run.model));
      models = [...Object.keys(names).filter(model => found.has(model)), ...[...found].filter(model => !names[model]).sort()];
      configs = new Map(models.map(model => [model, [...new Set(published.filter(run => run.model === model).map(run => run.config))].sort((a,b) => configLabel(a).localeCompare(configLabel(b)))]));
      const aiById = new Map(ai.games.map(game => [game.game, game]));
      games = human.games.map(h => {
        const winners = h.entries.filter(run => run.score === 100 && run.end_state === 'WIN');
        const runs = (aiById.get(h.game)?.runs || []).filter(run => run.verified_publish === true && Number.isFinite(run.score));
        const best = Math.min(...winners.map(run => run.actions));
        const average = Math.round(winners.reduce((sum, run) => sum + run.actions, 0) / winners.length);
        return { id: h.game, best, average,
          levels: Math.max(0, ...runs.map(run => Math.max(run.number_of_levels || 0, run.level_scores?.length || 0, run.level_baseline_actions?.length || 0))),
          runs: new Map(models.map(model => [model, runs.filter(run => run.model === model)])) };
      });
      state.models = defaultModels.filter(model => models.includes(model));
      if (!state.models.length) state.models = models.slice(0, 6);
      readState(); syncControls(); buildPicker(); render();
      document.querySelectorAll('[data-metric]').forEach(button => button.addEventListener('click', () => {
        state.metric = button.dataset.metric;
        if (models.includes(state.sort)) state.dir = state.metric === 'actions' ? 'asc' : 'desc';
        render(); saveState();
      }));
      $('game-filter').addEventListener('change', event => { state.filter = event.target.value; render(); saveState(); });
      $('action-limit').addEventListener('input', event => { state.limit = Math.floor(Number(event.target.value)) > 0 ? String(Math.floor(Number(event.target.value))) : ''; render(); saveState(); });
      $('game-search').addEventListener('input', event => { state.query = event.target.value; render(); saveState(); });
      $('all-models').addEventListener('click', () => { state.models = [...models]; buildPicker(); render(); saveState(); });
      $('default-models').addEventListener('click', () => { state.models = defaultModels.filter(model => models.includes(model)); if (models.includes(state.sort) && !state.models.includes(state.sort)) { state.sort = 'human-best'; state.dir = 'asc'; } buildPicker(); render(); saveState(); });
      $('reset-view').addEventListener('click', () => { state = { metric:'score', models:defaultModels.filter(model => models.includes(model)), filter:'all', limit:'', query:'', sort:'human-best', dir:'asc', configs:{} }; syncControls(); buildPicker(); render(); saveState(); });
      $('close-dialog').addEventListener('click', () => $('run-dialog').close());
    } catch (error) {
      $('results-status').setAttribute('role', 'alert');
      $('results-status').textContent = 'The saved results could not be loaded. Reload the page or use the source-data links below.';
      $('metric-explanation').textContent = '';
    }
  }
  start();
})();
