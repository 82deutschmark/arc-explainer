/*
  Author: Claude Sonnet 5.5 Medium
  Date: 31-October-2026
  PURPOSE: The small amount of live behaviour in the ARC Daily Digest Weekend Magazine, so the magazine can change
  during the weekend without anyone editing HTML: (1) the red BREAKING bar from data/breaking.json, (2) the latest-news
  ticker from data/ticker.json, (3) a countdown to the final bell, (4) a live top-ten scoreboard that re-reads the
  public board API when it scrolls into view and falls back to the table baked into the page, and (5) the Who's Who
  search box. Everything is optional: with JavaScript off, or any fetch failing, the page still reads correctly from
  the markup that scripts/weekend_magazine.py baked in.
  SRP/DRY check: Pass - presentation of existing data only. The scoreboard maths mirrors scripts/weekend_magazine.py
  (top_rows / reached_time / pretty_et); keep the two in step.
*/
(function () {
  'use strict';
  var BASE = '/specials/weekend/data/';
  var ET = 'America/New_York';

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }
  function getJSON(url, ms) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, ms || 20000) : null;
    return fetch(url, { cache: 'no-cache', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .finally(function () { if (timer) clearTimeout(timer); });
  }
  function bust(url) { return url + (url.indexOf('?') < 0 ? '?' : '&') + 't=' + Math.floor(Date.now() / 60000); }
  function safeHref(url) { return typeof url === 'string' && (url.charAt(0) === '/' || url.indexOf('https://') === 0) ? url : null; }

  /* "Today 2:58 pm", "Thu 2:52 pm" (within a week), "Oct 9, 1:21 am", all Eastern. */
  function pretty(date, now) {
    var f = function (opts) { return new Intl.DateTimeFormat('en-US', Object.assign({ timeZone: ET }, opts)).format(date); };
    var clock = f({ hour: 'numeric', minute: '2-digit' }).toLowerCase();
    var ymd = function (d) { return new Intl.DateTimeFormat('en-CA', { timeZone: ET }).format(d); };
    var days = Math.round((Date.parse(ymd(now) + 'T12:00:00Z') - Date.parse(ymd(date) + 'T12:00:00Z')) / 86400000);
    if (days === 0) return 'Today ' + clock;
    if (days < 7) return f({ weekday: 'short' }) + ' ' + clock;
    return f({ month: 'short', day: 'numeric' }) + ', ' + clock;
  }
  function stamp(date) {
    return new Intl.DateTimeFormat('en-US', { timeZone: ET, weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(date).replace(',', '').toLowerCase().replace(/^(\w)/, function (m) { return m.toUpperCase(); }) + ' ET';
  }

  /* (1) breaking bar */
  function breaking() {
    var bar = document.getElementById('breaking');
    if (!bar) return;
    getJSON(bust(BASE + 'breaking.json'), 8000).then(function (d) {
      if (!d || !d.active || !d.headline) return;
      var wrap = bar.querySelector('.wrap') || bar;
      wrap.textContent = '';
      wrap.appendChild(el('b', '', d.kicker || 'Breaking'));
      wrap.appendChild(el('span', 'h', d.headline));
      if (d.text) wrap.appendChild(el('span', 't', d.text));
      var href = d.link && safeHref(d.link.url);
      if (href) { var a = el('a', '', d.link.text || 'Read more'); a.href = href; wrap.appendChild(a); }
      if (d.at) wrap.appendChild(el('span', 't', stamp(new Date(d.at))));
      bar.classList.add('on');
    }).catch(function () { /* no banner is the safe default */ });
  }

  /* (2) ticker */
  function ticker() {
    var list = document.getElementById('ticker');
    if (!list) return;
    var limit = parseInt(list.getAttribute('data-limit') || '8', 10);
    getJSON(bust(BASE + 'ticker.json'), 8000).then(function (d) {
      var items = (d && d.items || []).slice().sort(function (a, b) { return Date.parse(b.at) - Date.parse(a.at); }).slice(0, limit);
      if (!items.length) return;
      var now = new Date();
      list.textContent = '';
      items.forEach(function (it) {
        var li = el('li');
        li.appendChild(el('time', '', pretty(new Date(it.at), now) + ' ET'));
        var body = el('div');
        if (it.kicker) body.appendChild(el('b', '', it.kicker + '.'));
        body.appendChild(document.createTextNode(it.text || ''));
        var href = it.link && safeHref(it.link.url);
        if (href) { body.appendChild(document.createTextNode(' ')); var a = el('a', '', (it.link.text || 'More') + ' →'); a.href = href; body.appendChild(a); }
        li.appendChild(body);
        list.appendChild(li);
      });
    }).catch(function () { /* keep the baked list */ });
  }

  /* (3) countdown */
  function countdown() {
    var box = document.getElementById('countdown');
    if (!box) return;
    var target = Date.parse(box.getAttribute('data-target'));
    var n = box.querySelector('.n'), l = box.querySelector('.l');
    if (!n || isNaN(target)) return;
    function tick() {
      var s = Math.floor((target - Date.now()) / 1000);
      if (s <= 0) { n.textContent = 'The bell has rung'; if (l) l.textContent = 'Private scoring decides everything'; return false; }
      var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
      n.textContent = (d ? d + 'd ' : '') + h + 'h ' + (m < 10 ? '0' : '') + m + 'm';
      if (l) l.textContent = 'to the final bell';
      return true;
    }
    if (tick()) setInterval(tick, 20000);
  }

  /* (4) live scoreboard */
  function topRows(board, n) {
    var rows = board.latest.rows.slice(0, n), ev = board.events || [];
    return rows.map(function (r) {
      var hits = ev.filter(function (e) { return e.id === r[1] && Math.abs(e.to - r[4]) < 1e-9; });
      return { rank: r[0], id: r[1], name: r[2], score: r[4], members: String(r[6]).split(',').length, prevRank: r[7], prevScore: r[8], reached: hits.length ? new Date(hits[hits.length - 1].t) : null };
    });
  }
  function boardTable(label, board, cfg) {
    var fetched = new Date(board.latest.fetched), now = new Date();
    var table = el('table', 'board');
    table.setAttribute('data-fetched', board.latest.fetched);
    var cap = el('caption', '', label + ' · top ten · as of ' + stamp(fetched));
    table.appendChild(cap);
    topRows(board, 10).forEach(function (r) {
      var tr = el('tr');
      if (cfg.green.indexOf(r.name) >= 0) tr.className = 'nv'; else if (cfg.ours.indexOf(r.name) >= 0) tr.className = 'us';
      tr.appendChild(el('td', '', String(r.rank)));
      var team = el('td'); team.appendChild(document.createTextNode(r.name));
      if (r.rank < r.prevRank) { team.appendChild(document.createTextNode(' ')); team.appendChild(el('span', 'up', '▲' + (r.prevRank - r.rank))); }
      else if (r.rank > r.prevRank) { team.appendChild(document.createTextNode(' ')); team.appendChild(el('span', 'down', '▼' + (r.rank - r.prevRank))); }
      team.appendChild(el('small', '', (r.members === 1 ? 'one-person team' : r.members + ' accounts') + ' · ' + (r.reached ? 'reached ' + pretty(r.reached, now) + ' ET' : 'on the board before our tracker began')));
      tr.appendChild(team);
      var sc = el('td'); sc.appendChild(el('b', '', r.score.toFixed(2)));
      if (r.score - r.prevScore > 0.004) sc.appendChild(el('span', 'gain', ' +' + (r.score - r.prevScore).toFixed(2)));
      tr.appendChild(sc);
      table.appendChild(tr);
    });
    return table;
  }
  function liveBoards() {
    var box = document.getElementById('scoreboard');
    if (!box || typeof IntersectionObserver !== 'function') return;
    var cfg = { green: (box.getAttribute('data-green') || '').split(','), ours: (box.getAttribute('data-ours') || '').split(',') };
    var status = document.getElementById('live-status');
    var started = false;
    new IntersectionObserver(function (entries, obs) {
      if (started || !entries.some(function (e) { return e.isIntersecting; })) return;
      started = true; obs.disconnect();
      var slots = box.querySelectorAll('[data-contest]');
      Promise.all(Array.prototype.map.call(slots, function (slot) {
        var c = slot.getAttribute('data-contest');
        return getJSON('/api/kaggle/arc-prize-2026-arc-agi-' + c + '/board', 30000).then(function (board) { return { slot: slot, board: board }; });
      })).then(function (all) {
        var newest = 0;
        all.forEach(function (x) {
          var old = x.slot.querySelector('table'), baked = old ? Date.parse(old.getAttribute('data-fetched') || '') : 0;
          var fresh = Date.parse(x.board.latest.fetched);
          newest = Math.max(newest, fresh);
          if (!(fresh > baked)) return;
          var label = x.slot.getAttribute('data-label') || x.slot.getAttribute('data-contest').toUpperCase();
          x.slot.textContent = '';
          x.slot.appendChild(boardTable(label, x.board, cfg));
        });
        if (status) { status.textContent = 'Live · board read ' + stamp(new Date(newest)); status.className = 'live on'; }
      }).catch(function () {
        if (status) status.textContent = 'Showing the last saved board';
      });
    }, { rootMargin: '300px' }).observe(box);
  }

  /* (5) who's who search */
  function search() {
    var input = document.getElementById('who-search');
    var table = document.querySelector('table.who');
    if (!input || !table) return;
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      Array.prototype.forEach.call(table.tBodies[0].rows, function (row) {
        row.style.display = !q || row.textContent.toLowerCase().indexOf(q) >= 0 ? '' : 'none';
      });
    });
  }

  breaking(); ticker(); countdown(); liveBoards(); search();
})();
