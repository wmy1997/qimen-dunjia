// 奇门规则引擎：神煞 + 应期推算
// 神煞对照表口径参考 atopx/qimen（MIT）的 shensha 包；应期规则按传统时家奇门断应期法自实现。
// 说明：驿马沿用 3meta 的「时支起马」（时家奇门惯例），本模块不重复计算，只补其余神煞。
(function (global) {
  'use strict';

  var BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  // 地支 → 落宫（子1 丑寅8 卯3 辰巳4 午9 未申2 酉7 戌亥6）
  var BRANCH_PALACE = {
    '子': 1, '丑': 8, '寅': 8, '卯': 3, '辰': 4, '巳': 4,
    '午': 9, '未': 2, '申': 2, '酉': 7, '戌': 6, '亥': 6
  };
  var PALACE_BRANCHES = {
    1: ['子'], 2: ['未', '申'], 3: ['卯'], 4: ['辰', '巳'], 5: [],
    6: ['戌', '亥'], 7: ['酉'], 8: ['丑', '寅'], 9: ['午']
  };

  var CHONG = {
    '子': '午', '午': '子', '丑': '未', '未': '丑', '寅': '申', '申': '寅',
    '卯': '酉', '酉': '卯', '辰': '戌', '戌': '辰', '巳': '亥', '亥': '巳'
  };
  var HE = {
    '子': '丑', '丑': '子', '寅': '亥', '亥': '寅', '卯': '戌', '戌': '卯',
    '辰': '酉', '酉': '辰', '巳': '申', '申': '巳', '午': '未', '未': '午'
  };
  // 三合局
  var SANHE = {
    '申': '水', '子': '水', '辰': '水',
    '亥': '木', '卯': '木', '未': '木',
    '寅': '火', '午': '火', '戌': '火',
    '巳': '金', '酉': '金', '丑': '金'
  };
  var SANHE_GROUP = {
    '水': ['申', '子', '辰'], '木': ['亥', '卯', '未'],
    '火': ['寅', '午', '戌'], '金': ['巳', '酉', '丑']
  };

  var STEM_WUXING = {
    '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土',
    '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水'
  };
  var BRANCH_WUXING = {
    '子': '水', '丑': '土', '寅': '木', '卯': '木', '辰': '土', '巳': '火',
    '午': '火', '未': '土', '申': '金', '酉': '金', '戌': '土', '亥': '水'
  };
  var WX_SHENG = { '木': '火', '火': '土', '土': '金', '金': '水', '水': '木' }; // X 生 Y
  var WX_KE = { '木': '土', '土': '水', '水': '火', '火': '金', '金': '木' };    // X 克 Y

  // 旬首 → 遁干
  var XUN_DUN = {
    '甲子': '戊', '甲戌': '己', '甲申': '庚',
    '甲午': '辛', '甲辰': '壬', '甲寅': '癸'
  };

  // ————————————————————— 神煞表 —————————————————————
  // 桃花（咸池）：申子辰见酉、巳酉丑见午、寅午戌见卯、亥卯未见子
  var TAOHUA = [9, 6, 3, 0, 9, 6, 3, 0, 9, 6, 3, 0];
  // 华盖：三合局之墓库
  var HUAGAI = [4, 1, 10, 7, 4, 1, 10, 7, 4, 1, 10, 7];
  // 天乙贵人（日干 → 两支）
  var TIANYI = [
    [1, 7], [0, 8], [11, 9], [11, 9], [1, 7],
    [0, 8], [6, 2], [6, 2], [5, 3], [5, 3]
  ];
  // 天德贵人（月支 → 天干或地支）
  var TIANDE = [
    { isStem: false, v: 5 },  // 子月 → 巳
    { isStem: true, v: 6 },   // 丑月 → 庚
    { isStem: true, v: 3 },   // 寅月 → 丁
    { isStem: false, v: 8 },  // 卯月 → 申
    { isStem: true, v: 8 },   // 辰月 → 壬
    { isStem: true, v: 7 },   // 巳月 → 辛
    { isStem: false, v: 11 }, // 午月 → 亥
    { isStem: true, v: 0 },   // 未月 → 甲
    { isStem: true, v: 9 },   // 申月 → 癸
    { isStem: false, v: 2 },  // 酉月 → 寅
    { isStem: true, v: 2 },   // 戌月 → 丙
    { isStem: true, v: 1 }    // 亥月 → 乙
  ];
  // 月德贵人（月支 → 天干）：寅午戌见丙、申子辰见壬、亥卯未见甲、巳酉丑见庚
  var YUEDE = [8, 6, 2, 0, 8, 6, 2, 0, 8, 6, 2, 0];
  // 国印贵人（年干 → 地支）
  var GUOYIN = [10, 11, 1, 2, 1, 2, 4, 5, 7, 8];
  // 文昌（日干 → 地支）
  var WENCHANG = [5, 6, 8, 9, 8, 9, 11, 0, 2, 3];
  // 禄神（日干 → 地支，临官位）
  var LUSHEN = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0];
  // 羊刃（阳干 → 地支；阴干无）
  var YANGREN = [3, -1, 6, -1, 6, -1, 9, -1, 0, -1];

  var SHENSHA_META = {
    '天乙贵人': { auspice: '吉', desc: '逢凶化吉、得贵人相助' },
    '天德贵人': { auspice: '吉', desc: '上天之德庇佑，化灾解难' },
    '月德贵人': { auspice: '吉', desc: '月令之德庇佑，品行端正、少灾' },
    '国印贵人': { auspice: '吉', desc: '掌权印信、仕途文书之利' },
    '文昌': { auspice: '吉', desc: '利学业、文书、考试、谋划' },
    '禄神': { auspice: '吉', desc: '主俸禄衣食、财源稳定' },
    '华盖': { auspice: '中', desc: '主孤高清雅、艺术宗教之缘' },
    '桃花': { auspice: '中', desc: '主人缘异性缘，亦主感情牵连' },
    '羊刃': { auspice: '凶', desc: '刚猛之气，防冲动、血光、刑伤' }
  };

  function idxBranch(ch) { return BRANCHES.indexOf(ch); }
  function idxStem(ch) { return ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'].indexOf(ch); }

  function stemArr(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    return v === '无' ? [] : [v];
  }
  function branchArr(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    return (v === '无' || v === '中') ? [] : [v];
  }

  function findPalaceByEarthStem(chart, stem, onlyMain) {
    var out = [];
    (chart.palaces || []).forEach(function (p) {
      var arr = stemArr(p.earthlyStem);
      // 坤二宫等寄宫位的 earthlyStem 是 [本干, 寄中宫干]；找旬首宫必须只认本干
      var list = onlyMain ? arr.slice(0, 1) : arr;
      if (list.indexOf(stem) >= 0) out.push(p.position);
    });
    return out;
  }

  function pushSS(list, kind, palace, anchor) {
    if (!palace) return;
    list.push({
      name: kind,
      palace: palace,
      anchor: anchor,
      auspice: (SHENSHA_META[kind] || {}).auspice || '中',
      desc: (SHENSHA_META[kind] || {}).desc || ''
    });
  }

  // —— 神煞推算 ——
  function detectShenSha(chart) {
    var fp = chart.fourPillars || {};
    if (!fp.day || !fp.month || !fp.year) return [];
    var dayBranch = fp.day.branch;
    var dayStem = fp.day.stem;
    var monthBranch = fp.month.branch;
    var yearStem = fp.year.stem;

    var db = idxBranch(dayBranch);
    var ds = idxStem(dayStem);
    var mb = idxBranch(monthBranch);
    var ys = idxStem(yearStem);
    if (db < 0 || ds < 0 || mb < 0 || ys < 0) return [];

    var out = [];

    // 日支锚定
    pushSS(out, '桃花', BRANCH_PALACE[BRANCHES[TAOHUA[db]]], '日支' + dayBranch);
    pushSS(out, '华盖', BRANCH_PALACE[BRANCHES[HUAGAI[db]]], '日支' + dayBranch);

    // 日干锚定
    var ty = TIANYI[ds];
    pushSS(out, '天乙贵人', BRANCH_PALACE[BRANCHES[ty[0]]], '日干' + dayStem);
    if (ty[1] !== ty[0]) {
      pushSS(out, '天乙贵人', BRANCH_PALACE[BRANCHES[ty[1]]], '日干' + dayStem);
    }
    pushSS(out, '文昌', BRANCH_PALACE[BRANCHES[WENCHANG[ds]]], '日干' + dayStem);
    pushSS(out, '禄神', BRANCH_PALACE[BRANCHES[LUSHEN[ds]]], '日干' + dayStem);
    if (YANGREN[ds] >= 0) {
      pushSS(out, '羊刃', BRANCH_PALACE[BRANCHES[YANGREN[ds]]], '日干' + dayStem);
    }

    // 月支锚定：天德（可能是天干，需在九宫地盘干中找） / 月德（天干）
    var td = TIANDE[mb];
    if (td.isStem) {
      var tdStem = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'][td.v];
      findPalaceByEarthStem(chart, tdStem).forEach(function (pos) {
        pushSS(out, '天德贵人', pos, '月支' + monthBranch);
      });
    } else {
      pushSS(out, '天德贵人', BRANCH_PALACE[BRANCHES[td.v]], '月支' + monthBranch);
    }
    var ydStem = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'][YUEDE[mb]];
    findPalaceByEarthStem(chart, ydStem).forEach(function (pos) {
      pushSS(out, '月德贵人', pos, '月支' + monthBranch);
    });

    // 年干锚定
    pushSS(out, '国印贵人', BRANCH_PALACE[BRANCHES[GUOYIN[ys]]], '年干' + yearStem);

    // 去重（同名同宫只留一条）
    var seen = {};
    return out.filter(function (s) {
      var k = s.name + '@' + s.palace;
      if (seen[k]) return false;
      seen[k] = 1;
      return true;
    });
  }

  function groupByPalace(list) {
    var m = {};
    list.forEach(function (s) {
      (m[s.palace] = m[s.palace] || []).push(s);
    });
    return m;
  }

  // —— 应期推算 ——
  function countSteps(fromBranch, toBranch) {
    // 从 from 顺数到 to 的步数（含起点为 0）
    var a = idxBranch(fromBranch);
    var b = idxBranch(toBranch);
    if (a < 0 || b < 0) return 99;
    return (b - a + 12) % 12;
  }

  function nearestByDay(dayBranch, candidates) {
    var best = null;
    var bestN = 99;
    candidates.forEach(function (c) {
      var n = countSteps(dayBranch, c.branch);
      if (n < bestN) { bestN = n; best = c; }
    });
    return best;
  }

  function xunShouPalace(chart) {
    var xs = (chart.timeInfo || {}).xunShou || '';
    var dun = XUN_DUN[xs.slice(0, 2)];
    if (!dun) return 0;
    var pl = findPalaceByEarthStem(chart, dun, true);
    return pl.length ? pl[0] : 0;
  }

  function computeYingqi(chart, yongShenPos) {
    var fp = chart.fourPillars || {};
    if (!fp.day || !fp.hour) return null;

    var dayBranch = fp.day.branch;
    var dayStem = fp.day.stem;
    var hourBranch = fp.hour.branch;

    var pal = Number(yongShenPos) || 0;
    if (!pal) return null;
    // 转盘中五无门无星，按寄坤二论
    var branchPal = (pal === 5) ? 2 : pal;
    var palBranches = PALACE_BRANCHES[branchPal] || [];

    // ① 尺度：先判伏吟/反吟，再看内外盘
    // 判定口径：值符（= 旬首宫的本星）随时干加临，故
    //   伏吟 ⟺ 时干所居地盘宫 ＝ 旬首遁干所居地盘宫（值符加本宫，天盘干尽归地盘）
    //   反吟 ⟺ 二者相对（1-9 / 2-8 / 3-7 / 4-6）
    // 注意：这里必须用「地盘干本宫位」自行定位，不能用 3meta 的 zhiFu.position ──
    // 3meta 把中五/天禽统一归一化到坤二，会与寄宫时干混淆，导致伏吟命中率虚高到两倍。
    var xsPal = xunShouPalace(chart);
    var hourStem = (fp.hour || {}).stem || '';
    var hourPal = findPalaceByEarthStem(chart, hourStem, true)[0] || 0;

    var isFuYin = xsPal && hourPal && xsPal === hourPal;
    var isFanYin = xsPal && hourPal && xsPal !== 5 && hourPal !== 5 && (xsPal + hourPal === 10);

    var scale, scaleWhy, unit;
    if (isFanYin) {
      scale = '近快'; unit = '日／时';
      scaleWhy = '值符加临对宫，成反吟局，主变动急促，宜按日、时断';
    } else if (isFuYin) {
      scale = '远慢'; unit = '月／年';
      scaleWhy = '值符加临本宫，成伏吟局，主静守迟滞，宜按月、年断';
    } else {
      var io = '';
      (chart.palaces || []).forEach(function (p) {
        if (Number(p.position) === branchPal) io = p.innerOuter || '';
      });
      if (io === '内盘') {
        scale = '近快'; unit = '日／时';
        scaleWhy = '用神落内盘，主近、主快，宜按日、时断';
      } else if (io === '外盘') {
        scale = '远慢'; unit = '月／年';
        scaleWhy = '用神落外盘，主远、主迟，宜按月、年断' +
          ((branchPal === 2 || branchPal === 4 || branchPal === 6 || branchPal === 8) ? '（四维宫更主慢）' : '');
      } else {
        scale = '近快'; unit = '日／时';
        scaleWhy = '未成伏反吟，按常规取近断';
      }
    }

    // ② 应期支：按传统优先级链，先遇为应
    var branch = '';
    var basis = '';
    var voidness = (chart.timeInfo || {}).voidness || [];

    // (1) 用神宫逢旬空 → 填实 / 冲空，取自日支顺数先遇者
    var emptyHere = palBranches.filter(function (z) { return voidness.indexOf(z) >= 0; });
    if (emptyHere.length) {
      var cands = [];
      emptyHere.forEach(function (z) {
        cands.push({ branch: z, kind: '填实' });
        cands.push({ branch: CHONG[z], kind: '冲空' });
      });
      var pick = nearestByDay(dayBranch, cands);
      branch = pick.branch;
      basis = '用神宫逢旬空（' + emptyHere.join('、') + '），自起局日支' + dayBranch +
        '顺数，先遇' + pick.kind + '之' + pick.branch + '为应';
    }

    // (2) 用神宫临马星 → 马动 / 冲马
    if (!branch) {
      var ma = (chart.postHorse || {}).branch || '';
      if (ma && palBranches.indexOf(ma) >= 0) {
        var pc = nearestByDay(dayBranch, [
          { branch: ma, kind: '马动' },
          { branch: CHONG[ma], kind: '冲马' }
        ]);
        branch = pc.branch;
        basis = '用神宫临马星（' + ma + '），自' + dayBranch + '顺数，先遇' + pc.kind + '之' + pc.branch + '为应';
      }
    }

    // (3) 用神宫逢冲 → 逢冲以合为应
    if (!branch) {
      var hitChong = palBranches.filter(function (z) {
        return CHONG[z] === dayBranch || CHONG[z] === hourBranch;
      });
      if (hitChong.length) {
        branch = HE[hitChong[0]];
        basis = '用神宫' + hitChong[0] + '逢冲（' + CHONG[hitChong[0]] + '），逢冲以合为应，取' + branch;
      }
    }

    // (4) 用神宫逢合 → 逢合以冲为应
    if (!branch) {
      var hitHe = palBranches.filter(function (z) {
        return HE[z] === dayBranch || HE[z] === hourBranch;
      });
      if (hitHe.length) {
        branch = CHONG[hitHe[0]];
        basis = '用神宫' + hitHe[0] + '逢合（' + HE[hitHe[0]] + '），逢合以冲为应，取' + branch;
      }
    }

    // (5) 日干入墓于用神宫 → 冲墓为应
    if (!branch) {
      var tombHit = false;
      var tombBranch = '';
      (chart.palaces || []).forEach(function (p) {
        if (Number(p.position) !== branchPal) return;
        var ti = p.tombInfo || {};
        if (ti.dayStemInTomb) {
          var bs = branchArr(p.earthBranch);
          var mu = { '木': '未', '火': '戌', '土': '戌', '金': '丑', '水': '辰' }[STEM_WUXING[dayStem] || ''];
          tombHit = true;
          tombBranch = (bs.indexOf(mu) >= 0 ? mu : (bs[0] || ''));
        }
      });
      if (tombHit && tombBranch) {
        branch = CHONG[tombBranch];
        basis = '日干' + dayStem + '入墓于用神宫（墓支' + tombBranch + '），以冲墓之' + branch + '为应';
      }
    }

    // (6) 日支时支同三合 → 待缺支透出
    if (!branch) {
      var hj = SANHE[dayBranch];
      if (hj && hj === SANHE[hourBranch]) {
        var need = SANHE_GROUP[hj].filter(function (z) { return z !== dayBranch && z !== hourBranch; });
        if (need.length === 1) {
          branch = need[0];
          basis = '日支' + dayBranch + '与时支' + hourBranch + '同属' + hj + '局，缺' + need[0] + '，待其透出为应';
        }
      }
    }

    // (7) 依日干旺衰取月令或生扶
    if (!branch) {
      var monthBranch = (fp.month || {}).branch || '';
      var mwx = BRANCH_WUXING[monthBranch] || '';
      var dwx = STEM_WUXING[dayStem] || '';
      var state = '';
      if (mwx === dwx) state = '旺';                       // 与月令同气
      else if (WX_SHENG[mwx] === dwx) state = '相';        // 月令生我
      else if (WX_SHENG[dwx] === mwx) state = '休';        // 我生月令
      else if (WX_KE[dwx] === mwx) state = '囚';           // 我克月令
      else if (WX_KE[mwx] === dwx) state = '死';           // 月令克我
      if (state === '旺' || state === '相') {
        branch = monthBranch;
        basis = '日干' + dayStem + '（' + dwx + '）于' + monthBranch + '月得' + state +
          '，以当令之月' + monthBranch + '为应（速）';
      } else {
        // 取生我五行对应地支
        var shengMe = '';
        Object.keys(WX_SHENG).forEach(function (k) { if (WX_SHENG[k] === dwx) shengMe = k; });
        var cand = BRANCHES.filter(function (z) { return BRANCH_WUXING[z] === shengMe; });
        branch = cand[0] || monthBranch;
        basis = '日干' + dayStem + '于' + monthBranch + '月处' + state +
          '，须待生扶（' + shengMe + '）转旺，取' + branch + '为应（迟）';
      }
    }

    // ③ 值使宫数
    var zsPos = Number((chart.zhiShi || {}).position) || 0;
    var zsGate = (chart.zhiShi || {}).gate || '';
    var zsCount = zsPos || 0;

    return {
      scale: scale,
      scaleWhy: scaleWhy,
      unit: unit,
      branch: branch,
      basis: basis,
      zhishi: {
        palace: zsCount,
        gate: zsGate,
        count: zsCount,
        text: zsCount
          ? '值使' + zsGate + '落' + zsCount + '宫 → 事期约 ' + zsCount + ' 个' + unit + '单位' +
            (scaleWhy.indexOf('反吟') >= 0 ? '（反吟主提前）' : (scaleWhy.indexOf('伏吟') >= 0 ? '（伏吟主延后）' : ''))
          : ''
      },
      yongShenPalace: pal,
      palBranches: palBranches,
      branchPalace: BRANCH_PALACE[branch] || 0,
      voidness: voidness
    };
  }

  global.QimenRules = {
    detectShenSha: detectShenSha,
    groupByPalace: groupByPalace,
    computeYingqi: computeYingqi,
    BRANCH_PALACE: BRANCH_PALACE,
    PALACE_BRANCHES: PALACE_BRANCHES,
    SHENSHA_META: SHENSHA_META
  };
})(window);
