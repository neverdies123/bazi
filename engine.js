/* engine.js — 排盘引擎（浏览器/Node 通用，无依赖，需先加载 lunar.js）
 * 与 Python 版 bazi_engine.py 保持同一口径：
 * 立春换年 / 十二节换月 / 00:00 换日 / 时干按当日日干五鼠遁 / 真太阳时默认开
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./lunar.js"));
  else root.BaziEngine = factory(root);
})(typeof self !== "undefined" ? self : this, function (L) {

  const GAN = "甲乙丙丁戊己庚辛壬癸";
  const ZHI = "子丑寅卯辰巳午未申酉戌亥";
  const GAN_WX = { 甲:"木",乙:"木",丙:"火",丁:"火",戊:"土",己:"土",庚:"金",辛:"金",壬:"水",癸:"水" };
  const ZHI_WX = { 子:"水",丑:"土",寅:"木",卯:"木",辰:"土",巳:"火",午:"火",未:"土",申:"金",酉:"金",戌:"土",亥:"水" };
  const YY = {}; GAN.split("").forEach((g,i)=> YY[g] = i % 2 === 0 ? "阳" : "阴");
  const CANG = {
    子:["癸"],丑:["己","癸","辛"],寅:["甲","丙","戊"],卯:["乙"],辰:["戊","乙","癸"],
    巳:["丙","戊","庚"],午:["丁","己"],未:["己","丁","乙"],申:["庚","壬","戊"],
    酉:["辛"],戌:["戊","辛","丁"],亥:["壬","甲"]
  };
  const SHENG = { 木:"火",火:"土",土:"金",金:"水",水:"木" };
  const KE    = { 木:"土",火:"金",土:"水",金:"木",水:"火" };
  const CHONG = [["子","午"],["丑","未"],["寅","申"],["卯","酉"],["辰","戌"],["巳","亥"]];
  const HE6   = [["子","丑"],["寅","亥"],["卯","戌"],["辰","酉"],["巳","申"],["午","未"]];
  const XING  = { 子:["卯"],卯:["子"],寅:["巳","申"],巳:["寅","申"],申:["寅","巳"],
                  丑:["戌","未"],戌:["丑","未"],未:["丑","戌"],辰:["辰"],午:["午"],酉:["酉"],亥:["亥"] };
  const GROUP = { 比肩:"比劫",劫财:"比劫",食神:"食伤",伤官:"食伤",偏财:"财星",正财:"财星",
                  七杀:"官杀",正官:"官杀",偏印:"印星",正印:"印星" };
  const CITIES = {
    北京:[116.41,39.90],上海:[121.47,31.23],广州:[113.26,23.13],深圳:[114.06,22.54],
    杭州:[120.15,30.28],南京:[118.80,32.06],成都:[104.07,30.57],重庆:[106.55,29.56],
    武汉:[114.31,30.59],西安:[108.95,34.26],天津:[117.19,39.12],苏州:[120.59,31.30],
    长沙:[112.94,28.23],郑州:[113.63,34.75],青岛:[120.38,36.07],沈阳:[123.43,41.80],
    哈尔滨:[126.53,45.80],昆明:[102.71,25.04],福州:[119.30,26.08],厦门:[118.09,24.48],
    合肥:[117.28,31.86],济南:[117.00,36.65],石家庄:[114.51,38.04],太原:[112.55,37.87],
    南昌:[115.89,28.68],贵阳:[106.63,26.65],南宁:[108.37,22.82],兰州:[103.82,36.06],
    乌鲁木齐:[87.62,43.83],拉萨:[91.11,29.65],宁波:[121.55,29.87],温州:[120.70,28.00],
    无锡:[120.31,31.49],佛山:[113.12,23.02],东莞:[113.75,23.02],泉州:[118.68,24.87],
    台北:[121.52,25.03],香港:[114.17,22.32],澳门:[113.55,22.20],新加坡:[103.85,1.35],
    吉隆坡:[101.69,3.14],东京:[139.69,35.69],首尔:[126.98,37.57]
  };
  const DST = [[1986,5,4,9,14],[1987,4,12,9,13],[1988,4,10,9,11],
               [1989,4,16,9,17],[1990,4,15,9,16],[1991,4,14,9,15]];

  function shishen(dg, og) {
    const dw = GAN_WX[dg], ow = GAN_WX[og];
    const same = YY[dg] === YY[og];
    if (dw === ow) return same ? "比肩" : "劫财";
    if (SHENG[dw] === ow) return same ? "食神" : "伤官";
    if (KE[dw] === ow) return same ? "偏财" : "正财";
    if (KE[ow] === dw) return same ? "七杀" : "正官";
    return same ? "偏印" : "正印";
  }

  function inDst(y,m,d) {
    for (const [yy,sm,sd,em,ed] of DST) {
      if (y !== yy) continue;
      const s = sm*100+sd, e = em*100+ed, c = m*100+d;
      if (c >= s && c < e) return true;
    }
    return false;
  }

  function eot(y,m,d) {
    const start = new Date(Date.UTC(y,0,1));
    const n = Math.floor((Date.UTC(y,m-1,d) - start) / 86400000) + 1;
    const b = 2 * Math.PI * (n - 81) / 364;
    return 9.87*Math.sin(2*b) - 7.53*Math.cos(b) - 1.5*Math.sin(b);
  }

  function resolveLocation(city, manualLon) {
    if (manualLon !== null && manualLon !== undefined && manualLon !== "" && !isNaN(manualLon)) {
      return { lon: Number(manualLon), src: "手动经度" };
    }
    const name = (city || "").trim();
    if (CITIES[name]) return { lon: CITIES[name][0], src: "内置城市表" };
    for (const k in CITIES) if (name && (name.includes(k) || k.includes(name))) return { lon: CITIES[k][0], src: "内置城市表·" + k };
    return { lon: 120, src: "未匹配，按东经120°" };
  }

  function compute(opt) {
    const { name="访客", gender="女", y, m, d, hh, mm, city="", lon=null, solarTime=true } = opt;
    const loc = resolveLocation(city, lon);
    let corr = 0;
    if (solarTime) corr = (loc.lon - 120) * 4 + eot(y, m, d);
    const dstMin = inDst(y, m, d) ? -60 : 0;

    const base = new Date(y, m - 1, d, hh, mm, 0);
    const real = new Date(base.getTime() + (corr + dstMin) * 60000);

    const Solar = L.Solar;
    const solar = Solar.fromYmdHms(real.getFullYear(), real.getMonth() + 1, real.getDate(),
                                   real.getHours(), real.getMinutes(), 0);
    const ec = solar.getLunar().getEightChar();
    ec.setSect(2);

    const yp = ec.getYear(), mp = ec.getMonth(), dp = ec.getDay();
    const zi = Math.floor((real.getHours() + 1) / 2) % 12;
    const timeZhi = ZHI[zi];
    const dayGan = dp[0];
    const timeGan = GAN[((GAN.indexOf(dayGan) % 5) * 2 + zi) % 10];
    const tp = timeGan + timeZhi;

    const pillars = [yp, mp, dp, tp];
    const gans = pillars.map(p => p[0]);
    const zhis = pillars.map(p => p[1]);
    const cang = zhis.map(z => CANG[z]);
    const ssGan = gans.map((g, i) => i === 2 ? "日主" : shishen(dayGan, g));
    const ssZhi = cang.map(cs => cs.map(c => shishen(dayGan, c)));

    const wx = { 木:0,火:0,土:0,金:0,水:0 };
    gans.forEach(g => { wx[GAN_WX[g]] += 1; });
    const wts = [1.0, 0.5, 0.3];
    zhis.forEach((z, i) => {
      const mul = i === 1 ? 1.5 : 1.0;
      cang[i].forEach((c, j) => { wx[GAN_WX[c]] += wts[Math.min(j,2)] * mul; });
    });
    const round2 = o => Object.fromEntries(Object.entries(o).map(([k,v]) => [k, Math.round(v*100)/100]));

    const dw = GAN_WX[dayGan];
    const shengMe = Object.keys(SHENG).find(k => SHENG[k] === dw);
    const help = wx[dw] + wx[shengMe];
    const drain = Object.keys(wx).filter(k => k !== dw && k !== shengMe).reduce((a,k) => a + wx[k], 0);
    const ratio = help + drain ? help / (help + drain) : 0.5;
    const strength = ratio >= 0.62 ? "旺" : ratio >= 0.53 ? "偏旺" : ratio >= 0.47 ? "中和" : ratio >= 0.38 ? "偏弱" : "弱";
    const roots = zhis.filter(z => [dw, shengMe].includes(ZHI_WX[z]));

    const rel = [];
    const POS = ["年","月","日","时"];
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
      const za = zhis[a], zb = zhis[b];
      if (CHONG.some(([x,yy]) => (x===za&&yy===zb)||(x===zb&&yy===za))) rel.push({type:"冲",a:za,b:zb,a_pos:POS[a],b_pos:POS[b]});
      if (HE6.some(([x,yy]) => (x===za&&yy===zb)||(x===zb&&yy===za))) rel.push({type:"合",a:za,b:zb,a_pos:POS[a],b_pos:POS[b]});
      if ((XING[za]||[]).includes(zb) || (XING[zb]||[]).includes(za)) rel.push({type:"刑",a:za,b:zb,a_pos:POS[a],b_pos:POS[b]});
    }

    const cnt = { 比劫:0,食伤:0,财星:0,官杀:0,印星:0 };
    const god = { 比肩:0,劫财:0,食神:0,伤官:0,偏财:0,正财:0,七杀:0,正官:0,偏印:0,正印:0 };
    gans.forEach((g, i) => { if (i === 2) return; cnt[GROUP[ssGan[i]]] += 1; god[ssGan[i]] += 1; });
    zhis.forEach((z, i) => {
      const mul = i === 1 ? 1.5 : 1.0;
      cang[i].forEach((c, j) => {
        const s = ssZhi[i][j], w = wts[Math.min(j,2)] * mul;
        cnt[GROUP[s]] += w; god[s] += w;
      });
    });

    const yun = ec.getYun(gender === "男" ? 1 : 0);
    const dayun = yun.getDaYun().map(dy => ({
      ganzhi: dy.getGanZhi() || "（起运前）",
      start_year: dy.getStartYear(), end_year: dy.getEndYear(),
      start_age: dy.getStartAge(), end_age: dy.getEndAge()
    }));

    const nowY = new Date().getFullYear();
    const liunian = [];
    for (let yr = nowY - 8; yr <= nowY + 3; yr++) {
      const lg = L.Solar.fromYmdHms(yr, 6, 1, 12, 0, 0).getLunar().getYearInGanZhiExact();
      liunian.push({ year: yr, ganzhi: lg, age: yr - y, passed: yr <= nowY });
    }

    return {
      name, gender, birth: `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")} ${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`,
      corrected: real, correction_min: Math.round(corr*10)/10,
      city, longitude: loc.lon, geo_source: loc.src,
      pillars, day_gan: dayGan, day_zhi: dp[1], month_zhi: zhis[1], year_zhi: zhis[0], time_zhi: zhis[3],
      cang, shishen_gan: ssGan, shishen_zhi: ssZhi,
      element_score: round2(wx),
      strength, strength_detail: { day_element: dw, help: Math.round(help*100)/100, drain: Math.round(drain*100)/100,
        ratio: Math.round(ratio*1000)/1000, de_ling: [dw, shengMe].includes(ZHI_WX[zhis[1]]), roots },
      relations: rel,
      shishen_count: round2(cnt), shishen_god: round2(god),
      dayun, liunian,
      qiyun: { y: yun.getStartYear(), m: yun.getStartMonth(), d: yun.getStartDay(), forward: yun.isForward() }
    };
  }

  // ---------- 格局 ----------
  const GEJU = {
    正官格:"月令是正官，主轴是「位置」——会不自觉地在意自己站得正不正、别人怎么看。",
    七杀格:"月令是七杀，主轴是「压力」——很早就习惯了在有人盯着、有 deadline 的状态下活着。",
    正财格:"月令是正财，主轴是「实在」——要看得见摸得着的东西，虚的承诺打动不了。",
    偏财格:"月令是偏财，主轴是「机会」——对流动的资源和人情世故天生敏感。",
    食神格:"月令是食神，主轴是「输出」——需要有东西从手里长出来，不然会闷。",
    伤官格:"月令是伤官，主轴是「突破」——天生对「规定好的」东西过敏。",
    正印格:"月令是正印，主轴是「被托住」——靠学习和被照顾活下来，也容易停在准备阶段。",
    偏印格:"月令是偏印，主轴是「独处」——想得比一般人多一层，也更容易一个人待着。",
    建禄格:"月令是比肩，主轴是「自立」——这一生基本靠自己，靠山不多，但也因此很结实。"
  };
  function geju(c) {
    const ben = CANG[c.month_zhi][0];
    const g = shishen(c.day_gan, ben);
    const base = (g === "比肩" || g === "劫财") ? "建禄格" : g + "格";
    return { base, god: g, note: GEJU[base] || "", basis: `月支${c.month_zhi}，本气${ben}，对日主${c.day_gan}为${g}` };
  }

  const DY = {
    正官:"责任与位置", 七杀:"压力与突破", 正印:"靠山与学习", 偏印:"独处与专业",
    正财:"稳定与积累", 偏财:"机会与流动", 食神:"输出与享受", 伤官:"表达与不服",
    比肩:"自立与同辈", 劫财:"争夺与消耗"
  };
  function dayunThemes(c, limit = 4) {
    const now = new Date().getFullYear();
    const arr = [];
    c.dayun.forEach(d => {
      if (d.ganzhi === "（起运前）" || !d.start_year) return;
      const g = d.ganzhi[0];
      arr.push({ ...d, god: shishen(c.day_gan, g), theme: DY[shishen(c.day_gan, g)] || "",
                 current: d.start_year <= now && now <= (d.end_year || 9999) });
    });
    const i = Math.max(0, arr.findIndex(x => x.current));
    return arr.slice(i, i + limit);
  }

  // ---------- 给模型的事实清单 ----------
  function facts(c) {
    const d = c.strength_detail, g = geju(c), dys = dayunThemes(c);
    const now = new Date();
    const L1 = [];
    L1.push(`今天：${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日`);
    L1.push(`称呼：${c.name}　性别：${c.gender}　年龄：${now.getFullYear() - Number(c.birth.slice(0,4))}`);
    L1.push(`四柱：${c.pillars.join(" ")}`);
    L1.push("逐柱：" + c.pillars.map((p,i) =>
      `${["年","月","日","时"][i]}柱${p}（藏 ${c.cang[i].join("、")}；干${c.shishen_gan[i]}，支藏${c.shishen_zhi[i].join("/")}）`).join("　"));
    L1.push(`日主：${c.day_gan}（${d.day_element}），生于 ${c.month_zhi} 月，判为「身${c.strength}」`);
    L1.push(`旺衰依据：帮身 ${d.help} ／ 耗身 ${d.drain} ／ 比值 ${d.ratio}；得令 ${d.de_ling ? "是" : "否"}；地支有根：${d.roots.join("、") || "无根"}`);
    L1.push("五行：" + Object.entries(c.element_score).map(([k,v]) => k+v).join("　"));
    L1.push("十神：" + Object.entries(c.shishen_count).map(([k,v]) => k+v).join("　"));
    L1.push("十神明细：" + Object.entries(c.shishen_god).filter(([,v]) => v > 0).map(([k,v]) => k+v).join("　"));
    L1.push("刑冲合害：" + (c.relations.map(x => x.a_pos+x.a+x.type+x.b_pos+x.b).join("；") || "无"));
    L1.push(`格局：${g.base}（${g.basis}）`);
    if (dys.length) L1.push("大运：" + dys.map(x => `${x.start_year}–${x.end_year} ${x.ganzhi}运[${x.god}]${x.current ? "←当前" : ""}`).join("；"));
    const ln = c.liunian.filter(x => x.year >= now.getFullYear() - 1).slice(0, 6);
    if (ln.length) L1.push("流年：" + ln.map(x => `${x.year}${x.ganzhi}${x.passed ? "(已过)" : "(未来)"}`).join("；"));
    return L1.join("\n");
  }

  return { compute, geju, dayunThemes, facts, CITIES, shishen, GAN, ZHI, GAN_WX };
});
