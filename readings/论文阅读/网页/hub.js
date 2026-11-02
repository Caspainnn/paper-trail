/* Explicit reading events only; page visits never create activity. */
(() => {
  'use strict';
  const iso = day => day.toISOString().slice(0, 10);
  function validDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(value)) && iso(new Date(value)) === value;
  }
  function calendar(today) {
    const end = new Date(today + 'T00:00:00Z');
    const first = new Date(end);
    first.setUTCDate(end.getUTCDate() - (end.getUTCDay() + 6) % 7 - 77);
    return Array.from({length:84}, (_, n) => {
      const day = new Date(first); day.setUTCDate(first.getUTCDate() + n);
      return {date:iso(day), future:iso(day) > today};
    });
  }
  function mergeActivity(archived, local, ids, today) {
    const rows = new Map();
    for (const row of [...archived, ...local]) {
      if (!row || !validDate(row.date) || row.date > today || !ids.includes(row.pid)) continue;
      const key = row.date + '/' + row.pid;
      const note = typeof row.note === 'string' ? row.note : '';
      if (!rows.has(key)) rows.set(key, {date:row.date, pid:row.pid, note});
      else if (note && !rows.get(key).note.includes(note)) rows.get(key).note += ' / ' + note;
    }
    return [...rows.values()].sort((a,b) => (a.date+a.pid).localeCompare(b.date+b.pid));
  }
  function pendingActivity(archived, local) {
    return local.filter(row => {
      const saved = archived.find(a => a.date === row.date && a.pid === row.pid);
      return !saved || (row.note && !saved.note.includes(row.note));
    });
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {calendar, mergeActivity, pendingActivity};
  if (typeof document === 'undefined') return;

  const data = JSON.parse(document.getElementById('hub-data').textContent);
  const $ = id => document.getElementById(id);
  const ids = data.papers.map(p => p.pid);
  const today = () => {
    const parts = new Intl.DateTimeFormat('en-US', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const pick = type => parts.find(p => p.type === type).value;
    return `${pick('year')}-${pick('month')}-${pick('day')}`;
  };
  const key = 'paper-reading-activity-v1';
  let storageAvailable = true, local = [], selectedDay = today();
  try {
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(stored)) throw new Error('活动存储格式错误');
    local = mergeActivity([], stored, ids, today());
  } catch (_) {
    storageAvailable = false;
  }
  const events = () => mergeActivity(data.activity, local, ids, today());
  const paperById = pid => data.papers.find(p => p.pid === pid);
  function persist() {
    try {localStorage.setItem(key, JSON.stringify(local));storageAvailable = true;}
    catch (_) {storageAvailable = false;}
  }
  function theme(dark) {
    document.body.classList.toggle('dark', dark);
    const label = dark ? '切换亮色' : '切换暗色';
    $('theme').innerHTML = data.themeIcons[dark ? 'sun' : 'moon'];
    $('theme').title = label;
    $('theme').setAttribute('aria-label', label);
    $('theme').setAttribute('aria-pressed', String(dark));
    drawChart();
  }
  function drawChart() {
    const canvas = $('topic-chart'), ctx = canvas.getContext('2d');
    if (!ctx) return;
    const style = getComputedStyle(document.body), total = data.papers.length;
    ctx.clearRect(0,0,360,360);
    let start = -Math.PI/2;
    data.themes.forEach((t,i) => {
      const end = start + (t.count / Math.max(total,1)) * Math.PI * 2;
      ctx.beginPath(); ctx.arc(180,180,144,start+.008,end-.008);
      ctx.strokeStyle = style.getPropertyValue('--chart'+(i+1)); ctx.lineWidth = 64; ctx.stroke();
      start = end;
    });
  }
  data.themes.forEach((t,i) => {
    const li = document.createElement('li'), a = document.createElement('a'), swatch = document.createElement('span');
    a.href = t.url; swatch.className = 'swatch'; swatch.style.background = `var(--chart${i+1})`;
    const label = document.createElement('span'); label.textContent = t.name;
    const count = document.createElement('strong'); count.textContent = t.count+' 篇';
    a.append(swatch,label,count); li.append(a); $('topic-legend').append(li);
  });
  try {theme(localStorage.getItem('reading-theme') === 'dark');} catch (_) {theme(false);}
  $('theme').onclick = () => {
    const dark = !document.body.classList.contains('dark'); theme(dark);
    try {localStorage.setItem('reading-theme', dark ? 'dark' : 'light');} catch (_) { /* Page remains usable without storage. */ }
  };
  $('current-questions').textContent = data.current.questions + ' 组';
  data.papers.forEach(p => {
    const option = document.createElement('option'); option.value = p.pid; option.textContent = p.pid+' · '+p.title;
    $('activity-paper').append(option);
  });
  function openLog(day) {
    $('activity-date').value = day; $('activity-date').max = today();
    $('activity-paper').value = data.current.pid; $('activity-note').value = '';
    $('form-status').textContent = ''; $('activity-dialog').showModal();
  }
  $('log-open').onclick = () => openLog(today());
  document.querySelectorAll('[data-close]').forEach(button => {button.onclick = () => $(button.dataset.close).close();});
  function showDay(day) {
    selectedDay = day;
    $('day-title').textContent = day + ' · 阅读活动';
    $('day-records').replaceChildren();
    const rows = events().filter(r => r.date === day);
    if (!rows.length) {
      const p = document.createElement('p'); p.textContent = '这一天尚无记录。未记录不等于未阅读。'; $('day-records').append(p);
    }
    for (const row of rows) {
      const article = document.createElement('div'); article.className = 'day-record';
      const p = paperById(row.pid), a = document.createElement('a'); a.href = p.url; a.textContent = p.pid+' · '+p.title;
      const note = document.createElement('p'); note.textContent = row.note || '已确认阅读，未填写摘要。';
      const state = document.createElement('small');
      const archived = data.activity.some(r => r.date === day && r.pid === row.pid);
      const pending = pendingActivity(data.activity, local).some(r => r.date === day && r.pid === row.pid);
      state.textContent = pending ? (archived ? '已归档，有本地补充待导出' : '仅在本浏览器 · 待导出归档') : '已归档至 Markdown';
      article.append(a,note,state);
      if (pending) {
        const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = archived ? '撤销本地补充' : '撤销本地记录';
        remove.onclick = () => {local = local.filter(r => r.date !== day || r.pid !== row.pid);persist();renderCalendar();showDay(day);};
        article.append(remove);
      }
      $('day-records').append(article);
    }
    const add = document.createElement('button'); add.type = 'button'; add.textContent = '补记这一天';
    add.onclick = () => {$('day-dialog').close();openLog(day);}; $('day-records').append(add);
    if (!$('day-dialog').open) $('day-dialog').showModal();
  }
  function renderCalendar() {
    const now = today(), days = calendar(now), rows = events();
    $('calendar-range').textContent = `近12周 · ${days[0].date} 至 ${now}`;
    $('heatmap').replaceChildren(); $('calendar-months').replaceChildren();
    let lastMonth = '';
    for (let week = 0; week < 12; week++) {
      const label = document.createElement('span'), month = days[week*7].date.slice(5,7);
      label.textContent = month !== lastMonth ? Number(month)+'月' : ''; lastMonth = month; $('calendar-months').append(label);
    }
    for (const day of days) {
      const count = rows.filter(r => r.date === day.date).length;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'level-'+Math.min(count,3);
      button.disabled = day.future; button.dataset.date = day.date;
      const label = day.date + (day.future ? ' · 尚未到来' : count ? ` · ${count}篇已记录阅读` : ' · 未记录');
      button.title = label; button.setAttribute('aria-label', label);
      button.onclick = () => showDay(day.date); $('heatmap').append(button);
    }
    const pending = pendingActivity(data.activity, local).length;
    const recent = rows.filter(r => r.date >= days[0].date);
    $('activity-summary').textContent = recent.length ? `近12周有 ${new Set(recent.map(r=>r.date)).size} 个有记录日期 · ${recent.length} 条论文日记录。未记录不等于未阅读。` : '尚无阅读活动记录。未记录不等于未阅读，从一次实际阅读开始。';
    $('storage-status').textContent = storageAvailable ? (pending ? `${pending} 条本地记录待归档；请导出，避免清理浏览器后丢失。` : '') : '浏览器存储不可用或数据异常。本次新记录仅暂存在页面，请立即导出。';
  }
  $('activity-form').onsubmit = event => {
    event.preventDefault();
    const day = $('activity-date').value, pid = $('activity-paper').value;
    if (!validDate(day) || day > today() || !ids.includes(pid)) {$('form-status').textContent = '请选择有效日期与论文，不能记录未来。';return;}
    const existed = events().some(r => r.date === day && r.pid === pid);
    local = mergeActivity(local, [{date:day,pid,note:$('activity-note').value.trim()}], ids, today());
    persist(); renderCalendar(); $('activity-dialog').close(); showDay(day);
    const p = document.createElement('p'); p.className = 'muted';
    p.textContent = existed ? '这篇论文当日已有记录，已合并摘要，篇数不重复增加。' : '已确认记录。导出后可归档至 Markdown。'; $('day-records').prepend(p);
  };
  function markdownExport(rows) {
    const clean = text => text.replaceAll('|','&#124;').replace(/[\r\n]+/g,' ');
    return '# 阅读活动导出\n\n包含已归档及本浏览器记录；按日期与P编号去重。确认后将需要的表格行追加到 readings/阅读活动.md 并重新构建。\n\n| 日期 | P编号 | 摘要 |\n|---|---|---|\n'+rows.map(r=>`| ${r.date} | ${r.pid} | ${clean(r.note)} |`).join('\n')+'\n';
  }
  $('export-activity').onclick = () => {
    const blob = new Blob(['\ufeff'+markdownExport(events())],{type:'text/markdown;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `阅读活动-${today()}.md`; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  };
  $('hub-search').addEventListener('input', () => {
    const q = $('hub-search').value.trim().toLocaleLowerCase();
    $('search-panel').hidden = !q; $('search-results').replaceChildren();
    if (!q) return;
    const found = data.papers.filter(p => (p.pid+' '+p.title+' '+p.search).toLocaleLowerCase().includes(q));
    $('search-status').textContent = found.length ? `找到 ${found.length} 篇相关记录` : '没有找到匹配内容，请换一个关键词。';
    for (const p of found) {
      const a = document.createElement('a'); a.href = p.url; a.textContent = p.pid+' · '+p.title;
      const small = document.createElement('small');
      const at = p.search.toLocaleLowerCase().indexOf(q);
      small.textContent = data.themes.find(t=>t.id===p.theme).name+' · '+p.search.slice(Math.max(0,at-25),Math.max(0,at-25)+140);
      a.append(small); $('search-results').append(a);
    }
  });
  document.querySelector('.search-form').onsubmit = event => event.preventDefault();
  window.addEventListener('storage', event => {
    if (event.key === key) {
      try {const value = JSON.parse(event.newValue || '[]'); if (!Array.isArray(value)) return; local = mergeActivity([],value,ids,today()); renderCalendar();} catch (_) { /* Keep current usable state. */ }
    }
  });
  window.addEventListener('focus', () => renderCalendar());
  renderCalendar();
})();
