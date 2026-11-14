// 六爻纳甲（京房易）—— 界面 + 摇卦 + 传参（内核：taibu-core/liuyao，MIT）
(function () {
  'use strict';

  var T = window.TaibuLiuyao;

  var YAO_POS = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];

  // 问事类别 → 六亲用神（六爻传统取法）
  var YONGSHEN = {
    '综合': ['妻财', '官鬼', '父母', '兄弟', '子孙'],
    '事业': ['官鬼'],
    '财运': ['妻财'],
    '婚姻': ['妻财', '官鬼'],
    '健康': ['官鬼', '子孙'],
    '学业': ['父母', '官鬼'],
    '出行': ['父母', '官鬼'],
    '官司': ['官鬼', '父母'],
    '寻物': ['妻财']
  };

  var state = {
    yao: [],          // 已摇出的爻值（6/7/8/9），自下而上
    params: null,     // { yaoValues, date, category, gender }
    out: null,
    busy: false
  };

  var hooks = { onCast: null, onCategory: null };

  // —— 工具 ——
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad2(n) { return String(n).padStart(2, '0'); }

  // 本地时间 → 带时区偏移的 ISO（月建日辰以此为准）
  function localIso(d) {
    var off = -d.getTimezoneOffset();
    var sign = off >= 0 ? '+' : '-';
    var oh = pad2(Math.floor(Math.abs(off) / 60));
    var om = pad2(Math.abs(off) % 60);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()) +
      sign + oh + ':' + om;
  }

  function yongShenTargets(category, gender) {
    if (category === '婚姻') {
      if (gender === 'male') return ['妻财'];
      if (gender === 'female') return ['官鬼'];
      return ['妻财', '官鬼'];
    }
    return YONGSHEN[category] || ['官鬼'];
  }

  // —— 摇卦区 ——
  function renderSlots(rolling) {
    var box = document.getElementById('yaoSlots');
    if (!box) return;
    var html = '';
    for (var i = 5; i >= 0; i--) {
      var v = state.yao[i];
      var cls = 'yao-slot';
      var label = YAO_POS[i];
      var content;
      if (v) {
        var isYang = (v === 7 || v === 9);
        var moving = (v === 6 || v === 9);
        content = '<span class="ly-bar ' + (isYang ? 'yang' : 'yin') + '"></span>' +
          '<span class="yao-val">' + v + (v === 9 ? ' ○' : v === 6 ? ' ×' : '') + '</span>';
        cls += ' filled' + (moving ? ' moving' : '');
      } else if (rolling === i) {
        content = '<span class="coin rolling">摇</span>';
        cls += ' active';
      } else {
        content = '<span class="yao-wait">待摇</span>';
      }
      html += '<div class="' + cls + '"><span class="yao-pos">' + label + '</span>' + content + '</div>';
    }
    box.innerHTML = html;
    updateShakeBtn();
  }

  function updateShakeBtn() {
    var btn = document.getElementById('btnShake');
    if (!btn) return;
    var n = state.yao.filter(Boolean).length;
    if (n >= 6) {
      btn.disabled = true;
      btn.textContent = '已摇满六爻';
    } else {
      btn.disabled = false;
      btn.textContent = '摇 第 ' + (n + 1) + ' 爻';
    }
    var quick = document.getElementById('btnQuickCast');
    if (quick) quick.disabled = n >= 6;
    var reset = document.getElementById('btnResetCast');
    if (reset) reset.classList.toggle('u-hidden', n === 0);
  }

  // 一次摇三枚铜钱：背=阳(3)，字=阴(2)
  function rollOne() {
    var sum = 0, coins = [];
    for (var i = 0; i < 3; i++) {
      var yang = Math.random() < 0.5;
      coins.push(yang);
      sum += yang ? 3 : 2;
    }
    return { value: sum, coins: coins };
  }

  function pushRoll(r) {
    state.yao[state.yao.filter(Boolean).length] = r.value;
  }

  function shakeOnce() {
    if (state.busy) return;
    var idx = state.yao.filter(Boolean).length;
    if (idx >= 6) return;
    state.busy = true;
    var r = rollOne();
    renderSlots(idx);
    // 起卦时刻 = 成卦那一刻；先滚动动画再落定
    setTimeout(function () {
      pushRoll(r);
      state.busy = false;
      renderSlots(-1);
      flashCoins(r);
      if (state.yao.filter(Boolean).length >= 6) doCast();
    }, 480);
  }

  function flashCoins(r) {
    var box = document.getElementById('coinTray');
    if (!box) return;
    box.innerHTML = r.coins.map(function (c) {
      return '<span class="coin ' + (c ? 'yang' : 'yin') + '">' + (c ? '背' : '字') + '</span>';
    }).join('') + '<span class="coin-sum">＝ ' + r.value + ' ' + yaoName(r.value) + '</span>';
  }

  function yaoName(v) {
    return v === 6 ? '老阴' : v === 7 ? '少阳' : v === 8 ? '少阴' : '老阳';
  }

  function quickCast() {
    if (state.busy) return;
    state.yao = [];
    for (var i = 0; i < 6; i++) state.yao.push(rollOne().value);
    renderSlots(-1);
    doCast();
  }

  function resetCast() {
    state.yao = [];
    state.out = null;
    state.params = null;
    renderSlots(-1);
    var view = document.getElementById('liuyaoView');
    if (view) view.innerHTML = emptyHtml();
    var tray = document.getElementById('coinTray');
    if (tray) tray.innerHTML = '';
    var out = document.getElementById('interpOut');
    if (out) out.innerHTML = '';
    closeManual();
  }

  function emptyHtml() {
    return '<div class="ly-empty">摇满六爻后，卦象与断卦信息显示在这里。<br>' +
      '六爻讲究「一事一占」，问题越具体，用神越准。</div>';
  }

  // —— 手动录入（自己在外摇过） ——
  function openManual() {
    var box = document.getElementById('manualBox');
    if (!box) return;
    var html = '<div class="manual-title">按自己摇出的爻值录入（自下而上）</div>';
    for (var i = 0; i < 6; i++) {
      html += '<div class="manual-row"><span>' + YAO_POS[i] + '</span>' +
        '<select data-yao="' + i + '">' +
        '<option value="7">少阳 7</option><option value="8">少阴 8</option>' +
        '<option value="9">老阳 9（动）</option><option value="6">老阴 6（动）</option>' +
        '</select></div>';
    }
    html += '<button id="btnManualGo" class="btn-cast" type="button">装卦</button>';
    box.innerHTML = html;
    box.classList.remove('u-hidden');
    box.querySelector('#btnManualGo').addEventListener('click', function () {
      var sels = box.querySelectorAll('select[data-yao]');
      state.yao = [];
      for (var j = 0; j < sels.length; j++) state.yao.push(Number(sels[j].value));
      renderSlots(-1);
      closeManual();
      doCast();
    });
  }
  function closeManual() {
    var box = document.getElementById('manualBox');
    if (box) { box.classList.add('u-hidden'); box.innerHTML = ''; }
  }

  // —— 装卦 ——
  async function doCast() {
    var date = new Date();
    var params = {
      yaoValues: state.yao.slice(0, 6),
      date: localIso(date),
      category: window.QimenApp ? window.QimenApp.getCategory() : '综合',
      gender: getGender()
    };
    state.params = params;
    var view = document.getElementById('liuyaoView');
    if (view) view.innerHTML = '<div class="ly-loading">装卦中…</div>';
    try {
      var out = await T.calculateLiuyao({
        question: (window.QimenApp ? window.QimenApp.getQuestion() : '') || '未说明',
        yongShenTargets: yongShenTargets(params.category, params.gender),
        method: 'coins',
        yaoValues: params.yaoValues,
        date: params.date,
        timezone: 'Asia/Shanghai',
        detailLevel: 'full'
      });
      state.out = out;
      render(out);
      if (hooks.onCast) hooks.onCast(params, out);
    } catch (e) {
      if (view) view.innerHTML = '<div class="ly-err">装卦失败：' + esc(e && e.message) + '</div>';
    }
  }

  // 同一卦，换问事类别/性别 → 重算用神
  async function recastAnalysis() {
    if (!state.out || !state.params) return;
    state.params.category = window.QimenApp ? window.QimenApp.getCategory() : state.params.category;
    state.params.gender = getGender();
    try {
      var out = await T.calculateLiuyao({
        question: (window.QimenApp ? window.QimenApp.getQuestion() : '') || '未说明',
        yongShenTargets: yongShenTargets(state.params.category, state.params.gender),
        method: 'coins',
        yaoValues: state.params.yaoValues,
        date: state.params.date,
        timezone: 'Asia/Shanghai',
        detailLevel: 'full'
      });
      state.out = out;
      render(out);
    } catch (e) { /* 保留旧结果 */ }
  }

  function getGender() {
    var r = document.querySelector('input[name="lyGender"]:checked');
    return r ? r.value : '';
  }

  // —— 渲染 ——
  function yaoAt(out, pos) {
    var ys = out.fullYaos || [];
    for (var i = 0; i < ys.length; i++) if (ys[i].position === pos) return ys[i];
    return null;
  }

  function fuShenAt(out, pos) {
    var fs = out.fuShen || [];
    for (var i = 0; i < fs.length; i++) if (fs[i].feiShenPosition === pos) return fs[i];
    return null;
  }

  function strengthTxt(y) {
    if (!y || !y.strength) return '';
    var s = y.strength;
    return (s.wangShuai || '') + (s.isStrong ? '' : '');
  }

  function tagCls(s) {
    if (s === 'strong') return 'ly-tag-good';
    if (s === 'weak') return 'ly-tag-bad';
    return 'ly-tag-mid';
  }

  function render(out) {
    var view = document.getElementById('liuyaoView');
    if (!view) return;
    view.innerHTML = headerHtml(out) + tableHtml(out) + yongShenHtml(out) + yingqiHtml(out) + miscHtml(out);
  }

  function headerHtml(out) {
    var gz = out.ganZhiTime || {};
    var g = function (p) { return p ? (p.gan + p.zhi) : ''; };
    var kong = (out.kongWang && out.kongWang.kongDizhi || []).join('');
    var badges = [];
    if (out.liuChongGuaInfo && out.liuChongGuaInfo.isLiuChongGua) badges.push('六冲卦');
    if (out.liuHeGuaInfo && out.liuHeGuaInfo.isLiuHeGua) badges.push('六合卦');
    if (out.guaFanFuYin && out.guaFanFuYin.isFanYin) badges.push('反吟');
    if (out.guaFanFuYin && out.guaFanFuYin.isFuYin) badges.push('伏吟');
    if (out.sanHeAnalysis && out.sanHeAnalysis.hasFullSanHe) badges.push('三合局');
    var brief = out.hexagramBrief ? '<div class="ly-brief">' + esc(out.hexagramBrief) + '</div>' : '';
    return '<div class="ly-head">' +
      '<div class="ly-name">' + esc(out.hexagramName) +
        '<span class="ly-gong">' + esc(out.hexagramGong || '') + '宫 · ' + esc(out.hexagramElement || '') + '</span></div>' +
      (out.changedHexagramName ? '<div class="ly-change">之卦：' + esc(out.changedHexagramName) +
        (out.changedHexagramGong ? '（' + esc(out.changedHexagramGong) + '宫 · ' + esc(out.changedHexagramElement || '') + '）' : '') + '</div>' : '') +
      '<div class="ly-meta">' + [g(gz.year) + '年', g(gz.month) + '月', g(gz.day) + '日', g(gz.hour) + '时'].join(' ') +
        (kong ? ' · 旬空 ' + esc(kong) : '') + '</div>' +
      (badges.length ? '<div class="ly-badges">' + badges.map(function (b) { return '<span class="ly-badge">' + b + '</span>'; }).join('') + '</div>' : '') +
      brief +
      '</div>';
  }

  function tableHtml(out) {
    var rows = '';
    for (var pos = 6; pos >= 1; pos--) {
      var y = yaoAt(out, pos);
      if (!y) continue;
      var isYang = !(y.type === 0 || y.type === 'yin');
      var moving = !!y.isChanging;
      var tags = [];
      if (y.isShiYao) tags.push('<span class="ly-pos-tag shi">世</span>');
      if (y.isYingYao) tags.push('<span class="ly-pos-tag ying">应</span>');
      if (y.kongWangState && y.kongWangState !== 'not_kong') tags.push('<span class="ly-tiny">空</span>');
      var fu = fuShenAt(out, pos);
      var fuHtml = fu ? '<div class="ly-sub"><span class="ly-fu-label">伏</span>' +
        esc(fu.liuQin) + ' ' + esc(fu.naJia) + esc(fu.wuXing) + '</div>' : '';
      var ch = y.changedYao;
      var chHtml = ch ? '<div class="ly-sub ly-changed"><span class="ly-fu-label">变</span>' +
        esc(ch.liuQin || '') + ' ' + esc(ch.naJia || '') + esc(ch.wuXing || '') + '</div>' : '';
      var evidence = (y.strength && y.strength.evidence || []).slice(0, 2).join('、');
      rows += '<div class="ly-row' + (moving ? ' is-moving' : '') + '">' +
        '<div class="ly-row-main">' +
          '<span class="ly-shen">' + esc(y.liuShen || '') + '</span>' +
          '<span class="ly-qin">' + esc(y.liuQin || '') + '</span>' +
          '<span class="ly-gan">' + esc(y.naJia || '') + esc(y.wuXing || '') + '</span>' +
          '<span class="ly-bar ' + (isYang ? 'yang' : 'yin') + '"></span>' +
          (moving ? '<span class="ly-move">' + (y.type === 9 || y.type === 'laoYang' ? '○' : '×') + '</span>' : '<span class="ly-move"></span>') +
          '<span class="ly-pos-tags">' + tags.join('') + '</span>' +
        '</div>' +
        (evidence ? '<div class="ly-ev">' + esc(evidence) + '</div>' : '') +
        fuHtml + chHtml +
        '</div>';
    }
    return '<div class="ly-table">' + rows + '</div>';
  }

  function yongShenHtml(out) {
    var groups = out.yongShen || [];
    if (!groups.length) return '';
    var cards = groups.map(function (g) {
      var sel = g.selected || {};
      var cand = (g.candidates || []).filter(function (c) { return c.position !== sel.position; });
      var candHtml = cand.length ? '<div class="ly-cand">另见：' + cand.map(function (c) {
        return YAO_POS[c.position - 1] + ' ' + esc(c.liuQin) + esc(c.naJia) + esc(c.element || '') +
          '（' + esc(c.strengthLabel || '') + (c.movementLabel ? '·' + esc(c.movementLabel) : '') + '）';
      }).join('；') + '</div>' : '';
      return '<div class="ly-card">' +
        '<div class="ly-card-head">用神 · ' + esc(g.targetLiuQin) + '</div>' +
        '<div class="ly-card-line">取 ' + YAO_POS[(sel.position || 1) - 1] + '　' +
          esc(sel.liuQin || '') + ' ' + esc(sel.naJia || '') + esc(sel.element || '') +
          '　<span class="ly-tag ' + tagCls(sel.strength) + '">' + esc(sel.strengthLabel || '') + '</span>' +
          (sel.movementLabel ? '　<span class="ly-tag">' + esc(sel.movementLabel) + '</span>' : '') +
          (sel.kongWangState && sel.kongWangState !== 'not_kong' ? '　<span class="ly-tag">空</span>' : '') +
          (sel.isShiYao ? '　<span class="ly-tag">世</span>' : '') + '</div>' +
        ((sel.evidence || []).length ? '<div class="ly-card-line ly-dim">' + esc(sel.evidence.join('；')) + '</div>' : '') +
        (g.selectionNote ? '<div class="ly-card-line ly-dim">' + esc(g.selectionNote) + '</div>' : '') +
        candHtml + '</div>';
    }).join('');
    return '<div class="ly-section"><div class="ly-sec-title">用神</div>' + cards + '</div>';
  }

  function yingqiHtml(out) {
    var list = out.timeRecommendations || [];
    if (!list.length) return '';
    var items = list.map(function (t) {
      return '<div class="ly-card">' +
        '<div class="ly-card-head">应期 · ' + esc(t.targetLiuQin || '') +
          (t.type === 'favorable' ? '（有生机）' : t.type === 'unfavorable' ? '（受阻）' : '') + '</div>' +
        '<div class="ly-card-line"><b>' + esc(t.trigger || '') + '</b></div>' +
        (t.description ? '<div class="ly-card-line ly-dim">' + esc(t.description) + '</div>' : '') +
        ((t.basis || []).length ? '<div class="ly-card-line ly-dim">依据：' + esc(t.basis.join('；')) + '</div>' : '') +
        '</div>';
    }).join('');
    return '<div class="ly-section"><div class="ly-sec-title">应期推算</div>' + items +
      '<div class="ly-note">应期为线索，不作定论；依《增删卜易》《卜筮正宗》取用。</div></div>';
  }

  function miscHtml(out) {
    var parts = [];
    var sys = out.shenSystemByYongShen || [];
    if (sys.length) {
      var rows = sys.map(function (s) {
        var f = function (o) {
          if (!o) return '—';
          return esc(o.liuQin || '') + ' ' + esc(o.wuXing || '') +
            ((o.positions || []).length ? '（' + o.positions.map(function (p) { return YAO_POS[p - 1]; }).join('、') + '）' : '');
        };
        return '<div class="ly-card-line">' + esc(s.targetLiuQin) + ' → 原神 ' + f(s.yuanShen) +
          '｜忌神 ' + f(s.jiShen) + '｜仇神 ' + f(s.chouShen) + '</div>';
      }).join('');
      parts.push('<div class="ly-section"><div class="ly-sec-title">原神 · 忌神 · 仇神</div><div class="ly-card">' + rows + '</div></div>');
    }
    var extras = [];
    if (out.liuChongGuaInfo && out.liuChongGuaInfo.description) extras.push('六冲：' + out.liuChongGuaInfo.description);
    if (out.liuHeGuaInfo && out.liuHeGuaInfo.description) extras.push('六合：' + out.liuHeGuaInfo.description);
    if (out.guaFanFuYin) {
      if (out.guaFanFuYin.isFanYin && out.guaFanFuYin.fanYinDescription) extras.push('反吟：' + out.guaFanFuYin.fanYinDescription);
      if (out.guaFanFuYin.isFuYin && out.guaFanFuYin.fuYinDescription) extras.push('伏吟：' + out.guaFanFuYin.fuYinDescription);
    }
    if (out.sanHeAnalysis && out.sanHeAnalysis.hasFullSanHe) {
      var sh = out.sanHeAnalysis.fullSanHe;
      if (sh && sh.description) extras.push('三合：' + sh.description);
    }
    if ((out.globalShenSha || []).length) extras.push('卦神煞：' + out.globalShenSha.join('、'));
    if (out.guaShen && out.guaShen.branch) {
      extras.push('卦身：' + out.guaShen.branch + (out.guaShen.absent ? '（不上卦）' : '（' + YAO_POS[(out.guaShen.linePosition || 1) - 1] + '）'));
    }
    if (extras.length) {
      parts.push('<div class="ly-section"><div class="ly-sec-title">卦象特征</div><div class="ly-card">' +
        extras.map(function (x) { return '<div class="ly-card-line">' + esc(x) + '</div>'; }).join('') + '</div></div>');
    }
    if (out.guaCi) {
      parts.push('<details class="ly-details"><summary>卦辞 · 象辞</summary>' +
        '<div class="ly-card-line"><b>' + esc(out.hexagramName) + '</b>：' + esc(out.guaCi) + '</div>' +
        (out.xiangCi ? '<div class="ly-card-line ly-dim">' + esc(out.xiangCi) + '</div>' : '') +
        (out.changedGuaCi ? '<div class="ly-card-line"><b>之卦 ' + esc(out.changedHexagramName) + '</b>：' + esc(out.changedGuaCi) + '</div>' : '') +
        '</details>');
    }
    return parts.join('');
  }

  // —— prompt ——
  var SYSTEM_PROMPT = '你是一位精通六爻纳甲（京房易）的断卦老师。请严格依据下方排盘数据断卦，数据之外的信息一律不要编造。\n' +
    '断卦按以下顺序，逐步说明依据：\n' +
    '1. 取用神：先看【用神】里为所问之事确定的六亲（父母/兄弟/子孙/妻财/官鬼）；用神两现时，按「舍其被伤，用其不伤」与旺衰取舍，并说明理由；\n' +
    '2. 看旺衰：用神在月建、日辰下的旺相休囚死，是否月破、日破、旬空、入墓、化绝；\n' +
    '3. 看动静：用神是动是静；动而化进、化退、化空、化绝、回头生克；静爻是否得日辰生扶；\n' +
    '4. 看生克：原神（生用神）、忌神（克用神）、仇神的作用；世爻（求测人）与应爻（对方/事体）的关系；\n' +
    '5. 定吉凶：综合旺衰、生克、空破墓绝，给出成败倾向与关键点，不绝对化；\n' +
    '6. 定应期：优先采用【应期推算】给出的触发条件与依据；若标为不明确，就写「应期不明」，不可自造日期；\n' +
    '7. 建议：结合【补充现状】，给出可执行的具体建议，紧扣卦象，不空谈、不夸大。\n' +
    '输出要求：\n' +
    '1. 分点输出：卦象总览、成败判断、关键因素、应期（若可判断）、具体建议；\n' +
    '2. 术语保留但用白话解释；\n' +
    '3. 客观中立、不制造焦虑；\n' +
    '4. 排盘数据不足以支撑某个判断时，直接说「依据不足」，不要臆测；神煞只作辅助参断；\n' +
    '5. 结尾附一句「本解读仅供娱乐参考，人生决策请结合现实理性判断」。';

  function buildPrompt(out, question, context, category, gender) {
    var gz = out.ganZhiTime || {};
    var g = function (p) { return p ? (p.gan + p.zhi) : ''; };
    var L = [];
    L.push('【问事】');
    L.push('问题：' + (question || '未填写'));
    if (context) L.push('补充现状：' + context);
    L.push('问事类别：' + (category || '综合') + (category === '婚姻' && gender ? '（' + (gender === 'male' ? '男' : '女') + '问）' : ''));
    L.push('');
    L.push('【起卦】');
    L.push('干支：' + g(gz.year) + '年 ' + g(gz.month) + '月 ' + g(gz.day) + '日 ' + g(gz.hour) + '时' + (gz.xun ? '（' + gz.xun + '）' : ''));
    L.push('旬空：' + ((out.kongWang && out.kongWang.kongDizhi) || []).join('') || '无');
    L.push('起卦方式：三枚铜钱手摇六次（' + (out.calculationOptions && out.calculationOptions.yaoValues || []).join(',') + '）');
    L.push('');
    L.push('【卦象】');
    L.push('本卦：' + out.hexagramName + '（' + out.hexagramGong + '宫 · ' + out.hexagramElement + '）');
    if (out.changedHexagramName) L.push('变卦：' + out.changedHexagramName + '（' + (out.changedHexagramGong || '') + '宫 · ' + (out.changedHexagramElement || '') + '）');
    var feats = [];
    if (out.liuChongGuaInfo && out.liuChongGuaInfo.isLiuChongGua) feats.push('六冲卦');
    if (out.liuHeGuaInfo && out.liuHeGuaInfo.isLiuHeGua) feats.push('六合卦');
    if (out.guaFanFuYin && out.guaFanFuYin.isFanYin) feats.push('反吟');
    if (out.guaFanFuYin && out.guaFanFuYin.isFuYin) feats.push('伏吟');
    if (feats.length) L.push('卦体特征：' + feats.join('、'));
    L.push('');
    L.push('【六爻】（自上而下）');
    for (var pos = 6; pos >= 1; pos--) {
      var y = yaoAt(out, pos);
      if (!y) continue;
      var bits = [];
      bits.push(YAO_POS[pos - 1]);
      bits.push(y.liuShen);
      bits.push(y.liuQin + y.naJia + y.wuXing);
      bits.push((y.type === 0 || y.type === 'yin') ? '阴爻' : '阳爻');
      if (y.isShiYao) bits.push('世');
      if (y.isYingYao) bits.push('应');
      bits.push(y.movementLabel || '');
      if (y.kongWangState && y.kongWangState !== 'not_kong') bits.push('旬空');
      if (y.strength && y.strength.wangShuai) bits.push(y.strength.wangShuai);
      if (y.strength && y.strength.specialStatus && y.strength.specialStatus !== 'none') bits.push(y.strength.specialStatus);
      if (y.influence && y.influence.description) bits.push(y.influence.description);
      var fu = fuShenAt(out, pos);
      if (fu) bits.push('伏神 ' + fu.liuQin + fu.naJia + fu.wuXing);
      if (y.changedYao) bits.push('变 ' + (y.changedYao.liuQin || '') + (y.changedYao.naJia || '') + (y.changedYao.wuXing || ''));
      L.push('- ' + bits.filter(Boolean).join('　'));
    }
    L.push('');
    L.push('【用神】');
    (out.yongShen || []).forEach(function (grp) {
      var s = grp.selected || {};
      L.push('- ' + grp.targetLiuQin + '：取' + YAO_POS[(s.position || 1) - 1] + '，' + s.liuQin + s.naJia + s.element +
        '，' + (s.strengthLabel || '') + '，' + (s.movementLabel || '') +
        (s.kongWangState && s.kongWangState !== 'not_kong' ? '，旬空' : '') +
        ((s.evidence || []).length ? '（' + s.evidence.join('；') + '）' : ''));
      if (grp.selectionNote) L.push('  取舍：' + grp.selectionNote);
    });
    var sys = out.shenSystemByYongShen || [];
    if (sys.length) {
      L.push('');
      L.push('【原忌仇神】');
      sys.forEach(function (s) {
        var f = function (o) { return o ? (o.liuQin + o.wuXing + (o.positions || []).length ? '（' + (o.positions || []).map(function (p) { return YAO_POS[p - 1]; }).join('、') + '）' : '') : '—'; };
        L.push('- ' + s.targetLiuQin + '：原神 ' + f(s.yuanShen) + '；忌神 ' + f(s.jiShen) + '；仇神 ' + f(s.chouShen));
      });
    }
    var yq = out.timeRecommendations || [];
    if (yq.length) {
      L.push('');
      L.push('【应期推算】');
      yq.forEach(function (t) {
        L.push('- ' + t.targetLiuQin + '：' + t.trigger + (t.description ? '（' + t.description + '）' : ''));
      });
    }
    if (out.guaCi) {
      L.push('');
      L.push('【卦辞】');
      L.push(out.hexagramName + '：' + out.guaCi);
      if (out.changedHexagramName && out.changedGuaCi) L.push('之卦 ' + out.changedHexagramName + '：' + out.changedGuaCi);
    }
    return L.join('\n');
  }

  // —— 历史回放 ——
  async function loadEntry(entry) {
    state.yao = (entry.yaoValues || []).slice(0, 6);
    renderSlots(-1);
    state.params = { yaoValues: state.yao.slice(), date: isoFromTs(entry.ts), category: entry.category, gender: entry.gender || '' };
    try {
      var out = await T.calculateLiuyao({
        question: entry.question || '未说明',
        yongShenTargets: yongShenTargets(entry.category, entry.gender || ''),
        method: 'coins',
        yaoValues: state.yao,
        date: state.params.date,
        timezone: 'Asia/Shanghai',
        detailLevel: 'full'
      });
      state.out = out;
      render(out);
      return out;
    } catch (e) {
      var view = document.getElementById('liuyaoView');
      if (view) view.innerHTML = '<div class="ly-err">回放失败：' + esc(e && e.message) + '</div>';
      return null;
    }
  }

  function isoFromTs(ts) {
    var d = new Date(ts);
    return localIso(d);
  }

  function init(opts) {
    hooks.onCast = (opts && opts.onCast) || null;
    hooks.onCategory = (opts && opts.onCategory) || null;
    var btnShake = document.getElementById('btnShake');
    if (btnShake) btnShake.addEventListener('click', shakeOnce);
    var btnQuick = document.getElementById('btnQuickCast');
    if (btnQuick) btnQuick.addEventListener('click', quickCast);
    var btnManual = document.getElementById('btnManualCast');
    if (btnManual) btnManual.addEventListener('click', openManual);
    renderSlots(-1);
  }

  window.QimenLiuyao = {
    init: init,
    cast: doCast,
    recastAnalysis: recastAnalysis,
    render: render,
    reset: resetCast,
    loadEntry: loadEntry,
    buildPrompt: buildPrompt,
    SYSTEM_PROMPT: SYSTEM_PROMPT,
    getState: function () { return state; },
    yongShenTargets: yongShenTargets
  };
})();
