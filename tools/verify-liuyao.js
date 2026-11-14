/* 六爻装卦层独立校验：用传统表格独立实现纳甲/六亲/世应/六神/旬空，与 taibu 逐卦比对 */
var fs=require('fs'), vm=require('vm');
var sandbox={console:console,setTimeout:setTimeout,clearTimeout:clearTimeout,TextEncoder:TextEncoder,TextDecoder:TextDecoder};
sandbox.window=sandbox; sandbox.self=sandbox; sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('./vendor/liuyao.min.js','utf8'), sandbox);
var T=sandbox.TaibuLiuyao;

// ---- 独立表格（手写自传统规则） ----
var TRI={ '乾':[1,1,1], '兑':[1,1,0], '离':[1,0,1], '震':[1,0,0], '巽':[0,1,1], '坎':[0,1,0], '艮':[0,0,1], '坤':[0,0,0] }; // (初,二,三) 1=阳
var TRI_BY_BITS={}; Object.keys(TRI).forEach(function(k){ TRI_BY_BITS[TRI[k].join('')]=k; });
var TRI_WX={ '乾':'金','兑':'金','离':'火','震':'木','巽':'木','坎':'水','艮':'土','坤':'土' };
// 纳甲：内卦、外卦各三爻干支
var NAJIA={ '乾':{in:['甲子','甲寅','甲辰'],out:['壬午','壬申','壬戌']},
            '坤':{in:['乙未','乙巳','乙卯'],out:['癸丑','癸亥','癸酉']},
            '震':{in:['庚子','庚寅','庚辰'],out:['庚午','庚申','庚戌']},
            '巽':{in:['辛丑','辛亥','辛酉'],out:['辛未','辛巳','辛卯']},
            '坎':{in:['戊寅','戊辰','戊午'],out:['戊申','戊戌','戊子']},
            '离':{in:['己卯','己丑','己亥'],out:['己酉','己未','己巳']},
            '艮':{in:['丙辰','丙午','丙申'],out:['丙戌','丙子','丙寅']},
            '兑':{in:['丁巳','丁卯','丁丑'],out:['丁亥','丁酉','丁未']} };
var GAN=['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'], ZHI=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
var ZHI_WX={'子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'};
var SHENG={'木':'火','火':'土','土':'金','金':'水','水':'木'}, KE={'木':'土','土':'水','水':'火','火':'金','金':'木'};
function liuqin(gongWx, yaoWx){
  if(gongWx===yaoWx) return '兄弟';
  if(SHENG[yaoWx]===gongWx) return '父母';      // 生我
  if(SHENG[gongWx]===yaoWx) return '子孙';      // 我生
  if(KE[yaoWx]===gongWx) return '官鬼';         // 克我
  if(KE[gongWx]===yaoWx) return '妻财';         // 我克
  return '?';
}
// 八宫生成
var SHI_OF=['本宫','一世','二世','三世','四世','五世','游魂','归魂'];
var SHI_POS=[6,1,2,3,4,5,4,3];
function genGong(bits){
  // bits 1..6 (初..上)，1=阳
  var out={};
  function flip(arr,idx){ var c=arr.slice(); idx.forEach(function(i){ c[i-1]=c[i-1]?0:1; }); return c; }
  var seq=[
    [], [1], [1,2], [1,2,3], [1,2,3,4], [1,2,3,4,5],
    [1,2,3,5],           // 游魂：五世再变四（即四不变）
    [5]                  // 归魂：游魂内卦三爻全变回本宫 → 相对本宫只五爻变
  ];
  seq.forEach(function(f,si){ out[flip(bits,f).join('')]={pos:SHI_POS[si],name:SHI_OF[si]}; });
  return out;
}
var GONG_MAP={};  // bits -> {gong, shiPos}
['乾','坎','艮','震','巽','离','坤','兑'].forEach(function(g){
  var t=TRI[g]; var bits=[t[0],t[1],t[2],t[0],t[1],t[2]];
  var m=genGong(bits);
  Object.keys(m).forEach(function(k){ if(GONG_MAP[k]) throw new Error('重复 '+k); GONG_MAP[k]={gong:g,shi:m[k].pos,type:m[k].name}; });
});
if(Object.keys(GONG_MAP).length!==64) throw new Error('八宫覆盖不足 '+Object.keys(GONG_MAP).length);

// 六神
function liushenOf(dayGan){
  var start;
  if('甲乙'.indexOf(dayGan)>=0) start=0; else if('丙丁'.indexOf(dayGan)>=0) start=1;
  else if(dayGan==='戊') start=2; else if(dayGan==='己') start=3;
  else if('庚辛'.indexOf(dayGan)>=0) start=4; else start=5;
  var order=['青龙','朱雀','勾陈','螣蛇','白虎','玄武'];
  var r=[]; for(var i=0;i<6;i++) r.push(order[(start+i)%6]);
  return r;
}
function jiaziIndex(gz){ // 干支 -> 0..59
  var gi=GAN.indexOf(gz[0]), zi=ZHI.indexOf(gz[1]);
  for(var i=0;i<60;i++){ if(i%10===gi && i%12===zi) return i; }
  return -1;
}
function kongWangOf(dayGz){
  var idx=jiaziIndex(dayGz); var base=idx-idx%10;
  var z1=ZHI[(base+10)%12], z2=ZHI[(base+11)%12];
  return [z1,z2];
}
function branchOf(nj){ var s=String(nj||''); return s.length>=2 ? s[s.length-1] : s; }

(async function(){
  var DAY='2026-11-14T22:00:00+08:00';
  var stat={total:0, gong:0, shi:0, najia:0, liuqin:0, liushen:0, kong:0};
  var fails=[];
  var bitsAll=[]; for(var n=0;n<64;n++){ var b=[]; for(var i=0;i<6;i++) b.push((n>>i)&1); bitsAll.push(b); }
  for(var k=0;k<bitsAll.length;k++){
    var bits=bitsAll[k];
    var out=await T.calculateLiuyao({question:'校验', method:'coins', yaoValues:bits.map(function(b){return b?7:8;}),
      date:DAY, timezone:'Asia/Shanghai', detailLevel:'full', yongShenTargets:['父母','兄弟','子孙','妻财','官鬼']});
    stat.total++;
    var exp=GONG_MAP[bits.join('')];
    var gongWx=TRI_WX[exp.gong];
    var ok={gong:out.hexagramGong===exp.gong, el:out.hexagramElement===gongWx||out.hexagramElement===gongWx+'（'+exp.gong+'）'};
    if(!ok.gong) fails.push('宫 '+bits.join('')+' got='+out.hexagramGong+' exp='+exp.gong); else stat.gong++;
    var nei=TRI_BY_BITS[bits.slice(0,3).join('')], wai=TRI_BY_BITS[bits.slice(3,6).join('')];
    var naExp=NAJIA[nei].in.concat(NAJIA[wai].out);
    var dayGz=out.ganZhiTime.day.gan+out.ganZhiTime.day.zhi;
    var lsExp=liushenOf(out.ganZhiTime.day.gan);
    var kwExp=kongWangOf(dayGz);
    if(String(out.kongWang.kongDizhi).replace(/[\[\]]/g,'').split(',').join('')===kwExp.join('')||String(out.kongWang.kongDizhi).indexOf(kwExp[0])>=0) stat.kong++; else fails.push('旬空 got='+JSON.stringify(out.kongWang)+' exp='+kwExp.join(''));
    var yaoOkShi=true, yaoOkNa=true, yaoOkQin=true, yaoOkShen=true;
    out.fullYaos.forEach(function(y){
      var i=y.position-1;
      if(branchOf(String(y.naJia))!==branchOf(naExp[i])) { yaoOkNa=false; fails.push('纳甲 '+bits.join('')+' 爻'+(i+1)+' got='+y.naJia+' exp='+naExp[i]); }
      if(y.liuQin!==liuqin(gongWx, ZHI_WX[branchOf(naExp[i])])) { yaoOkQin=false; fails.push('六亲 爻'+(i+1)+' got='+y.liuQin+' exp='+liuqin(gongWx,ZHI_WX[branchOf(naExp[i])])); }
      if(y.liuShen!==lsExp[i]) { yaoOkShen=false; fails.push('六神 爻'+(i+1)+' got='+y.liuShen+' exp='+lsExp[i]); }
      var isShi=(i+1===exp.shi), isYing=(i+1===((exp.shi+2)%6)+1);
      if(!!y.isShiYao!==isShi||!!y.isYingYao!==isYing) { yaoOkShi=false; fails.push('世应 '+bits.join('')+' 爻'+(i+1)+' got shi='+y.isShiYao+' ying='+y.isYingYao+' exp shi='+isShi+' ying='+isYing); }
    });
    if(yaoOkNa) stat.najia++; if(yaoOkQin) stat.liuqin++; if(yaoOkShen) stat.liushen++; if(yaoOkShi) stat.shi++;
  }

  var NAME_CHECK={'111111':'乾为天','010010':'坎为水','001001':'艮为山','100100':'震为雷','011011':'巽为风','101101':'离为火','000000':'坤为地','110110':'兑为泽',
    '111101':'火天大有','010000':'地水师','001011':'风山渐','100110':'泽雷随','011001':'山风蛊','101011':'风火家人','000010':'水地比','110100':'雷泽归妹'};
  var nmOk=0, nmFail=[];
  for(var q=0;q<bitsAll.length;q++){
    var bb=bitsAll[q].join(''); if(!NAME_CHECK[bb]) continue;
    var o2=await T.calculateLiuyao({question:'名', method:'coins', yaoValues:bitsAll[q].map(function(b){return b?7:8;}), date:DAY, timezone:'Asia/Shanghai', detailLevel:'full', yongShenTargets:['兄弟']});
    if(o2.hexagramName===NAME_CHECK[bb]) nmOk++; else nmFail.push(bb+' got='+o2.hexagramName+' exp='+NAME_CHECK[bb]);
  }
  console.log('卦名抽检 '+nmOk+'/'+Object.keys(NAME_CHECK).length, nmFail.slice(0,4));
  console.log(JSON.stringify(stat));
  console.log('fails('+fails.length+')', fails.slice(0,12));
})();
