const { ipcRenderer } = require('electron');
const {
  HERO_CALIBRATED_FULL_INDEX,
  HERO_BASELINE_DPM_JO,
  BP_EFF_TO_INDEX_DIVISOR,
  STANDARD_ACTION_DELAY_MS,
  MAX_CONTINUOUS_STD_ACTIONS_6M,
  PASSIVE_PROC_SKILL_KEYWORDS,
  KEYDOWN_SKILL_KEYWORDS,
  calcMapleReducedCooldown,
  HEXA_FRAGMENT_TABLE,
  MASTER_JOB_LIST,
  DEFAULT_JOB_UTILITY_DB
} = require('./job_utility_db.js');

const JOB_NAME_ALIASES = {
  '캐논마스터': ['캐논마스터', '캐논슈터'],
  '캐논슈터': ['캐논슈터', '캐논마스터'],
  '듀얼블레이더': ['듀얼블레이더', '듀얼블레이드'],
  '듀얼블레이드': ['듀얼블레이드', '듀얼블레이더']
};

function formatKoreanNumber(num) {
  if (!num || isNaN(num) || Number(num) <= 0) return '-';
  try {
    const n = BigInt(Math.floor(Number(num)));
    if (n === 0n) return '0';
    const units = ['', '만', '억', '조', '경'];
    let res = [], temp = n, idx = 0;
    while (temp > 0n && idx < units.length) {
      const part = temp % 10000n;
      if (part > 0n) res.unshift(`${part.toString()}${units[idx]}`);
      temp /= 10000n;
      idx++;
    }
    return res.join(' ');
  } catch { return String(num); }
}

class MapleSimulatorWindow {
  constructor() {
    this.STORAGE_KEY_CUSTOM_UTIL = 'MAPLE_SIM_CUSTOM_UTIL_DB_V3';
    this.localDbData = null;
    this.utilityDb = {};
    this.isAlwaysOnTop = false;

    this.cacheDom();
    this.loadUtilityDb();
    this.bindEvents();
    this.reloadFromMainDb();
  }

  cacheDom() {
    this.snapStateBtn = document.getElementById('snapStateBtn');
    this.alwaysOnTopBtn = document.getElementById('alwaysOnTopBtn');
    this.minWinBtn = document.getElementById('minWinBtn');
    this.closeWinBtn = document.getElementById('closeWinBtn');

    this.tabSimResult = document.getElementById('tabSimResult');
    this.tabUtilEdit = document.getElementById('tabUtilEdit');
    this.simResultView = document.getElementById('simResultView');
    this.utilEditView = document.getElementById('utilEditView');

    this.simCpManInput = document.getElementById('simCpManInput');
    this.simCpKoreanText = document.getElementById('simCpKoreanText');
    this.simFragInput = document.getElementById('simFragInput');
    this.simBossHpJoInput = document.getElementById('simBossHpJoInput');

    this.simCoolHatSelect = document.getElementById('simCoolHatSelect');
    this.simCdrWeightMode = document.getElementById('simCdrWeightMode');

    this.simRoleFilter = document.getElementById('simRoleFilter');
    this.simIframeFilter = document.getElementById('simIframeFilter');
    this.simSortSelect = document.getElementById('simSortSelect');

    this.chkFilterProc660 = document.getElementById('chkFilterProc660');
    this.chkBase660Burst = document.getElementById('chkBase660Burst');

    this.simCardsContainer = document.getElementById('simCardsContainer');
    this.utilEditListContainer = document.getElementById('utilEditListContainer');
    this.resetUtilDbBtn = document.getElementById('resetUtilDbBtn');
    this.simCountStatus = document.getElementById('simCountStatus');
  }

  loadUtilityDb() {
    this.utilityDb = JSON.parse(JSON.stringify(DEFAULT_JOB_UTILITY_DB));
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY_CUSTOM_UTIL);
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.keys(parsed).forEach(j => {
          if (this.utilityDb[j]) {
            this.utilityDb[j] = { ...this.utilityDb[j], ...parsed[j] };
          }
        });
      }
    } catch (e) {}
  }

  saveUtilityDb() {
    try {
      localStorage.setItem(this.STORAGE_KEY_CUSTOM_UTIL, JSON.stringify(this.utilityDb));
    } catch (e) {}
  }

  async reloadFromMainDb() {
    try {
      const res = await ipcRenderer.invoke('load-local-db');
      if (res && res.success && res.data) {
        this.localDbData = res.data;
      }
    } catch (e) {}
    this.renderSimulationCards();
    this.renderUtilityEditor();
  }

  getActiveSeasonRecords() {
    if (!this.localDbData) return [];
    const seasons = this.localDbData.seasons || {};
    const curKey = this.localDbData.currentSeasonKey || Object.keys(seasons)[0];
    if (seasons[curKey] && Array.isArray(seasons[curKey].records)) {
      return seasons[curKey].records;
    }
    if (Array.isArray(this.localDbData.records)) {
      return this.localDbData.records;
    }
    return [];
  }

  isSameJob(jobA, jobB) {
    if (!jobA || !jobB) return false;
    if (jobA === jobB) return true;
    const aliases = JOB_NAME_ALIASES[jobA] || [jobA];
    return aliases.includes(jobB);
  }

  getInterpolatedHexaRate(jobName, fragCount) {
    const tiers = HEXA_FRAGMENT_TABLE[jobName] || HEXA_FRAGMENT_TABLE['히어로'];
    const [t2k, t5k, t10k, t20k, t40k] = tiers;
    const slopeEarly = (t5k[0] - t2k[0]) / Math.max(1, (t5k[1] - t2k[1]));
    const rateAtZero = Math.max(52, Number((t2k[0] - slopeEarly * t2k[1]).toFixed(2)));

    const points = [
      { frag: 0, rate: rateAtZero },
      { frag: t2k[1], rate: t2k[0] },
      { frag: t5k[1], rate: t5k[0] },
      { frag: t10k[1], rate: t10k[0] },
      { frag: t20k[1], rate: t20k[0] },
      { frag: t40k[1], rate: t40k[0] },
      { frag: 44000, rate: 100.0 }
    ];

    const q = Math.max(0, Number(fragCount) || 0);
    if (q <= 0) return rateAtZero;
    if (q >= 44000) return 100.0;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i], p2 = points[i + 1];
      if (q >= p1.frag && q <= p2.frag) {
        const ratio = (q - p1.frag) / Math.max(1, (p2.frag - p1.frag));
        return Number((p1.rate + ratio * (p2.rate - p1.rate)).toFixed(2));
      }
    }
    return t40k[0];
  }

  analyzeRecordActions660(rec) {
    const skills = rec?.skills || [];
    const timelines = rec?.timeline || [];
    if (skills.length === 0) return null;

    const timelineCountMap = new Map();
    timelines.forEach(t => {
      if (t && t.skill_name) {
        timelineCountMap.set(t.skill_name, (timelineCountMap.get(t.skill_name) || 0) + 1);
      }
    });

    const nonTimelineSkills = skills
      .filter(s => !timelineCountMap.has(s.name) && (Number(s.useCount) || 0) > 30)
      .sort((a, b) => (Number(b.rate) || 0) - (Number(a.rate) || 0));

    const primaryMainSkillName = nonTimelineSkills.length > 0 ? nonTimelineSkills[0].name : null;

    let effectiveActions = 0;
    let passiveProcCasts = 0;
    let rawTotalCasts = 0;

    skills.forEach(sk => {
      const name = sk.name || '';
      const rawUse = Number(sk.useCount) || 0;
      const rate = Number(sk.rate) || 0;
      const tlUse = timelineCountMap.get(name) || 0;
      rawTotalCasts += rawUse;

      const isKnownProc = PASSIVE_PROC_SKILL_KEYWORDS.some(kw => name.includes(kw));
      const isKnownKeydown = KEYDOWN_SKILL_KEYWORDS.some(kw => name.includes(kw));

      if (isKnownProc) {
        passiveProcCasts += rawUse;
      } else if (isKnownKeydown || (tlUse > 0 && rawUse > tlUse * 8)) {
        const normHoldActions = Math.max(tlUse, Math.round((rawUse * 132) / STANDARD_ACTION_DELAY_MS));
        effectiveActions += Math.min(MAX_CONTINUOUS_STD_ACTIONS_6M, normHoldActions);
        passiveProcCasts += Math.max(0, rawUse - normHoldActions);
      } else if (name === primaryMainSkillName) {
        const mainAct = Math.min(MAX_CONTINUOUS_STD_ACTIONS_6M, rawUse);
        effectiveActions += mainAct;
        passiveProcCasts += Math.max(0, rawUse - mainAct);
      } else if (tlUse > 0) {
        effectiveActions += tlUse;
        passiveProcCasts += Math.max(0, rawUse - tlUse);
      } else {
        if (rawUse > 250 && rate < 12) {
          passiveProcCasts += rawUse;
        } else {
          const capped = Math.min(180, rawUse);
          effectiveActions += capped;
          passiveProcCasts += Math.max(0, rawUse - capped);
        }
      }
    });

    return {
      effectiveActions: Math.round(effectiveActions),
      passiveProcCasts: Math.round(passiveProcCasts),
      rawTotalCasts: Math.round(rawTotalCasts)
    };
  }

  calcRecordBurstShare660(rec, apply660BaselineSubtraction = true) {
    const skills = rec?.skills || [];
    const timelines = rec?.timeline || [];
    if (skills.length === 0) return null;

    const windows = [
      { startMs: 0, endMs: 30000 },
      { startMs: 120000, endMs: 150000 },
      { startMs: 240000, endMs: 270000 }
    ];

    const count30 = new Map();
    const count90 = new Map();
    timelines.forEach(t => {
      if (!t || !t.skill_name) return;
      const ms = Number(t.elapse_time) || 0;
      const inBurst = windows.some(w => ms >= w.startMs && ms <= w.endMs);
      if (inBurst) count30.set(t.skill_name, (count30.get(t.skill_name) || 0) + 1);
      else count90.set(t.skill_name, (count90.get(t.skill_name) || 0) + 1);
    });

    let totalBurst = 0;
    const omega = 1.75;

    skills.forEach(s => {
      const d = Number(s.rate) || 0;
      const n30 = count30.get(s.name) || 0;
      const n90 = count90.get(s.name) || 0;
      const isKeydown = KEYDOWN_SKILL_KEYWORDS.some(kw => (s.name || '').includes(kw));

      if (n30 + n90 === 0) {
        if (apply660BaselineSubtraction) {
          const totalWeighted = 30 * omega + 90 * 1.0;
          const burstExcessShare = (30 * (omega - 1.0)) / totalWeighted;
          totalBurst += d * burstExcessShare;
        } else {
          totalBurst += d * ((30 * omega) / (30 * omega + 90));
        }
      } else if (isKeydown && n90 === 0 && n30 > 0) {
        totalBurst += d * 1.0;
      } else {
        if (apply660BaselineSubtraction && n90 > 0) {
          const expectedBaseIn30 = n90 * (30 / 90);
          const pureBurstHits = Math.max(0, n30 * omega - expectedBaseIn30);
          totalBurst += d * (pureBurstHits / (n30 * omega + n90));
        } else {
          totalBurst += d * ((n30 * omega) / (n30 * omega + n90));
        }
      }
    });

    return Math.min(100, Math.max(10, Number(totalBurst.toFixed(1))));
  }

  calcJobCdrHatMultiplier(baseMeta, targetHatSec, weightMode = 'PURE_GAIN') {
    const recHatSec = Number(baseMeta.recHatSec) || 0;
    const activeHatSec = targetHatSec === 'REC' ? recHatSec : (Number(targetHatSec) || 0);

    const cdrSharePct = Number(baseMeta.cdrShare) || 20;
    const baseCoolSec = Number(baseMeta.cdrBaseCool) || 16;
    const effFactor = Number(baseMeta.cdrEfficiencyFactor) || 0.75;

    const calcGrossGainPctAt = (hatSec) => {
      if (hatSec <= 0) return 0;
      const coolAtZero = calcMapleReducedCooldown(baseCoolSec, 0);
      const coolAtHat = calcMapleReducedCooldown(baseCoolSec, hatSec);
      if (coolAtHat >= coolAtZero) return 0;

      const castFreqGain = (coolAtZero / coolAtHat) - 1;
      const grossDpsGainPct = cdrSharePct * castFreqGain * effFactor;
      return Number(grossDpsGainPct.toFixed(2));
    };

    const calcStatCostPctAt = (hatSec) => {
      if (hatSec <= 0) return 0;
      const statLossTable = { 1: 0.85, 2: 1.70, 3: 2.55, 4: 3.45, 5: 4.40, 6: 5.40 };
      return statLossTable[hatSec] || (hatSec * 0.88);
    };

    const gainAtActive = calcGrossGainPctAt(activeHatSec);
    const gainAt4Sec = calcGrossGainPctAt(4);
    const costAtActive = weightMode === 'NET_STAT_COST' ? calcStatCostPctAt(activeHatSec) : 0;

    const netAtActive = gainAtActive - costAtActive;
    const netAtRec = calcGrossGainPctAt(recHatSec) - (weightMode === 'NET_STAT_COST' ? calcStatCostPctAt(recHatSec) : 0);

    const relativeMultiplier = (1 + netAtActive / 100) / (1 + netAtRec / 100);
    const absoluteMultiplierFromZero = 1 + netAtActive / 100;

    return {
      activeHatSec,
      recHatSec,
      gainAtActive: Number((gainAtActive - costAtActive).toFixed(2)),
      grossGainAt4Sec: gainAt4Sec,
      relativeMultiplier,
      absoluteMultiplierFromZero
    };
  }

  updateSortSelectColor() {
    if (!this.simSortSelect) return;
    const val = this.simSortSelect.value;
    if (val === 'DPS_STD_DESC') {
      this.simSortSelect.style.color = '#4ade80';
      this.simSortSelect.style.borderColor = '#4ade80';
    } else if (val === 'DPS_EFF_DESC') {
      this.simSortSelect.style.color = '#60a5fa';
      this.simSortSelect.style.borderColor = '#60a5fa';
    } else if (val === 'FORMULA_DIFF_DESC') {
      this.simSortSelect.style.color = '#c084fc';
      this.simSortSelect.style.borderColor = '#c084fc';
    } else {
      this.simSortSelect.style.color = '#ffffff';
      this.simSortSelect.style.borderColor = '#4a5568';
    }
  }

  renderSimulationCards() {
    this.updateSortSelectColor();

    const allRecs = this.getActiveSeasonRecords();
    const savedBurstProfiles = this.localDbData?.savedJobBurstProfiles || {};

    const cpMan = Number(this.simCpManInput?.value) || 10650;
    const combatPower = cpMan * 10000;
    if (this.simCpKoreanText) {
      this.simCpKoreanText.textContent = formatKoreanNumber(combatPower);
    }

    const fragCount = Number(this.simFragInput?.value) || 5656;
    const bossHpJo = Number(this.simBossHpJoInput?.value) || 779;
    const forceMult = 1.32;
    const realFactorK = 0.70;

    const hatSelectVal = this.simCoolHatSelect?.value || 'REC';
    const cdrWeightMode = this.simCdrWeightMode?.value || 'PURE_GAIN';
    const filterProc660 = this.chkFilterProc660 ? this.chkFilterProc660.checked : true;
    const base660Burst = this.chkBase660Burst ? this.chkBase660Burst.checked : true;
    const sortMode = this.simSortSelect?.value || 'DPS_STD_DESC';

    const heroRecs = allRecs.filter(r => this.isSameJob(r?.job, '히어로') && r.efficiency > 0);
    const heroAvgEff = heroRecs.length > 0
      ? heroRecs.reduce((a, b) => a + b.efficiency, 0) / heroRecs.length
      : 7138;

    const jobResults = MASTER_JOB_LIST.map(jobName => {
      const baseMeta = this.utilityDb[jobName] || DEFAULT_JOB_UTILITY_DB[jobName] || {};
      const matchedRecs = allRecs.filter(r => this.isSameJob(r?.job, jobName) && r.efficiency > 0);
      const cnt = matchedRecs.length;

      let avgEff = baseMeta.bpEff || 7138;
      let normActions = baseMeta.normActions6m || 620;
      let procCasts = baseMeta.procCasts6m || 850;
      let rawTotalCasts = normActions + procCasts;

      let burstRate = baseMeta.burstRate ?? 55.0;
      if (base660Burst && baseMeta.attackStyle === 'HOLD_660') {
        burstRate = Number(Math.max(18, burstRate - 6.5).toFixed(1));
      } else if (base660Burst && baseMeta.attackStyle === 'KEYDOWN_BURST') {
        burstRate = Number(Math.min(78, burstRate + 2.5).toFixed(1));
      }

      if (cnt > 0) {
        const sumDps = matchedRecs.reduce((a, c) => a + (c.dps || 0), 0);
        const sumCp = matchedRecs.reduce((a, c) => a + (c.combatPower || 0), 0);
        avgEff = sumCp > 0 ? Math.round(sumDps / sumCp) : Math.round(matchedRecs.reduce((a, c) => a + c.efficiency, 0) / cnt);

        const actionStats = matchedRecs.map(r => this.analyzeRecordActions660(r)).filter(Boolean);
        if (actionStats.length > 0) {
          normActions = Math.round(actionStats.reduce((a, b) => a + b.effectiveActions, 0) / actionStats.length);
          procCasts = Math.round(actionStats.reduce((a, b) => a + b.passiveProcCasts, 0) / actionStats.length);
          rawTotalCasts = Math.round(actionStats.reduce((a, b) => a + b.rawTotalCasts, 0) / actionStats.length);
        }

        const bRates = matchedRecs.map(r => this.calcRecordBurstShare660(r, base660Burst)).filter(v => v !== null);
        if (bRates.length > 0) {
          burstRate = Number((bRates.reduce((a, b) => a + b, 0) / bRates.length).toFixed(1));
        }
      }

      if (savedBurstProfiles[jobName] && typeof savedBurstProfiles[jobName].burstRate === 'number') {
        burstRate = savedBurstProfiles[jobName].burstRate;
      }

      const cdrInfo = this.calcJobCdrHatMultiplier(baseMeta, hatSelectVal, cdrWeightMode);
      const hexaRate = this.getInterpolatedHexaRate(jobName, fragCount);
      const bossHpTotal = bossHpJo * 1e12;

      // 🟢 [공식 1: 초록색] 환산 주스탯 자료(헥환 11만 Q3 체급, 카데나 1위) 기준 계산
      const stdDpmRatio = (baseMeta.stdDpmJo || HERO_BASELINE_DPM_JO) / HERO_BASELINE_DPM_JO;
      const rateAt40k = this.getInterpolatedHexaRate(jobName, 40000);
      const heroRateAt40k = this.getInterpolatedHexaRate('히어로', 40000);
      const stdFullIndexP = HERO_CALIBRATED_FULL_INDEX * stdDpmRatio * (heroRateAt40k / rateAt40k) * cdrInfo.relativeMultiplier;
      const stdFullEff = stdFullIndexP * BP_EFF_TO_INDEX_DIVISOR;
      const stdExpectedDps = Math.round(combatPower * stdFullEff * (hexaRate / 100) * realFactorK * forceMult);
      const stdClearSec = stdExpectedDps > 0 ? (bossHpTotal / stdExpectedDps) : 9999;

      // 🔵 [공식 2: 파란색] 내 역산 데미지 공식(히어로 819.5 & 인게임 전투력 효율 역산) 기준 계산
      const myEffFullIndexP = HERO_CALIBRATED_FULL_INDEX * (avgEff / heroAvgEff) * cdrInfo.relativeMultiplier;
      const myEffFullEff = myEffFullIndexP * BP_EFF_TO_INDEX_DIVISOR;
      const myExpectedDps = Math.round(combatPower * myEffFullEff * (hexaRate / 100) * realFactorK * forceMult);
      const myClearSec = myExpectedDps > 0 ? (bossHpTotal / myExpectedDps) : 9999;

      // 두 공식 간 편차(%) : (내 역산 공식 DPS - 환산 주스탯 기준 DPS) / 환산 주스탯 기준 DPS
      const formulaGapPct = stdExpectedDps > 0
        ? Number((((myExpectedDps - stdExpectedDps) / stdExpectedDps) * 100).toFixed(2))
        : 0;

      const cdrActionBoost = Math.round(normActions * ((cdrInfo.absoluteMultiplierFromZero - 1) * 0.65));
      const finalNormActions = normActions + cdrActionBoost;
      const displayActions = filterProc660 ? finalNormActions : (rawTotalCasts + cdrActionBoost);

      return {
        job: jobName,
        rank11: baseMeta.rank11 || 99,
        stdDpmJo: baseMeta.stdDpmJo || 4.5,
        bpEff: avgEff,
        stdFullIndexP: Number(stdFullIndexP.toFixed(1)),
        myEffFullIndexP: Number(myEffFullIndexP.toFixed(1)),
        stdExpectedDps,
        stdClearSec,
        myExpectedDps,
        myClearSec,
        formulaGapPct,
        hexaRate,
        burstRate,
        displayActions,
        finalNormActions,
        procCasts,
        cdrShare: baseMeta.cdrShare || 20,
        cdrInfo,
        attackStyle: baseMeta.attackStyle || 'HOLD_660',
        hasIframe: Boolean(baseMeta.hasIframe),
        iframeCoolSec: Number(baseMeta.iframeCoolSec) || 0,
        iframeName: baseMeta.iframeName || '정보 없음',
        hasBind: Boolean(baseMeta.hasBind)
      };
    });

    // 전체 48개 직업 내에서의 🟢표준체급(Q3) 순위 vs 🔵내 역산공식 순위 각각 산정
    const sortedByStd = [...jobResults].sort((a, b) => b.stdExpectedDps - a.stdExpectedDps);
    sortedByStd.forEach((it, idx) => { it.stdRank = idx + 1; });

    const sortedByMy = [...jobResults].sort((a, b) => b.myExpectedDps - a.myExpectedDps);
    sortedByMy.forEach((it, idx) => { it.myRank = idx + 1; });

    const roleFilter = this.simRoleFilter?.value || 'ALL';
    const iframeFilter = this.simIframeFilter?.value || 'ALL';

    const filtered = jobResults.filter(item => {
      if (roleFilter === 'BURST' && item.burstRate < 50) return false;
      if (roleFilter === 'SUSTAINED' && item.burstRate >= 50) return false;

      if (iframeFilter === 'HAS_IFRAME' && !item.hasIframe) return false;
      if (!isNaN(Number(iframeFilter)) && Number(iframeFilter) > 0) {
        const maxCool = Number(iframeFilter);
        if (!item.hasIframe || item.iframeCoolSec <= 0 || item.iframeCoolSec > maxCool) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (sortMode === 'DPS_EFF_DESC') return b.myExpectedDps - a.myExpectedDps;
      if (sortMode === 'FORMULA_DIFF_DESC') return Math.abs(b.formulaGapPct) - Math.abs(a.formulaGapPct);
      if (sortMode === 'CDR_EFF_DESC') return b.cdrInfo.grossGainAt4Sec - a.cdrInfo.grossGainAt4Sec;
      if (sortMode === 'BURST_DESC') return b.burstRate - a.burstRate;
      if (sortMode === 'ACT_ASC') return a.displayActions - b.displayActions;
      if (sortMode === 'ACT_DESC') return b.displayActions - a.displayActions;
      if (sortMode === 'IFRAME_ASC') {
        const coolA = a.hasIframe && a.iframeCoolSec > 0 ? a.iframeCoolSec : 999;
        const coolB = b.hasIframe && b.iframeCoolSec > 0 ? b.iframeCoolSec : 999;
        return coolA - coolB || b.stdExpectedDps - a.stdExpectedDps;
      }
      return b.stdExpectedDps - a.stdExpectedDps;
    });

    if (this.simCountStatus) {
      this.simCountStatus.textContent = `조건 부합: ${filtered.length}개 직업 (전체 ${MASTER_JOB_LIST.length}개)`;
    }

    if (!this.simCardsContainer) return;
    if (filtered.length === 0) {
      this.simCardsContainer.innerHTML = `<div style="text-align:center; color:#718096; padding:30px 10px; font-size:12px;">선택한 조건에 부합하는 직업이 없습니다.</div>`;
      return;
    }

    const styleLabelMap = {
      'HOLD_660': '660ms주력기유지',
      'KEYDOWN_BURST': '키다운극딜포함',
      'COMBO_CDR': '쿨감연계형'
    };

    const formatClearTime = (sec) => {
      const m = Math.floor(sec / 60);
      const s = Math.round(sec % 60);
      return `${m}분 ${String(s).padStart(2, '0')}초`;
    };

    this.simCardsContainer.innerHTML = filtered.map((item, idx) => {
      const isBurst = item.burstRate >= 50;
      const cardClass = isBurst ? 'burst-card' : 'sustained-card';
      const styleText = styleLabelMap[item.attackStyle] || '표준형';
      const roleTag = isBurst
        ? `<span style="color:#fc8181; font-size:10px; font-weight:bold;">[🔥극딜 ${item.burstRate}% · ${styleText}]</span>`
        : `<span style="color:#63b3ed; font-size:10px; font-weight:bold;">[🔄평딜 ${item.burstRate}% · ${styleText}]</span>`;

      const isMyFormulaSelected = sortMode === 'DPS_EFF_DESC';
      const gapSign = item.formulaGapPct >= 0 ? '+' : '';
      const rankDiff = item.stdRank - item.myRank;
      const rankDiffText = rankDiff > 0
        ? `<span style="color:#60a5fa;">(역산이 ▲${rankDiff}계단 높음)</span>`
        : (rankDiff < 0 ? `<span style="color:#4ade80;">(표준체급이 ▲${Math.abs(rankDiff)}계단 높음)</span>` : `<span>(순위 동일)</span>`);

      const hatLabel = item.cdrInfo.activeHatSec > 0 ? `${item.cdrInfo.activeHatSec}초뚝` : '스탯뚝(0초)';
      const sign = item.cdrInfo.gainAtActive >= 0 ? '+' : '';
      const cdrBadge = `<span class="util-badge cdr-badge" title="쿨감 유효 스킬 비중: ${item.cdrShare}% / 4초뚝 순수 딜상승: +${item.cdrInfo.grossGainAt4Sec}%">🎩${hatLabel}(딜 ${sign}${item.cdrInfo.gainAtActive}% · 4초유효 +${item.cdrInfo.grossGainAt4Sec}%)</span>`;

      const iframeBadge = item.hasIframe
        ? `<span class="util-badge iframe-ok" title="${item.iframeName}">🛡️무적 ${item.iframeCoolSec}초</span>`
        : `<span class="util-badge">무적기 없음</span>`;

      const actionBadge = filterProc660
        ? `<span class="util-badge cast-badge" title="6분간 사출기/자동타수 ${item.procCasts.toLocaleString()}회 제외됨 (660ms 정규화 기준)">⌨️실효 조작: ${item.finalNormActions.toLocaleString()}회 (사출 ${item.procCasts.toLocaleString()}제외)</span>`
        : `<span class="util-badge cast-badge">⌨️원시 총 타수: ${item.displayActions.toLocaleString()}회</span>`;

      const bindBadge = item.hasBind ? `<span class="util-badge bind-ok">⛓️바인드</span>` : '';

      return `
        <div class="job-sim-card ${cardClass}" data-job="${item.job}">
          <div class="card-top">
            <div class="job-title-wrap">
              <span class="rank-num">${idx + 1}위</span>
              <span class="job-name">${item.job}</span>
              ${roleTag}
            </div>
            <span style="font-size:10px; color:#cbd5e0;">헥환 <b>${item.hexaRate}%</b> · 권장: <b>${item.cdrInfo.recHatSec > 0 ? item.cdrInfo.recHatSec + '초뚝' : '스탯뚝'}</b></span>
          </div>

          <!-- 🟢환산주스탯(초록색) vs 🔵내 역산 데미지 공식(파란색) 2단 직관 비교 박스 -->
          <div class="formula-compare-box">
            <div class="formula-row ${!isMyFormulaSelected ? 'active-formula-row' : ''}">
              <span class="text-green-formula">🟢 환산체급 (#${item.stdRank}위 · ${item.stdDpmJo}조)</span>
              <span class="text-green-formula">${formatKoreanNumber(item.stdExpectedDps)}/초 <small style="color:#a7f3d0; font-weight:normal;">(${formatClearTime(item.stdClearSec)})</small></span>
            </div>
            <div class="formula-row ${isMyFormulaSelected ? 'active-formula-row' : ''}">
              <span class="text-blue-formula">🔵 내역산공식 (#${item.myRank}위 · 지수 ${item.myEffFullIndexP})</span>
              <span class="text-blue-formula">${formatKoreanNumber(item.myExpectedDps)}/초 <small style="color:#bae6fd; font-weight:normal;">(${formatClearTime(item.myClearSec)})</small></span>
            </div>
            <div class="formula-diff-line">
              <span>⚖️ 공식 편차: <b style="color:${item.formulaGapPct >= 0 ? '#60a5fa' : '#4ade80'};">${gapSign}${item.formulaGapPct}%</b> ${rankDiffText}</span>
              <span>전투력효율: ${item.bpEff.toLocaleString()}</span>
            </div>
          </div>

          <div class="card-badges">
            ${cdrBadge}
            ${actionBadge}
            ${iframeBadge}
            ${bindBadge}
          </div>
        </div>
      `;
    }).join('');

    this.simCardsContainer.querySelectorAll('.job-sim-card').forEach(card => {
      card.addEventListener('click', () => {
        ipcRenderer.send('sim-select-job-in-main', card.dataset.job);
      });
    });
  }

  renderUtilityEditor() {
    if (!this.utilEditListContainer) return;
    this.utilEditListContainer.innerHTML = MASTER_JOB_LIST.map(jobName => {
      const u = this.utilityDb[jobName] || {};
      return `
        <div style="background:#181e2c; border:1px solid #2d3748; border-radius:4px; padding:6px 8px; display:flex; align-items:center; justify-content:space-between; gap:5px; font-size:10px;">
          <strong style="width:82px; color:#fff; flex-shrink:0;">${jobName}</strong>
          <label style="white-space:nowrap;" title="쿨뚝 영향을 받는 스킬 딜 비중(%)">
            쿨감비중:<input type="number" class="edit-cdrshare-input" data-job="${jobName}" value="${u.cdrShare || 20}" style="width:36px; background:#11151e; color:#d6bcfa; border:1px solid #4a5568; text-align:right; font-size:10px;" />%
          </label>
          <label style="white-space:nowrap;" title="표준 권장 모자 초수(0/2/4)">
            권장뚝:<input type="number" class="edit-rechat-input" data-job="${jobName}" value="${u.recHatSec || 0}" style="width:28px; background:#11151e; color:#4fd1c5; border:1px solid #4a5568; text-align:right; font-size:10px;" />초
          </label>
          <label style="white-space:nowrap;">
            <input type="checkbox" class="edit-iframe-chk" data-job="${jobName}" ${u.hasIframe ? 'checked' : ''} />무적
          </label>
          <label style="white-space:nowrap;">
            쿨:<input type="number" class="edit-cool-input" data-job="${jobName}" value="${u.iframeCoolSec || 0}" style="width:34px; background:#11151e; color:#fbd38d; border:1px solid #4a5568; text-align:right; font-size:10px;" />초
          </label>
        </div>
      `;
    }).join('');

    const bindUpdate = () => {
      this.utilEditListContainer.querySelectorAll('.edit-cdrshare-input').forEach(inp => {
        this.utilityDb[inp.dataset.job].cdrShare = Number(inp.value) || 0;
      });
      this.utilEditListContainer.querySelectorAll('.edit-rechat-input').forEach(inp => {
        this.utilityDb[inp.dataset.job].recHatSec = Number(inp.value) || 0;
      });
      this.utilEditListContainer.querySelectorAll('.edit-iframe-chk').forEach(chk => {
        this.utilityDb[chk.dataset.job].hasIframe = chk.checked;
      });
      this.utilEditListContainer.querySelectorAll('.edit-cool-input').forEach(inp => {
        this.utilityDb[inp.dataset.job].iframeCoolSec = Number(inp.value) || 0;
      });
      this.saveUtilityDb();
      this.renderSimulationCards();
    };

    this.utilEditListContainer.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('change', bindUpdate);
    });
  }

  bindEvents() {
    if (this.snapStateBtn) {
      this.snapStateBtn.addEventListener('click', () => ipcRenderer.send('sim-force-snap'));
    }

    ipcRenderer.on('snap-state-changed', (event, snapped) => {
      if (!this.snapStateBtn) return;
      this.snapStateBtn.classList.toggle('active-snap', snapped);
      this.snapStateBtn.textContent = snapped ? '🧲 자석 붙음' : '🔓 분리됨(클릭시 부착)';
    });

    ipcRenderer.on('db-updated-from-main', () => this.reloadFromMainDb());

    if (this.alwaysOnTopBtn) {
      this.alwaysOnTopBtn.addEventListener('click', () => {
        this.isAlwaysOnTop = !this.isAlwaysOnTop;
        this.alwaysOnTopBtn.classList.toggle('active-pin', this.isAlwaysOnTop);
        ipcRenderer.send('sim-toggle-always-on-top', this.isAlwaysOnTop);
      });
    }

    if (this.minWinBtn) this.minWinBtn.addEventListener('click', () => ipcRenderer.send('sim-window-minimize'));
    if (this.closeWinBtn) this.closeWinBtn.addEventListener('click', () => ipcRenderer.send('sim-window-close'));

    if (this.tabSimResult && this.tabUtilEdit) {
      this.tabSimResult.addEventListener('click', () => {
        this.tabSimResult.classList.add('active');
        this.tabUtilEdit.classList.remove('active');
        this.simResultView.classList.remove('hidden');
        this.utilEditView.classList.add('hidden');
      });
      this.tabUtilEdit.addEventListener('click', () => {
        this.tabUtilEdit.classList.add('active');
        this.tabSimResult.classList.remove('active');
        this.utilEditView.classList.remove('hidden');
        this.simResultView.classList.add('hidden');
      });
    }

    [
      this.simCpManInput,
      this.simFragInput,
      this.simBossHpJoInput,
      this.simCoolHatSelect,
      this.simCdrWeightMode,
      this.simRoleFilter,
      this.simIframeFilter,
      this.simSortSelect,
      this.chkFilterProc660,
      this.chkBase660Burst
    ].forEach(el => {
      if (el) el.addEventListener('input', () => this.renderSimulationCards());
      if (el) el.addEventListener('change', () => this.renderSimulationCards());
    });

    document.querySelectorAll('.frag-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (this.simFragInput) this.simFragInput.value = chip.dataset.frag;
        document.querySelectorAll('.frag-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.renderSimulationCards();
      });
    });

    if (this.resetUtilDbBtn) {
      this.resetUtilDbBtn.addEventListener('click', () => {
        localStorage.removeItem(this.STORAGE_KEY_CUSTOM_UTIL);
        this.loadUtilityDb();
        this.renderUtilityEditor();
        this.renderSimulationCards();
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new MapleSimulatorWindow();
});