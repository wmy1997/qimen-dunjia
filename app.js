// 奇门遁甲排盘 —— 主逻辑（纯前端，3meta 内核）
(function () {
  'use strict';

  var ThreeMeta = window.ThreeMeta;
  var QRules = window.QimenRules;
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
  var currentSystem = 'liuyao'; // 当前体系：liuyao（六爻）| qimen（奇门）
  var currentGender = '';       // 六爻婚姻类用神取法：''（不限）| male | female
  var currentLiuyao = null;     // 六爻最近一次装卦结果（taibu 输出）
  var currentYaoValues = [];    // 六爻最近一次摇出的六爻值
  var currentShenSha = [];     // 本次盘的神煞列表
  var currentSSByPalace = {};  // 神煞按宫分组
  var currentYingqi = null;    // 本次盘的应期推算

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
    if (QRules) {
      currentShenSha = QRules.detectShenSha(chart);
      currentSSByPalace = QRules.groupByPalace(currentShenSha);
    } else {
      currentShenSha = [];
      currentSSByPalace = {};
    }
    renderHeader(chart);
    renderGrid(chart);
    renderYongShen(chart);
    renderYingqi(chart);
    renderPatterns(chart);
  }

  // 某宫的神煞标签
  function ssTagsHtml(pos) {
    var list = currentSSByPalace[pos] || [];
    if (!list.length) return '';
    return '<div class="ss-tags">' + list.map(function (s) {
      var cls = s.auspice === '凶' ? ' ss-bad' : (s.auspice === '吉' ? ' ss-good' : '');
      return '<span class="ss-tag' + cls + '">' + s.name + '</span>';
    }).join('') + '</div>';
  }

  function ssNamesOf(pos) {
    return (currentSSByPalace[pos] || []).map(function (s) { return s.name; });
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
      markHtml +
      ssTagsHtml(p.position);

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

    var ssNames = ssNamesOf(p.position);
    var ssHtml = ssNames.length
      ? '<div class="ys-ss">神煞：' + ssNames.join('、') + '</div>' : '';

    return '<div class="ys-card">' +
      '<div class="ys-title">' + title + ' <span class="ys-loc">→ ' + info.name + '·' + info.dir + '</span></div>' +
      '<div class="ys-wang">星 ' + (status.star || '-') + ' · 门 ' + (status.gate || '-') + '</div>' +
      badgeHtml +
      ssHtml +
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

  // —— 应期推算卡片 ——
  function renderYingqi(chart) {
    var box = document.getElementById('yingqi');
    if (!box) return;
    currentYingqi = null;
    if (!QRules) { box.innerHTML = ''; return; }
    var items = YONGSHEN_MAP[currentCategory] || [];
    if (!items.length) { box.innerHTML = ''; return; }

    // 应期以「主用神」为断：综合类取日干（求测人），其余取该类的第一位用神
    var primary = items[0];
    if (currentCategory === '综合') {
      for (var k = 0; k < items.length; k++) {
        if (items[k].kind === 'dayStem') { primary = items[k]; break; }
      }
    }
    var loc = locateYongShen(chart, primary);
    if (!loc.palace) { box.innerHTML = ''; return; }

    var yq = QRules.computeYingqi(chart, loc.palace.position);
    if (!yq) { box.innerHTML = ''; return; }
    currentYingqi = yq;
    yq.yongShenLabel = primary.label;

    var branchPal = QRules.BRANCH_PALACE[yq.branch] || 0;
    var branchPalName = branchPal ? (PALACE_NAME[branchPal].name + '·' + PALACE_NAME[branchPal].dir) : '';

    box.innerHTML =
      '<div class="yq-card">' +
        '<div class="yq-head">应期推算<span class="yq-sub">以用神「' + primary.label + '」落' +
          (PALACE_NAME[yq.yongShenPalace] ? PALACE_NAME[yq.yongShenPalace].name : yq.yongShenPalace + '宫') +
          '为断</span></div>' +
        '<div class="yq-line"><b>远近</b>' + yq.scale + ' · ' + yq.unit + '</div>' +
        '<div class="yq-why">' + yq.scaleWhy + '</div>' +
        (yq.branch
          ? '<div class="yq-line"><b>应期支</b><span class="yq-branch">' + yq.branch + '</span>' +
            (branchPalName ? '<span class="yq-pal">' + branchPalName + '</span>' : '') + '</div>' +
            '<div class="yq-why">' + yq.basis + '</div>'
          : '') +
        (yq.zhishi.text ? '<div class="yq-line"><b>事期</b>' + yq.zhishi.text + '</div>' : '') +
        '<div class="yq-note">应期只作时间线索（主近期/远期与可能应验之支），不断吉凶，也不宜脱离事体大小硬套。</div>' +
      '</div>';
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
          syncGenderWrap();
          if (currentSystem === 'qimen' && currentChart) { renderYongShen(currentChart); renderYingqi(currentChart); }
          if (currentSystem === 'liuyao' && currentLiuyao && window.QimenLiuyao) window.QimenLiuyao.recastAnalysis();
          if (currentHistoryId) updateHistoryEntry(currentHistoryId, { category: cat });
        });
      })(ASK_CATEGORIES[i], chip);
      box.appendChild(chip);
    }
  }

  // —— 体系切换（六爻 / 奇门）——
  function syncGenderWrap() {
    var w = document.getElementById('lyGenderWrap');
    if (w) w.classList.toggle('u-hidden', !(currentSystem === 'liuyao' && currentCategory === '婚姻'));
  }

  function setSystem(sys, silent) {
    currentSystem = (sys === 'qimen') ? 'qimen' : 'liuyao';
    var cards = document.querySelectorAll('.sys-card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].classList.toggle('active', cards[i].getAttribute('data-sys') === currentSystem);
    }
    var pairs = [
      ['liuyaoCast', currentSystem === 'liuyao'],
      ['qimenCast', currentSystem === 'qimen'],
      ['liuyaoView', currentSystem === 'liuyao'],
      ['qimenView', currentSystem === 'qimen']
    ];
    for (var j = 0; j < pairs.length; j++) {
      var el = document.getElementById(pairs[j][0]);
      if (el) el.classList.toggle('u-hidden', !pairs[j][1]);
    }
    syncGenderWrap();
    if (!silent) {
      var out = document.getElementById('interpOut');
      if (out) out.innerHTML = '';
    }
  }

  // 问题类型 → 体系建议（规则化判断，即时给出，不调模型）
  var ADVISE_RULES = [
    { sys: 'liuyao', why: '问何时、问应期，六爻的应期体系最细（冲空填实、值日值月）',
      kw: ['什么时候', '何时', '几时', '多久', '哪天', '多久能', '应期', '时间点', '还要等', '几月', '几年', '多久会'] },
    { sys: 'qimen', why: '要比较几个选项或判断去留方位，奇门九宫适合比优劣、看形势',
      kw: ['还是', '要不要', '该不该', '该去', '哪个', '哪一个', '哪边', '哪里', '对比', '优劣', '取舍', '去留', '方向', '方位', '布局', '择日', '选哪', '比较好', '好一点'] },
    { sys: 'liuyao', why: '问单件事的成败有无，六爻一问一断最直接',
      kw: ['会不会', '能不能', '成不成', '有没有', '是不是', '能否', '可否', '是否能', '顺利吗', '有希望', '能不能成', '会成功吗', '有戏吗', '能拿到吗', '能过吗', '能中吗'] },
    { sys: 'qimen', why: '问整体局势与如何应对，奇门看大势、主客与格局更完整',
      kw: ['局势', '形势', '大局', '趋势', '整体', '该怎么办', '如何应对', '怎么破局', '如何推进', '该怎么选'] },
    // 具体事项关键词：多数属「一事一断」，给六爻；带方位/地点者给奇门
    { sys: 'qimen', why: '涉及地点、搬迁或方位选择，奇门更适合看方向与形势',
      kw: ['搬去', '搬到', '去哪个城市', '换城市', '在哪里', '哪个城市', '选城市', '选址', '摆在哪'] },
    { sys: 'liuyao', why: '这类具体事项适合六爻考古凶应期',
      kw: ['面试', '通知', 'offer', '入职', '跳槽', '升职', '涨薪', '加薪', '辞职', '裁员', '被裁', '领导', '老板',
           '相亲', '复合', '分手', '表白', '恋爱', '对象', '结婚', '离婚', '前任', '暧昧',
           '借钱', '回款', '欠款', '投资', '股票', '基金', '买房', '卖房', '贷款', '收入', '奖金', '分红',
           '生病', '手术', '体检', '医院', '失眠', '怀孕',
           '考试', '分数', '录取', '上岸', '论文', '答辩', '复试',
           '签证', '机票', '出差', '旅行', '移民',
           '诉讼', '官司', '报警', '纠纷', '律师',
           '丢了', '找不到', '遗失', '走失', '找不到东西'] }
  ];

  function updateSysAdvice(text) {
    var hint = document.getElementById('sysHint');
    var recs = document.querySelectorAll('.sys-rec');
    for (var i = 0; i < recs.length; i++) recs[i].classList.add('u-hidden');
    if (!hint) return;
    var t = (text || '').trim();
    if (!t) { hint.classList.add('u-hidden'); hint.innerHTML = ''; return; }
    var pick = null;
    for (var r = 0; r < ADVISE_RULES.length && !pick; r++) {
      for (var k = 0; k < ADVISE_RULES[r].kw.length; k++) {
        if (t.indexOf(ADVISE_RULES[r].kw[k]) >= 0) { pick = ADVISE_RULES[r]; break; }
      }
    }
    if (!pick) {
      // 兜底：识别不出类型时也给建议，避免「没有推荐」
      pick = { sys: 'liuyao', why: '常规问事，六爻一问一断最稳；若要比较选项或看整体态势，可切到奇门' };
    }
    var name = pick.sys === 'liuyao' ? '六爻' : '奇门';
    hint.innerHTML = '这类问题更适合 <b>' + name + '</b>：' + pick.why +
      '。<button type="button" class="link-btn" data-goto="' + pick.sys + '">切到' + name + '</button>';
    hint.classList.remove('u-hidden');
    var badge = document.querySelector('.sys-card[data-sys="' + pick.sys + '"] .sys-rec');
    if (badge) badge.classList.remove('u-hidden');
  }

  function initSystemTabs() {
    var tabs = document.getElementById('sysTabs');
    if (tabs) tabs.addEventListener('click', function (ev) {
      var card = ev.target.closest('.sys-card');
      if (card) setSystem(card.getAttribute('data-sys'));
    });
    var hint = document.getElementById('sysHint');
    if (hint) hint.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-goto]');
      if (b) setSystem(b.getAttribute('data-goto'));
    });
    var q = document.getElementById('question');
    if (q) q.addEventListener('input', function () { updateSysAdvice(q.value); });
    setSystem('liuyao', true);
  }

  // —— 六爻装卦完成回调（liuyao.js 调用）——
  function handleLiuyaoCast(params, out) {
    var qEl = document.getElementById('question');
    var cEl = document.getElementById('context');
    currentQuestion = qEl ? qEl.value.trim() : '';
    currentContext = cEl ? cEl.value.trim() : '';
    currentGender = params.gender || '';
    currentLiuyao = out;
    currentYaoValues = (params.yaoValues || []).slice();
    renderQiuSummary();

    var interpOut = document.getElementById('interpOut');
    if (interpOut) interpOut.innerHTML = '';

    var entry = {
      id: Date.now(),
      ts: new Date(params.date).getTime(),
      system: 'liuyao',
      question: currentQuestion,
      context: currentContext,
      category: params.category,
      gender: currentGender,
      yaoValues: currentYaoValues,
      hexagram: out.hexagramName,
      changed: out.changedHexagramName || '',
      interp: null
    };
    currentHistoryId = entry.id;
    addHistoryEntry(entry);
    renderHistoryList();

    showAskAgain(true);
    var view = document.getElementById('liuyaoView');
    if (view) view.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function showAskAgain(show) {
    var row = document.getElementById('askAgainRow');
    if (row) row.classList.toggle('u-hidden', !show);
  }

  function askAgain() {
    var out = document.getElementById('interpOut');
    if (out) out.innerHTML = '';
    if (currentSystem === 'liuyao' && window.QimenLiuyao) {
      window.QimenLiuyao.reset();
      currentLiuyao = null;
      currentYaoValues = [];
    }
    showAskAgain(false);
    var q = document.getElementById('question');
    var form = document.querySelector('.qiu-form');
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (q) {
      setTimeout(function () { try { q.focus({ preventScroll: true }); } catch (e) {} }, 260);
    }
  }

  function renderQiuSummary() {
    var box = document.getElementById('qiuSummary');
    if (!box) return;
    var tags = [];
    tags.push(currentSystem === 'liuyao' ? '六爻 · 摇卦' : '奇门 · 时间起局');
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
      system: 'qimen',
      question: currentQuestion,
      context: currentContext,
      category: currentCategory,
      ju: currentChart.ju.type + currentChart.ju.number + '局',
      interp: null
    };
    currentHistoryId = entry.id;
    addHistoryEntry(entry);
    renderHistoryList();

    showAskAgain(true);
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
    var isLY = e.system === 'liuyao';
    var sub = isLY
      ? ((e.hexagram || '') + (e.changed ? ' → ' + e.changed : ''))
      : (e.ju || '');
    return '<button class="hist-item" type="button" data-id="' + e.id + '">' +
      '<div class="hist-title">' + esc(title) + (e.interp ? '<span class="hist-tag">已解读</span>' : '') + '</div>' +
      '<div class="hist-meta"><span class="hist-sys">' + (isLY ? '六爻' : '奇门') + '</span>' +
        time + ' · ' + esc(sub) + '</div>' +
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

  function restoreInterp(e) {
    var out = document.getElementById('interpOut');
    if (!out) return;
    out.innerHTML = e.interp
      ? '<details class="reason-box"><summary>深度思考原文（模型内部推理，可能中英混杂，仅供参考）</summary><div class="reason-body">' + esc(cleanCoT(e.interp.reasoning || '')) + '</div></details>' +
        '<div class="answer-box">' + mdToHtml(e.interp.answer || '') + '</div>'
      : '';
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
    currentGender = e.gender || '';

    document.getElementById('question').value = currentQuestion;
    document.getElementById('context').value = currentContext;
    setCategoryChip(currentCategory);

    var isLY = e.system === 'liuyao';
    setSystem(isLY ? 'liuyao' : 'qimen', true);
    syncGenderWrap();

    if (isLY) {
      var gEl = document.querySelector('input[name="lyGender"][value="' + currentGender + '"]');
      if (gEl) gEl.checked = true;
      if (window.QimenLiuyao) {
        window.QimenLiuyao.loadEntry(e).then(function (out) {
          currentLiuyao = out;
          currentYaoValues = (e.yaoValues || []).slice();
          restoreInterp(e);
          document.getElementById('historyPanel').classList.add('u-hidden');
          var v = document.getElementById('liuyaoView');
          if (v) v.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
      renderQiuSummary();
      return;
    }

    // 奇门：用保存的起局时刻重排盘（排盘确定性：同时刻→同盘）
    var d = new Date(e.ts);
    currentChart = ThreeMeta.QimenChart.fromSolar(
      d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
    render(currentChart);
    renderQiuSummary();
    restoreInterp(e);

    document.getElementById('historyPanel').classList.add('u-hidden');
    showAskAgain(true);
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
    '5. 应期：优先采用【应期推算】给出的远近尺度（近快按日/时、远慢按月/年）、应期支与事期宫数，' +
      '结合驿马、空亡、入墓等因素说明理由；若【应期推算】标为「难定」或依据不足，直接写「应期不明」，不可自造日期；\n' +
    '6. 建议：依据以上吉凶给出趋吉避凶的具体建议，紧扣排盘数据，不空谈、不夸大。\n' +
    '输出要求：\n' +
    '1. 分点输出：当前局势、发展趋势、吉凶关键点、具体建议、应期（若可判断）；\n' +
    '2. 术语可保留，但需用白话解释；\n' +
    '3. 客观中立、不绝对化、不制造焦虑；\n' +
    '4. 排盘数据不足以支撑某个判断时，直接说「依据不足」，不要臆测；神煞只作辅助参断（贵人/文昌/禄神等吉神可增其力，羊刃/桃花等须结合用神与格局看），不可单凭神煞定吉凶；\n' +
    '5. 结尾附一句「本解读仅供娱乐参考，人生决策请结合现实理性判断」。' +
    '\n另外：思考过程（reasoning）请尽量使用中文书写，便于阅读。';

  var DEFAULT_BASE = 'https://api.ohmygpt.com/v1';
  var DEFAULT_MODEL = 'deepseek/deepseek-v4.1-flash-1017';

  function loadSettings() {
    var s = { apiKey: '', baseUrl: DEFAULT_BASE, model: DEFAULT_MODEL, effort: 'max' };
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        var j = JSON.parse(raw);
        if (j.apiKey) s.apiKey = j.apiKey;
        if (j.baseUrl) {
          s.baseUrl = j.baseUrl;
          if (j.model) s.model = j.model;
          if (j.effort) s.effort = j.effort;
        } else if (j.model && j.model.indexOf('deepseek/') >= 0) {
          // 旧版存过第三方模型名 → 视为第三方源
          s.model = j.model;
          if (j.thinking) s.effort = (j.thinking === 'disabled') ? 'off' : 'high';
        } else if (j.model) {
          // 旧版官方源配置 → 迁移到新的第三方默认源
          s.baseUrl = DEFAULT_BASE; s.model = DEFAULT_MODEL; s.effort = 'max';
        }
      }
    } catch (e) {}
    return s;
  }

  function normalizeBase(u) {
    var b = String(u || '').trim().replace(/\/+$/, '');
    return b || DEFAULT_BASE;
  }

  function apiEndpoint(baseUrl) {
    var b = normalizeBase(baseUrl);
    return b + '/chat/completions';
  }

  function saveSettings(s) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); return true; }
    catch (e) { return false; }
  }

  function applySettingsToUI(s) {
    var ak = document.getElementById('apiKey');
    if (ak) ak.value = s.apiKey || '';
    var mi = document.getElementById('modelInput');
    if (mi) mi.value = s.model || DEFAULT_MODEL;
    var sel = document.getElementById('apiBase');
    var cust = document.getElementById('apiBaseCustom');
    if (sel) {
      var base = normalizeBase(s.baseUrl);
      var hit = false;
      for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === base) { sel.value = base; hit = true; break; }
      }
      if (!hit) {
        sel.value = '__custom';
        if (cust) { cust.value = base; cust.classList.remove('u-hidden'); }
      } else if (cust) {
        cust.classList.add('u-hidden');
      }
    }
    var eff = document.querySelectorAll('input[name="effort"]');
    for (var j = 0; j < eff.length; j++) eff[j].checked = (eff[j].value === (s.effort || 'max'));
  }

  function readSettingsFromUI() {
    var cur = loadSettings();
    var ok = document.getElementById('apiKey');
    if (ok) cur.apiKey = ok.value.trim();
    var mi = document.getElementById('modelInput');
    if (mi && mi.value.trim()) cur.model = mi.value.trim();
    var sel = document.getElementById('apiBase');
    var cust = document.getElementById('apiBaseCustom');
    if (sel) {
      if (sel.value === '__custom') cur.baseUrl = normalizeBase(cust ? cust.value : '');
      else cur.baseUrl = sel.value;
    }
    var eff = document.querySelector('input[name="effort"]:checked');
    if (eff) cur.effort = eff.value;
    return cur;
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
      if (s.baseUrl) cur.baseUrl = normalizeBase(s.baseUrl);
      if (s.model) cur.model = String(s.model);
      if (s.effort) cur.effort = String(s.effort);
      else if (s.thinking) cur.effort = (s.thinking === 'disabled') ? 'off' : 'high';
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
    var ss = ssNamesOf(p.position);
    return info.name + '：' + fmt(p.star) + '/' + fmt(p.gate) + '/' + fmt(p.deity) +
      ' 天盘' + fmt(p.heavenlyStem) + ' 地盘' + fmt(p.earthlyStem) +
      ' 星' + (status.star || '-') + '门' + (status.gate || '-') +
      (ss.length ? ' 神煞[' + ss.join(',') + ']' : '') +
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

    if (currentYingqi) {
      var yq = currentYingqi;
      L.push('【应期推算】');
      L.push('用神：' + (yq.yongShenLabel || '') + '（落' + yq.yongShenPalace + '宫）');
      L.push('远近：' + yq.scale + '（' + yq.unit + '）—— ' + yq.scaleWhy);
      if (yq.branch) {
        L.push('应期支：' + yq.branch + '（' +
          ((PALACE_NAME[QRules.BRANCH_PALACE[yq.branch]]) ? PALACE_NAME[QRules.BRANCH_PALACE[yq.branch]].name : '') +
          '）—— ' + yq.basis);
      } else {
        L.push('应期支：难定');
      }
      if (yq.zhishi && yq.zhishi.text) L.push('事期：' + yq.zhishi.text);
      L.push('口径：应期只作时间线索，不断吉凶；事体大小与常理须一并参考。');
      L.push('');
    }

    if (currentShenSha.length) {
      L.push('【神煞】');
      currentShenSha.forEach(function (s) {
        var pn = PALACE_NAME[s.palace] ? PALACE_NAME[s.palace].name : s.palace + '宫';
        L.push(s.name + '（' + s.auspice + '）落' + pn + '，以' + s.anchor + '起；' + (s.desc || ''));
      });
      L.push('');
    }

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

  // 思考原文只做展示：清掉裸控制字符与替换符，避免出现视觉上的乱码
  function cleanCoT(t) {
    return String(t || '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/\uFFFD/g, '');
  }

  function callDeepSeek(settings, messages, onReason, onContent, onError, onDone) {
    var s = settings || loadSettings();
    var body = { model: s.model || DEFAULT_MODEL, messages: messages, stream: true };
    if (s.effort && s.effort !== 'off') {
      body.reasoning_effort = s.effort;
    } else if (normalizeBase(s.baseUrl).indexOf('api.deepseek.com') >= 0) {
      body.thinking = { type: 'disabled' };
    }

    var ctrl = new AbortController();
    var timedOut = false;
    var timer = setTimeout(function () { timedOut = true; ctrl.abort(); }, 180000); // 总超时 3 分钟

    fetch(apiEndpoint(s.baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (s.apiKey || '') },
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
      out.innerHTML = '<div class="interp-msg">请先在上方「设置」里填入 API Key（要与你选的接口地址对应，仅存本机）</div>';
      return;
    }
    var isLY = currentSystem === 'liuyao';
    if (isLY && !currentLiuyao) {
      out.innerHTML = '<div class="interp-msg">请先摇卦成卦，再让 AI 解读</div>';
      return;
    }
    if (!isLY && !currentChart) return;

    var prompt = isLY && window.QimenLiuyao
      ? window.QimenLiuyao.buildPrompt(currentLiuyao, currentQuestion, currentContext, currentCategory, currentGender)
      : buildInterpretPrompt(currentChart, currentQuestion, currentContext, currentCategory);
    var sysPrompt = isLY && window.QimenLiuyao ? window.QimenLiuyao.SYSTEM_PROMPT : SYSTEM_PROMPT;
    if (btnI) { btnI.disabled = true; btnI.textContent = '🔮 解读中…'; }
    out.innerHTML =
      '<details class="reason-box"><summary>深度思考原文（模型内部推理，可能中英混杂，仅供参考）</summary><div class="reason-body" id="reasonBody"></div></details>' +
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

    // 思考原文可能上万字，逐字重绘会卡顿，改为每 150ms 批量刷新
    var rafTimer = null;
    function flushReason() {
      rafTimer = null;
      if (reasonBody) reasonBody.textContent = cleanCoT(reasonBuf);
      if (answerBuf && answerBox) answerBox.innerHTML = mdToHtml(answerBuf);
    }
    function scheduleFlush() {
      if (rafTimer) return;
      rafTimer = setTimeout(flushReason, 150);
    }

    callDeepSeek(s,
      [{ role: 'system', content: sysPrompt }, { role: 'user', content: prompt }],
      function (rt) {
        markStarted();
        reasonBuf += rt;
        scheduleFlush();
      },
      function (ct) {
        markStarted();
        answerBuf += ct;
        scheduleFlush();
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
        if (rafTimer) { clearTimeout(rafTimer); rafTimer = null; }
        flushReason();
        if (currentHistoryId && (reasonBuf || answerBuf)) {
          updateHistoryEntry(currentHistoryId, { interp: { reasoning: reasonBuf, answer: answerBuf } });
          renderHistoryList();
        }
        if (btnI) { btnI.disabled = false; btnI.textContent = '🔮 AI 解读'; }
      });
  }

  function initSettings() {
    var s = loadSettings();
    applySettingsToUI(s);

    function persist(flash) {
      var cur = readSettingsFromUI();
      var ok = saveSettings(cur);
      if (!ok) {
        var el = document.getElementById('keyStatus');
        if (el) { el.textContent = '⚠️ 保存失败（浏览器禁止本地存储，请勿用无痕模式）'; el.className = 'key-status err'; }
        return;
      }
      refreshKeyStatus(flash);
    }

    var ak = document.getElementById('apiKey');
    if (ak) {
      ak.addEventListener('input', function () { persist(false); });
      ak.addEventListener('change', function () { persist(true); });
    }
    var mi = document.getElementById('modelInput');
    if (mi) mi.addEventListener('change', function () { persist(false); });

    var sel = document.getElementById('apiBase');
    var cust = document.getElementById('apiBaseCustom');
    if (sel) sel.addEventListener('change', function () {
      if (sel.value === '__custom') { if (cust) cust.classList.remove('u-hidden'); }
      else if (cust) cust.classList.add('u-hidden');
      persist(false);
    });
    if (cust) {
      cust.addEventListener('change', function () { persist(false); });
      cust.addEventListener('input', function () { persist(false); });
    }
    var eff = document.querySelectorAll('input[name="effort"]');
    for (var k = 0; k < eff.length; k++) eff[k].addEventListener('change', function () { persist(false); });

    var btnSaveKey = document.getElementById('btnSaveKey');
    if (btnSaveKey) btnSaveKey.addEventListener('click', function () { persist(true); });
    var btnExportKey = document.getElementById('btnExportKey');
    if (btnExportKey) btnExportKey.addEventListener('click', exportKeyBackup);
    var btnImportKey = document.getElementById('btnImportKey');
    if (btnImportKey) btnImportKey.addEventListener('click', importKeyBackup);
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
    window.QimenApp = {
      getQuestion: function () {
        var q = document.getElementById('question');
        return q ? q.value.trim() : '';
      },
      getContext: function () {
        var c = document.getElementById('context');
        return c ? c.value.trim() : '';
      },
      getCategory: function () { return currentCategory; },
      getGender: function () { return currentGender; }
    };

    renderAskChips();
    initSystemTabs();
    var btnAgain = document.getElementById('btnAskAgain');
    if (btnAgain) btnAgain.addEventListener('click', askAgain);
    initSettings();
    initHistory();
    initAutoGrow();

    if (window.QimenLiuyao) window.QimenLiuyao.init({ onCast: handleLiuyaoCast });

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
