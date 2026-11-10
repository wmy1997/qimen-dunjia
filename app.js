// 奇门遁甲排盘 —— 主逻辑（纯前端，3meta 内核）
(function () {
  'use strict';

  var ThreeMeta = window.ThreeMeta;
  var app = document.getElementById('grid');
  if (!ThreeMeta || !app) {
    document.body.insertAdjacentHTML('beforeend',
      '<p style="color:#e06c6c;text-align:center;padding:20px;">3meta 内核加载失败，请检查 vendor/3meta.min.js</p>');
    return;
  }

  // 九宫展示顺序（上南下北，行优先）：巽四 离九 坤二 / 震三 中五 兑七 / 艮八 坎一 乾六
  var PALACE_ORDER = [4, 9, 2, 3, 5, 7, 8, 1, 6];

  var PALACE_NAME = {
    1: { name: '坎一宫', dir: '北' },
    2: { name: '坤二宫', dir: '西南' },
    3: { name: '震三宫', dir: '东' },
    4: { name: '巽四宫', dir: '东南' },
    5: { name: '中五宫', dir: '中' },
    6: { name: '乾六宫', dir: '西北' },
    7: { name: '兑七宫', dir: '西' },
    8: { name: '艮八宫', dir: '东北' },
    9: { name: '离九宫', dir: '南' }
  };

  // 天干五行（用于生克判断）
  var STEM_WUXING = {
    '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土',
    '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水'
  };

  // —— 问事分类与用神映射（时家奇门常用用神）——
  var ASK_CATEGORIES = ['综合', '事业', '财运', '婚姻', '健康', '学业', '出行', '官司', '寻物'];
  var currentCategory = '综合';
  var currentChart = null;
  var currentQuestion = '';
  var currentContext = '';
  var currentHistoryId = null; // 当前问卦在历史记录里的 id（未保存为 null）

  var YONGSHEN_MAP = {
    '综合': [
      { label: '值符·贵神大环境', kind: 'zhiFu' },
      { label: '值使·事体主导', kind: 'zhiShi' },
      { label: '日干·自己', kind: 'dayStem' },
      { label: '时干·所问之事', kind: 'hourStem' }
    ],
    '事业': [
      { label: '开门·工作官职', kind: 'gate', name: '开门' },
      { label: '值符·领导贵人', kind: 'zhiFu' },
      { label: '日干·自己', kind: 'dayStem' },
      { label: '天辅·文职学历', kind: 'star', name: '天辅' }
    ],
    '财运': [
      { label: '生门·财门', kind: 'gate', name: '生门' },
      { label: '戊·资本财星', kind: 'heavenStem', name: '戊' },
      { label: '日干·自己', kind: 'dayStem' },
      { label: '值使·事体', kind: 'zhiShi' }
    ],
    '婚姻': [
      { label: '六合·婚姻和合', kind: 'deity', name: '六合' },
      { label: '乙·女方', kind: 'heavenStem', name: '乙' },
      { label: '庚·男方', kind: 'heavenStem', name: '庚' },
      { label: '休门·家庭', kind: 'gate', name: '休门' }
    ],
    '健康': [
      { label: '天芮·病星', kind: 'star', name: '天芮' },
      { label: '天心·医药', kind: 'star', name: '天心' },
      { label: '日干·病体', kind: 'dayStem' },
      { label: '乙·医药', kind: 'heavenStem', name: '乙' }
    ],
    '学业': [
      { label: '景门·文书考试', kind: 'gate', name: '景门' },
      { label: '丁·文书证书', kind: 'heavenStem', name: '丁' },
      { label: '天辅·文昌', kind: 'star', name: '天辅' },
      { label: '日干·自己', kind: 'dayStem' }
    ],
    '出行': [
      { label: '日干·自己', kind: 'dayStem' },
      { label: '开门·所去之地', kind: 'gate', name: '开门' },
      { label: '驿马·动向', kind: 'postHorse' },
      { label: '时干·事体', kind: 'hourStem' }
    ],
    '官司': [
      { label: '惊门·诉讼口舌', kind: 'gate', name: '惊门' },
      { label: '值符·原告主审', kind: 'zhiFu' },
      { label: '玄武·小人欺诈', kind: 'deity', name: '玄武' },
      { label: '日干·自己', kind: 'dayStem' }
    ],
    '寻物': [
      { label: '时干·失物', kind: 'hourStem' },
      { label: '值使·去向', kind: 'zhiShi' },
      { label: '日干·自己', kind: 'dayStem' },
      { label: '伤门·可寻', kind: 'gate', name: '伤门' }
    ]
  };

  function hasName(v, name) {
    if (Array.isArray(v)) return v.indexOf(name) >= 0;
    return v === name;
  }

  function findPalace(palaces, test) {
    for (var i = 0; i < palaces.length; i++) {
      if (test(palaces[i])) return palaces[i];
    }
    return null;
  }

  function locateStem(chart, stem) {
    var p = findPalace(chart.palaces, function (p) { return hasName(p.heavenlyStem, stem); });
    if (p) return { palace: p, note: '天盘' };
    var p2 = findPalace(chart.palaces, function (p) { return hasName(p.earthlyStem, stem); });
    return { palace: p2, note: '地盘' };
  }

  function locateYongShen(chart, item) {
    switch (item.kind) {
      case 'gate':
        return { palace: findPalace(chart.palaces, function (p) { return p.gate === item.name; }) };
      case 'star':
        return { palace: findPalace(chart.palaces, function (p) { return hasName(p.star, item.name); }) };
      case 'deity':
        return { palace: findPalace(chart.palaces, function (p) { return p.deity === item.name; }) };
      case 'heavenStem':
        return { palace: findPalace(chart.palaces, function (p) { return hasName(p.heavenlyStem, item.name); }) };
      case 'earthStem':
        return { palace: findPalace(chart.palaces, function (p) { return hasName(p.earthlyStem, item.name); }) };
      case 'dayStem':
        return locateStem(chart, chart.fourPillars.day.stem);
      case 'hourStem':
        return locateStem(chart, chart.fourPillars.hour.stem);
      case 'zhiFu':
        return { palace: palaceByPos(chart, Number(chart.zhiFu.position)) };
      case 'zhiShi':
        return { palace: palaceByPos(chart, Number(chart.zhiShi.position)) };
      case 'postHorse':
        return { palace: palaceByPos(chart, Number(chart.postHorse.position)) };
      default:
        return { palace: null };
    }
  }

  function fmt(v) {
    if (Array.isArray(v)) return v.join('');
    if (v === undefined || v === null) return '';
    return String(v);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function palaceByPos(chart, pos) {
    for (var i = 0; i < chart.palaces.length; i++) {
      if (chart.palaces[i].position === pos) return chart.palaces[i];
    }
    return null;
  }

  function hiddenStemOf(chart, pos) {
    var hs = chart.hiddenStems;
    if (hs && typeof hs.get === 'function') return hs.get(pos);
    if (hs && hs[pos]) return hs[pos];
    return '';
  }

  function buildChart(d) {
    // 正时起局：以当前时刻定节气/阴阳遁/局数（fromSolar 显式传本地时间分量避免时区歧义）
    currentChart = ThreeMeta.QimenChart.fromSolar(
      d.getFullYear(), d.getMonth() + 1, d.getDate(),
      d.getHours(), d.getMinutes(), d.getSeconds());
    render(currentChart);
  }

  function render(chart) {
    renderHeader(chart);
    renderGrid(chart);
    renderYongShen(chart);
    renderPatterns(chart);
  }

  function renderHeader(chart) {
    var t = chart.timeInfo;
    var fp = chart.fourPillars;
    var ju = chart.ju;

    document.getElementById('fourPillars').innerHTML =
      '<span class="pillar">' + fp.year.stem + fp.year.branch + '年</span>' +
      '<span class="pillar">' + fp.month.stem + fp.month.branch + '月</span>' +
      '<span class="pillar">' + fp.day.stem + fp.day.branch + '日</span>' +
      '<span class="pillar">' + fp.hour.stem + fp.hour.branch + '时</span>';

    document.getElementById('juInfo').innerHTML =
      '<div class="ju-badge">' + ju.type + ju.number + '局</div>' +
      '<div class="ju-sub">' + chart.yuan + ' · ' + (chart.season || '') + '</div>';

    document.getElementById('solarInfo').textContent =
      t.solarDate + '（' + t.lunarDate + '）' +
      (t.solarTerm ? ' · 节气 ' + t.solarTerm : '') +
      ' · ' + t.xunShou + '旬 · 空亡 ' + t.voidness.join('');

    document.getElementById('dutyInfo').textContent =
      '值符 ' + fmt(chart.zhiFu.star) + ' 落' + chart.zhiFu.position + '宫' +
      ' · 值使 ' + fmt(chart.zhiShi.gate) + ' 落' + chart.zhiShi.position + '宫' +
      ' · 驿马 ' + chart.postHorse.branch + '（' + chart.postHorse.position + '宫）';
  }

  function renderGrid(chart) {
    var grid = document.getElementById('grid');
    grid.innerHTML = '';
    for (var i = 0; i < PALACE_ORDER.length; i++) {
      var p = palaceByPos(chart, PALACE_ORDER[i]);
      grid.appendChild(renderPalace(chart, p));
    }
  }

  function renderPalace(chart, p) {
    var cell = document.createElement('div');
    cell.className = 'palace';
    var info = PALACE_NAME[p.position];

    var marks = [];
    if (p.isZhiFu) marks.push('值符');
    if (p.isZhiShi) marks.push('值使');
    if (p.voidness && p.voidness.hasVoidness) marks.push('空亡');
    // 注意：3meta 的 palace.isPostHorse 恒为 false；且 postHorse.position 是 string、palace.position 是 number，须转数值比较
    if (p.position === Number(chart.postHorse.position)) marks.push('驿马');
    if (p.liuYiJiXing && p.liuYiJiXing.hasJiXing) marks.push('击刑');
    if (p.gatePressure === '迫') marks.push('门迫');
    else if (p.gatePressure === '制') marks.push('门制');
    var tomb = p.tombInfo;
    if (tomb && ((tomb.heavenlyStemInTomb && tomb.heavenlyStemInTomb.length) ||
                 (tomb.earthlyStemInTomb && tomb.earthlyStemInTomb.length))) {
      marks.push('入墓');
    }
    var ausp = (p.auspiciousPatterns || []).length;
    var inausp = (p.inauspiciousPatterns || []).length;
    if (ausp) marks.push('吉' + ausp);
    if (inausp) marks.push('凶' + inausp);

    var markHtml = marks.length
      ? '<div class="marks">' + marks.map(function (m) {
          var cls = (m.indexOf('凶') === 0 || m === '击刑' || m === '门迫' || m === '入墓') ? '' : ' good';
          return '<span class="mark' + cls + '">' + m + '</span>';
        }).join('') + '</div>'
      : '';

    var hidden = hiddenStemOf(chart, p.position);

    cell.innerHTML =
      '<div class="palace-head"><span class="pname">' + info.name + '</span>' +
      '<span class="pdir">' + info.dir + '·' + p.fiveElements + '</span></div>' +
      '<div class="deity' + (p.deity === '值符' ? ' zhibu' : '') + '">' + fmt(p.deity) + '</div>' +
      '<div class="star">' + fmt(p.star) + '</div>' +
      '<div class="gate">' + fmt(p.gate) + '</div>' +
      '<div class="stems"><span class="heaven">' + fmt(p.heavenlyStem) + '</span>' +
      '<span class="earth">' + fmt(p.earthlyStem) + '</span></div>' +
      '<div class="hidden">暗 ' + fmt(hidden) + '</div>' +
      '<div class="branch">' + fmt(p.earthBranch) + '</div>' +
      markHtml;

    return cell;
  }

  function fmtPatternName(x) {
    return x.name || x.type || x.id || '';
  }

  function renderPatterns(chart) {
    var sp = chart.specialPatterns || {};
    var box = document.getElementById('patterns');
    var lines = [];

    if (sp.wuBuYuShi && sp.wuBuYuShi.isWuBuYuShi) lines.push('⚠️ 五不遇时（时干克日干，主凶）');
    var menPo = sp.menPo || [];
    if (menPo.length) {
      lines.push('门迫门制：' + menPo.map(function (m) {
        return m.gate + m.gatePressure + m.position + '宫';
      }).join('、'));
    }
    var ausp = sp.auspiciousPatterns || [];
    var inausp = sp.inauspiciousPatterns || [];
    if (ausp.length) lines.push('吉格：' + ausp.map(fmtPatternName).join('、'));
    if (inausp.length) lines.push('凶格：' + inausp.map(fmtPatternName).join('、'));

    box.innerHTML = lines.length
      ? lines.map(function (l) { return '<div class="pattern-line">' + l + '</div>'; }).join('')
      : '<div class="pattern-line muted">（无特殊格局）</div>';
  }

  function ysBadges(chart, p) {
    var b = [];
    if (p.isZhiFu) b.push('值符');
    if (p.isZhiShi) b.push('值使');
    if (p.voidness && p.voidness.hasVoidness) b.push('空亡');
    if (p.position === Number(chart.postHorse.position)) b.push('驿马');
    if (p.liuYiJiXing && p.liuYiJiXing.hasJiXing) b.push('击刑');
    if (p.gatePressure === '迫') b.push('门迫');
    else if (p.gatePressure === '制') b.push('门制');
    var tomb = p.tombInfo;
    if (tomb && ((tomb.heavenlyStemInTomb && tomb.heavenlyStemInTomb.length) ||
                 (tomb.earthlyStemInTomb && tomb.earthlyStemInTomb.length))) b.push('入墓');
    return b;
  }

  function ysCardHtml(chart, item, loc) {
    var p = loc.palace;
    var title = item.label;
    if (!p) {
      return '<div class="ys-card"><div class="ys-title">' + title +
        '</div><div class="ys-body muted">未定位到落宫</div></div>';
    }
    var info = PALACE_NAME[p.position];
    var status = p.status || {};
    var badges = ysBadges(chart, p);
    var ausp = (p.auspiciousPatterns || []).map(fmtPatternName);
    var inausp = (p.inauspiciousPatterns || []).map(fmtPatternName);
    var resp = (p.tenStemResponse && p.tenStemResponse.heavenlyToEarthly) ? p.tenStemResponse.heavenlyToEarthly : null;

    var badgeHtml = badges.length
      ? '<div class="ys-badges">' + badges.map(function (b) {
          return '<span class="ys-badge">' + b + '</span>';
        }).join('') + '</div>' : '';

    var patHtml = [];
    if (ausp.length) patHtml.push('<span class="ys-good">吉：' + ausp.join('、') + '</span>');
    if (inausp.length) patHtml.push('<span class="ys-bad">凶：' + inausp.join('、') + '</span>');

    var respHtml = resp
      ? '<div class="ys-resp">干应：' + resp.description + '（' + resp.relation + '）</div>' : '';

    return '<div class="ys-card">' +
      '<div class="ys-title">' + title + ' <span class="ys-loc">→ ' + info.name + '·' + info.dir + '</span></div>' +
      '<div class="ys-wang">星 ' + (status.star || '-') + ' · 门 ' + (status.gate || '-') + '</div>' +
      badgeHtml +
      (patHtml.length ? '<div class="ys-pats">' + patHtml.join(' ') + '</div>' : '') +
      respHtml +
      '</div>';
  }

  function renderYongShen(chart) {
    var box = document.getElementById('yongshen');
    if (!box) return;
    var items = YONGSHEN_MAP[currentCategory] || [];
    if (!items.length) { box.innerHTML = ''; return; }
    var html = '';
    for (var i = 0; i < items.length; i++) {
      var loc = locateYongShen(chart, items[i]);
      html += ysCardHtml(chart, items[i], loc);
    }
    box.innerHTML = html;
  }

  function renderAskChips() {
    var box = document.getElementById('askChips');
    if (!box) return;
    box.innerHTML = '';
    for (var i = 0; i < ASK_CATEGORIES.length; i++) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip' + (ASK_CATEGORIES[i] === currentCategory ? ' active' : '');
      chip.textContent = ASK_CATEGORIES[i];
      (function (cat, el) {
        el.addEventListener('click', function () {
          currentCategory = cat;
          var kids = box.children;
          for (var j = 0; j < kids.length; j++) kids[j].className = 'chip';
          el.className = 'chip active';
          if (currentChart) renderYongShen(currentChart);
          if (currentHistoryId) updateHistoryEntry(currentHistoryId, { category: cat });
        });
      })(ASK_CATEGORIES[i], chip);
      box.appendChild(chip);
    }
  }

  function renderQiuSummary() {
    var box = document.getElementById('qiuSummary');
    if (!box) return;
    var tags = [];
    tags.push('时间起局');
    if (currentQuestion) tags.push('问：' + currentQuestion);
    if (currentContext) tags.push('补充：' + currentContext);
    if (tags.length) {
      box.innerHTML = tags.map(function (t) {
        return '<span class="qiu-tag">' + esc(t) + '</span>';
      }).join('');
      box.classList.remove('u-hidden');
    } else {
      box.classList.add('u-hidden');
    }
  }

  function castDivination() {
    currentQuestion = document.getElementById('question').value.trim();
    currentContext = document.getElementById('context').value.trim();

    // 起局时间 = 点击「开始排盘」的当前时刻（正时起局）
    var d = new Date();

    buildChart(d);
    renderQiuSummary();

    // 清空上一次解读，避免新盘配旧解读
    var interpOut = document.getElementById('interpOut');
    if (interpOut) interpOut.innerHTML = '';

    // 阶段4：保存历史记录
    var entry = {
      id: Date.now(),
      ts: d.getTime(),
      question: currentQuestion,
      context: currentContext,
      category: currentCategory,
      ju: currentChart.ju.type + currentChart.ju.number + '局',
      interp: null
    };
    currentHistoryId = entry.id;
    addHistoryEntry(entry);
    renderHistoryList();

    var panel = document.querySelector('.info-panel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // —— 阶段4：历史记录 + PWA ——
  var HISTORY_KEY = 'qimen_history_v1';
  var HISTORY_MAX = 50;

  function loadHistory() {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function saveHistory(arr) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(arr)); } catch (e) {}
  }

  function addHistoryEntry(entry) {
    var arr = loadHistory();
    arr.unshift(entry);
    if (arr.length > HISTORY_MAX) arr = arr.slice(0, HISTORY_MAX);
    saveHistory(arr);
  }

  function updateHistoryEntry(id, patch) {
    var arr = loadHistory();
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === id) {
        for (var k in patch) {
          if (Object.prototype.hasOwnProperty.call(patch, k)) arr[i][k] = patch[k];
        }
        break;
      }
    }
    saveHistory(arr);
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function historyItemHtml(e) {
    var d = new Date(e.ts);
    var time = pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    var title = e.question || (e.category || '综合') + '类问事';
    return '<button class="hist-item" type="button" data-id="' + e.id + '">' +
      '<div class="hist-title">' + esc(title) + (e.interp ? '<span class="hist-tag">已解读</span>' : '') + '</div>' +
      '<div class="hist-meta">' + time + ' · ' + (e.ju || '') + '</div>' +
      '</button>';
  }

  function renderHistoryList() {
    var list = document.getElementById('historyList');
    if (!list) return;
    var arr = loadHistory();
    if (!arr.length) {
      list.innerHTML = '<div class="hist-empty">暂无历史记录</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < arr.length; i++) html += historyItemHtml(arr[i]);
    list.innerHTML = html;
  }

  function setCategoryChip(cat) {
    currentCategory = cat;
    var box = document.getElementById('askChips');
    if (!box) return;
    var kids = box.children;
    for (var i = 0; i < kids.length; i++) {
      kids[i].className = 'chip' + (kids[i].textContent === cat ? ' active' : '');
    }
  }

  function loadHistoryEntry(id) {
    var arr = loadHistory();
    var e = null;
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) { e = arr[i]; break; }
    if (!e) return;

    currentHistoryId = e.id;
    currentQuestion = e.question || '';
    currentContext = e.context || '';
    currentCategory = e.category || '综合';

    document.getElementById('question').value = currentQuestion;
    document.getElementById('context').value = currentContext;
    setCategoryChip(currentCategory);

    // 用保存的起局时刻重排盘（奇门排盘确定性：同时刻→同盘）
    var d = new Date(e.ts);
    currentChart = ThreeMeta.QimenChart.fromSolar(
      d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
    render(currentChart);
    renderQiuSummary();

    // 恢复解读（若有）
    var out = document.getElementById('interpOut');
    if (out) {
      out.innerHTML = e.interp
        ? '<details class="reason-box" open><summary>深度思考过程</summary><div class="reason-body">' + esc(e.interp.reasoning || '') + '</div></details>' +
          '<div class="answer-box">' + mdToHtml(e.interp.answer || '') + '</div>'
        : '';
    }

    document.getElementById('historyPanel').classList.add('u-hidden');
    var panel = document.querySelector('.info-panel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function initHistory() {
    var btn = document.getElementById('btnHistory');
    if (btn) btn.addEventListener('click', function () {
      renderHistoryList();
      var panel = document.getElementById('historyPanel');
      panel.classList.toggle('u-hidden');
      if (!panel.classList.contains('u-hidden')) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    var list = document.getElementById('historyList');
    if (list) list.addEventListener('click', function (ev) {
      var item = ev.target.closest('.hist-item');
      if (item) loadHistoryEntry(Number(item.getAttribute('data-id')));
    });
    var clear = document.getElementById('btnClearHistory');
    if (clear) clear.addEventListener('click', function () {
      if (confirm('确定清空全部历史记录？此操作不可撤销')) {
        saveHistory([]);
        renderHistoryList();
      }
    });
    var exp = document.getElementById('btnExportHistory');
    if (exp) exp.addEventListener('click', exportHistory);
    var imp = document.getElementById('btnImportHistory');
    if (imp) imp.addEventListener('click', importHistory);
    var fileInput = document.getElementById('importFile');
    if (fileInput) fileInput.addEventListener('change', onImportFile);
  }

  function exportHistory() {
    var arr = loadHistory();
    if (!arr.length) { alert('暂无历史记录可导出'); return; }
    var data = JSON.stringify({ app: 'qimen-history', version: 1, exportedAt: new Date().toISOString(), entries: arr }, null, 2);
    var blob = new Blob([data], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var d = new Date();
    a.href = url;
    a.download = 'qimen-history-' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importHistory() {
    var fileInput = document.getElementById('importFile');
    if (!fileInput) return;
    fileInput.value = '';
    fileInput.click();
  }

  function onImportFile(ev) {
    var f = ev.target.files && ev.target.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var j = JSON.parse(reader.result);
        var entries = Array.isArray(j) ? j : (j.entries || []);
        if (!Array.isArray(entries) || !entries.length) { alert('文件格式不正确，未找到历史记录'); return; }
        var existing = loadHistory();
        var map = {};
        var merged = [];
        var all = entries.concat(existing);
        for (var i = 0; i < all.length; i++) {
          var e = all[i];
          if (e && e.id && !map[e.id]) { map[e.id] = true; merged.push(e); }
        }
        if (merged.length > HISTORY_MAX) merged = merged.slice(0, HISTORY_MAX);
        saveHistory(merged);
        renderHistoryList();
        alert('已导入 ' + entries.length + ' 条历史记录（合并后共 ' + merged.length + ' 条）');
      } catch (err) {
        alert('导入失败：文件不是有效的 JSON');
      }
    };
    reader.readAsText(f, 'utf-8');
  }

  // —— 阶段3：DeepSeek 流式解读 ——
  var SETTINGS_KEY = 'qimen_settings_v1';
  var SYSTEM_PROMPT = '你是一位精通奇门遁甲的老师。请严格依据下方提供的排盘数据与用神落宫做白话解读，排盘数据之外的信息一律不要编造。\n' +
    '断卦按以下逻辑逐步分析：\n' +
    '1. 用神：先看【用神落宫】中与所问之事对应的用神落在哪一宫、该宫星门旺衰如何（旺相为有力，休囚废为无力）；\n' +
    '2. 生克：看日干（求测人自己）与用神、时干（所问之事）之间的五行生克；时干克日干为「五不遇时」主不吉；\n' +
    '3. 吉凶：看用神宫是否带凶象（门迫/击刑/入墓/空亡/凶格）或吉象（吉格/得令旺相）；\n' +
    '4. 大势：看值符（整体环境/贵人）与值使（事体主导）落宫及其旺衰；\n' +
    '5. 应期：结合值使落宫、驿马、空亡（填实应期）等判断应验时间；数据不足以推断时明确写「应期不明」；\n' +
    '6. 建议：依据以上吉凶给出趋吉避凶的具体建议，紧扣排盘数据，不空谈、不夸大。\n' +
    '输出要求：\n' +
    '1. 分点输出：当前局势、发展趋势、吉凶关键点、具体建议、应期（若可判断）；\n' +
    '2. 术语可保留，但需用白话解释；\n' +
    '3. 客观中立、不绝对化、不制造焦虑；\n' +
    '4. 排盘数据不足以支撑某个判断时，直接说「依据不足」，不要臆测；\n' +
    '5. 结尾附一句「本解读仅供娱乐参考，人生决策请结合现实理性判断」。';

  function loadSettings() {
    var s = { apiKey: '', model: 'deepseek-v4-pro', thinking: 'enabled' };
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        var j = JSON.parse(raw);
        if (j.apiKey) s.apiKey = j.apiKey;
        if (j.model) s.model = j.model;
        if (j.thinking) s.thinking = j.thinking;
      }
    } catch (e) {}
    return s;
  }

  function saveSettings(s) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); return true; }
    catch (e) { return false; }
  }

  function applySettingsToUI(s) {
    var ak = document.getElementById('apiKey');
    if (ak) ak.value = s.apiKey || '';
    var modelRadios = document.querySelectorAll('input[name="model"]');
    for (var i = 0; i < modelRadios.length; i++) modelRadios[i].checked = (modelRadios[i].value === s.model);
    var thinkRadios = document.querySelectorAll('input[name="thinking"]');
    for (var j = 0; j < thinkRadios.length; j++) thinkRadios[j].checked = (thinkRadios[j].value === s.thinking);
  }

  function refreshKeyStatus(flash) {
    var el = document.getElementById('keyStatus');
    if (!el) return;
    var s = loadSettings();
    if (s.apiKey) {
      el.textContent = flash ? '✅ 已保存到本机' : '已保存到本机';
      el.className = 'key-status ok';
    } else {
      var standalone = (window.navigator.standalone === true) ||
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
      el.textContent = standalone
        ? '未保存（主屏 App 与 Safari 存储独立，请在当前入口填写一次）'
        : '未保存';
      el.className = 'key-status';
    }
  }

  function saveKeyFromInput(flash) {
    var ak = document.getElementById('apiKey');
    if (!ak) return;
    var cur = loadSettings();
    cur.apiKey = ak.value.trim();
    var ok = saveSettings(cur);
    var el = document.getElementById('keyStatus');
    if (!ok && el) {
      el.textContent = '⚠️ 保存失败（浏览器禁止本地存储，请勿用无痕模式）';
      el.className = 'key-status err';
      return;
    }
    refreshKeyStatus(flash);
  }

  function exportKeyBackup() {
    var ta = document.getElementById('keyBackup');
    if (!ta) return;
    var s = loadSettings();
    ta.value = JSON.stringify(s);
    ta.classList.remove('u-hidden');
    ta.focus();
    try { ta.select(); } catch (e) {}
    try { if (navigator.clipboard) navigator.clipboard.writeText(ta.value); } catch (e) {}
  }

  function importKeyBackup() {
    var ta = document.getElementById('keyBackup');
    var el = document.getElementById('keyStatus');
    if (!ta) return;
    var txt = (ta.value || '').trim();
    if (!txt) { if (el) { el.textContent = '请先粘贴备份内容'; el.className = 'key-status'; } return; }
    try {
      var s = JSON.parse(txt);
      if (!s || typeof s !== 'object' || !s.apiKey) throw new Error('bad');
      var cur = loadSettings();
      cur.apiKey = String(s.apiKey);
      cur.model = (s.model === 'deepseek-flash') ? 'deepseek-flash' : 'deepseek-v4-pro';
      cur.thinking = (s.thinking === 'disabled') ? 'disabled' : 'enabled';
      if (!saveSettings(cur)) throw new Error('storage');
      applySettingsToUI(cur);
      if (el) { el.textContent = '✅ 已导入并保存'; el.className = 'key-status ok'; }
    } catch (e) {
      if (el) { el.textContent = '导入失败：备份格式不正确'; el.className = 'key-status err'; }
    }
  }

  function palaceBrief(chart, p) {
    if (!p) return '';
    var info = PALACE_NAME[p.position];
    var marks = ysBadges(chart, p);
    var status = p.status || {};
    return info.name + '：' + fmt(p.star) + '/' + fmt(p.gate) + '/' + fmt(p.deity) +
      ' 天盘' + fmt(p.heavenlyStem) + ' 地盘' + fmt(p.earthlyStem) +
      ' 星' + (status.star || '-') + '门' + (status.gate || '-') +
      (marks.length ? ' [' + marks.join(',') + ']' : '');
  }

  function ysPromptLine(chart, item, loc) {
    var p = loc.palace;
    if (!p) return item.label + '：未定位';
    var info = PALACE_NAME[p.position];
    var status = p.status || {};
    var parts = [item.label + '：落' + info.name + '(' + info.dir + ')'];
    parts.push('天盘' + fmt(p.heavenlyStem) + ' 地盘' + fmt(p.earthlyStem) + ' 神' + fmt(p.deity));
    parts.push('星' + (status.star || '-') + '门' + (status.gate || '-'));
    var badges = ysBadges(chart, p);
    if (badges.length) parts.push('标记[' + badges.join(',') + ']');
    var ausp = (p.auspiciousPatterns || []).map(fmtPatternName);
    var inausp = (p.inauspiciousPatterns || []).map(fmtPatternName);
    if (ausp.length) parts.push('吉[' + ausp.join(',') + ']');
    if (inausp.length) parts.push('凶[' + inausp.join(',') + ']');
    var resp = p.tenStemResponse && p.tenStemResponse.heavenlyToEarthly;
    if (resp) parts.push('干应[' + resp.relation + ':' + resp.description + ']');
    return parts.join('，');
  }

  function buildInterpretPrompt(chart, question, context, category) {
    var t = chart.timeInfo;
    var fp = chart.fourPillars;
    var L = [];
    L.push('【起局信息】');
    L.push('起局方式：正时起局（以点击排盘时刻起局）');
    L.push('四柱：' + fp.year.stem + fp.year.branch + '年 ' + fp.month.stem + fp.month.branch + '月 ' +
      fp.day.stem + fp.day.branch + '日 ' + fp.hour.stem + fp.hour.branch + '时');
    L.push('局数：' + chart.ju.type + chart.ju.number + '局 · ' + chart.yuan + ' · ' + (chart.season || ''));
    L.push('节气：' + (t.solarTerm || '') + ' · ' + t.xunShou + '旬 · 空亡 ' + (t.voidness || []).join(''));
    L.push('值符：' + fmt(chart.zhiFu.star) + ' 落' + chart.zhiFu.position + '宫；值使：' + fmt(chart.zhiShi.gate) +
      ' 落' + chart.zhiShi.position + '宫；驿马：' + chart.postHorse.branch + ' 在' + chart.postHorse.position + '宫');
    L.push('');
    L.push('【问事信息】');
    L.push('问事分类：' + category);
    if (question) L.push('所问之事：' + question);
    else L.push('所问之事：（未填写，请按' + category + '类做综合解读）');
    if (context) L.push('现状补充：' + context);
    L.push('');
    L.push('【日时生克】');
    L.push('日干' + fp.day.stem + '（属' + (STEM_WUXING[fp.day.stem] || '?') + '）＝求测人自己；' +
      '时干' + fp.hour.stem + '（属' + (STEM_WUXING[fp.hour.stem] || '?') + '）＝所问之事');
    L.push('');
    L.push('【用神落宫】');
    var items = YONGSHEN_MAP[category] || [];
    for (var i = 0; i < items.length; i++) {
      L.push(ysPromptLine(chart, items[i], locateYongShen(chart, items[i])));
    }
    L.push('');
    L.push('【九宫概况】');
    for (var j = 0; j < PALACE_ORDER.length; j++) {
      var brief = palaceBrief(chart, palaceByPos(chart, PALACE_ORDER[j]));
      if (brief) L.push(brief);
    }
    L.push('');
    L.push('【特殊格局】');
    var sp = chart.specialPatterns || {};
    var spLines = [];
    if (sp.wuBuYuShi && sp.wuBuYuShi.isWuBuYuShi) spLines.push('五不遇时（时干克日干，主凶）');
    var menPo = sp.menPo || [];
    if (menPo.length) spLines.push('门迫门制：' + menPo.map(function (m) { return m.gate + m.gatePressure + m.position + '宫'; }).join('、'));
    if ((sp.auspiciousPatterns || []).length) spLines.push('吉格：' + sp.auspiciousPatterns.map(fmtPatternName).join('、'));
    if ((sp.inauspiciousPatterns || []).length) spLines.push('凶格：' + sp.inauspiciousPatterns.map(fmtPatternName).join('、'));
    L.push(spLines.length ? spLines.join('\n') : '（无特殊格局）');
    return L.join('\n');
  }

  function mdToHtml(text) {
    var html = esc(text);
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/^#{1,3}\s+(.+)$/gm, '<div class="md-h">$1</div>');
    html = html.replace(/^[-*]\s+(.+)$/gm, '<div class="md-li">$1</div>');
    html = html.replace(/^\d+[.、）)]\s*(.+)$/gm, '<div class="md-li">$1</div>');
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  function callDeepSeek(apiKey, model, thinking, messages, onReason, onContent, onError, onDone) {
    var body = { model: model, messages: messages, stream: true };
    body.thinking = { type: thinking === 'enabled' ? 'enabled' : 'disabled' };
    if (thinking === 'enabled') body.reasoning_effort = 'high';

    var ctrl = new AbortController();
    var timedOut = false;
    var timer = setTimeout(function () { timedOut = true; ctrl.abort(); }, 180000); // 总超时 3 分钟

    fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify(body),
      signal: ctrl.signal
    }).then(function (resp) {
      if (!resp.ok) {
        clearTimeout(timer);
        return resp.text().then(function (txt) {
          var msg = '请求失败 HTTP ' + resp.status;
          try {
            var j = JSON.parse(txt);
            if (j.error && j.error.message) msg = j.error.message;
          } catch (e) {}
          onError(msg);
        });
      }
      var reader = resp.body.getReader();
      var decoder = new TextDecoder();
      var buf = '';
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) { clearTimeout(timer); if (onDone) onDone(); return; }
          buf += decoder.decode(r.value, { stream: true });
          var lines = buf.split('\n');
          buf = lines.pop();
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            var data = null;
            if (line.indexOf('data: ') === 0) data = line.slice(6).trim();
            else if (line.indexOf('data:') === 0) data = line.slice(5).trim();
            if (data === null) continue;
            if (data === '[DONE]') { clearTimeout(timer); if (onDone) onDone(); return; }
            try {
              var obj = JSON.parse(data);
              var delta = obj.choices && obj.choices[0] && obj.choices[0].delta;
              if (!delta) continue;
              if (delta.reasoning_content) onReason(delta.reasoning_content);
              if (delta.content) onContent(delta.content);
            } catch (e) {}
          }
          return pump();
        });
      }
      return pump();
    }).catch(function (e) {
      clearTimeout(timer);
      if (timedOut || (e && e.name === 'AbortError')) onError('请求超时（超过 3 分钟未完成），请检查网络后重试');
      else onError('网络请求失败：' + (e && e.message ? e.message : e));
    });
  }

  function startInterpretation() {
    var s = loadSettings();
    var out = document.getElementById('interpOut');
    if (!out) return;
    var btnI = document.getElementById('btnInterp');
    if (btnI && btnI.disabled) return; // 解读进行中，防重复点击
    if (!s.apiKey) {
      document.getElementById('interpSettings').classList.remove('u-hidden');
      var ak = document.getElementById('apiKey');
      if (ak) ak.focus();
      out.innerHTML = '<div class="interp-msg">请先在上方「设置」里填入 DeepSeek API Key（仅存本机）</div>';
      return;
    }
    if (!currentChart) return;

    var prompt = buildInterpretPrompt(currentChart, currentQuestion, currentContext, currentCategory);
    if (btnI) { btnI.disabled = true; btnI.textContent = '🔮 解读中…'; }
    out.innerHTML =
      '<details class="reason-box" open><summary>深度思考过程</summary><div class="reason-body" id="reasonBody"></div></details>' +
      '<div class="answer-box" id="answerBox"><span class="typing" id="typing">AI 深度思考中，通常需 30 秒~2 分钟，请耐心等待…</span>' +
      '<span class="interp-elapsed" id="elapsed"></span></div>';
    var reasonBody = document.getElementById('reasonBody');
    var answerBox = document.getElementById('answerBox');
    var typingEl = document.getElementById('typing');
    var elapsedEl = document.getElementById('elapsed');
    var reasonBuf = '';
    var answerBuf = '';
    var started = false;
    var t0 = Date.now();
    var elapsedTimer = setInterval(function () {
      if (elapsedEl) elapsedEl.textContent = '（已等待 ' + Math.floor((Date.now() - t0) / 1000) + ' 秒）';
    }, 1000);
    function markStarted() {
      if (started) return;
      started = true;
      clearInterval(elapsedTimer);
      if (typingEl) typingEl.textContent = '已开始输出，正在生成…';
      if (elapsedEl) elapsedEl.textContent = '';
    }

    callDeepSeek(s.apiKey, s.model, s.thinking,
      [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
      function (rt) {
        markStarted();
        reasonBuf += rt;
        reasonBody.textContent = reasonBuf;
      },
      function (ct) {
        markStarted();
        answerBuf += ct;
        answerBox.innerHTML = mdToHtml(answerBuf);
      },
      function (err) {
        clearInterval(elapsedTimer);
        var e2 = String(err);
        var hint = '';
        if (e2.indexOf('Authentication') >= 0 || e2.indexOf('api key') >= 0 || e2.indexOf('invalid') >= 0) {
          hint = '<div class="interp-tip">请检查：API Key 是否复制完整（sk- 开头）、是否已充值（platform.deepseek.com 查看余额）。</div>';
        } else if (e2.indexOf('Insufficient') >= 0 || e2.indexOf('Balance') >= 0 || e2.indexOf('余额') >= 0) {
          hint = '<div class="interp-tip">账户余额不足，请到 platform.deepseek.com 充值后重试。</div>';
        } else if (e2.indexOf('超时') >= 0 || e2.indexOf('网络') >= 0) {
          hint = '<div class="interp-tip">网络异常：请检查能否访问 api.deepseek.com，稍后重试。</div>';
        }
        answerBox.innerHTML = '<span class="interp-err">' + esc(err) + '</span>' + hint;
        if (btnI) { btnI.disabled = false; btnI.textContent = '🔮 AI 解读'; }
      },
      function () {
        clearInterval(elapsedTimer);
        if (currentHistoryId && (reasonBuf || answerBuf)) {
          updateHistoryEntry(currentHistoryId, { interp: { reasoning: reasonBuf, answer: answerBuf } });
          renderHistoryList();
        }
        if (btnI) { btnI.disabled = false; btnI.textContent = '🔮 AI 解读'; }
      });
  }

  function initSettings() {
    var s = loadSettings();
    var ak = document.getElementById('apiKey');
    if (ak) {
      ak.value = s.apiKey;
      ak.addEventListener('input', function () { saveKeyFromInput(false); });
      ak.addEventListener('change', function () { saveKeyFromInput(true); });
    }
    var btnSaveKey = document.getElementById('btnSaveKey');
    if (btnSaveKey) btnSaveKey.addEventListener('click', function () { saveKeyFromInput(true); });
    var btnExportKey = document.getElementById('btnExportKey');
    if (btnExportKey) btnExportKey.addEventListener('click', exportKeyBackup);
    var btnImportKey = document.getElementById('btnImportKey');
    if (btnImportKey) btnImportKey.addEventListener('click', importKeyBackup);
    var modelRadios = document.querySelectorAll('input[name="model"]');
    for (var i = 0; i < modelRadios.length; i++) {
      modelRadios[i].checked = (modelRadios[i].value === s.model);
    }
    var thinkRadios = document.querySelectorAll('input[name="thinking"]');
    for (var j = 0; j < thinkRadios.length; j++) {
      thinkRadios[j].checked = (thinkRadios[j].value === s.thinking);
    }
    var all = document.querySelectorAll('input[name="model"], input[name="thinking"]');
    for (var k = 0; k < all.length; k++) {
      all[k].addEventListener('change', function () {
        var cur = loadSettings();
        var m = document.querySelector('input[name="model"]:checked');
        var th = document.querySelector('input[name="thinking"]:checked');
        if (m) cur.model = m.value;
        if (th) cur.thinking = th.value;
        saveSettings(cur);
      });
    }
    var btnS = document.getElementById('btnSettings');
    if (btnS) btnS.addEventListener('click', function () {
      document.getElementById('interpSettings').classList.toggle('u-hidden');
    });
    var btnI = document.getElementById('btnInterp');
    if (btnI) btnI.addEventListener('click', startInterpretation);
    refreshKeyStatus(false);
  }

  function initAutoGrow() {
    ['question', 'context'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      autoGrowTextarea(el);
      el.addEventListener('input', function () { autoGrowTextarea(el); });
    });
  }

  function autoGrowTextarea(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  function init() {
    renderAskChips();
    initSettings();
    initHistory();
    initAutoGrow();
    buildChart(new Date());

    document.getElementById('btnCast').addEventListener('click', castDivination);

    // 阶段4：注册 Service Worker（仅 http(s)/localhost；file:// 不注册）
    if (location.protocol !== 'file:' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
