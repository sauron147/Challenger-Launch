const { ipcRenderer } = require('electron');
const {
  HERO_CALIBRATED_FULL_INDEX,
  HERO_BASELINE_DPM_JO,
  BP_EFF_TO_INDEX_DIVISOR,
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
    this.STORAGE_KEY_CUSTOM_UTIL = 'MAPLE_SIM_CUSTOM_UTIL_DB_V2';
    this.localDbData = null;
    this.utilityDb = {};
    this.isAlwaysOnTop = false;
    this.calibrationMode = 'STD_DPM'; // 'STD_DPM'(헥환 11만 체급 보정: 카데나 1위) 또는 'BP_EFF'(단순 전투력 나눗셈: 카이저 1위)

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

    this.simRoleFilter = document.getElementById('simRoleFilter');
    this.simIframeFilter = document.getElementById('simIframeFilter');
    this.simSortSelect = document.getElementById('simSortSelect');

    // 정렬 셀렉트 박스에 체급 보정 vs 전투력 효율 모드 옵션 보강
    if (this.simSortSelect) {
      this.simSortSelect.innerHTML = `
        <option value="DPS_STD_DESC" selected>보정 체급 딜량순 (카데나 1위 기준)</option>
        <option value="DPS_EFF_DESC">인게임 전투력 효율순 (카이저 1위 기준)</option>
        <option value="BURST_DESC">30초 극딜 비중 높은순</option>
        <option value="CAST_DESC">스킬 사용 횟수 많은순(바쁨)</option>
        <option value="CAST_ASC">스킬 사용 횟수 적은순(편함)</option>
        <option value="IFRAME_ASC">무적기 쿨타임 짧은순</option>
      `;
    }

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

  calcRecordBurstShare(rec) {
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
      if (n30 + n90 === 0) {
        totalBurst += d * ((30 * omega) / (30 * omega + 90));
      } else {
        totalBurst += d * ((n30 * omega) / (n30 * omega + n90));
      }
    });

    return Math.min(100, Number(totalBurst.toFixed(1)));
  }

  renderSimulationCards() {
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
      let avgTotalCasts = baseMeta.avgCasts || 1500;
      let topSkillSummary = `연무장 체급 ${baseMeta.stdDpmJo || 4.60}조 (기본DB)`;
      let burstRate = baseMeta.burstRate ?? 50.0;

      // 로컬 DB에 실제 조회 기록이 있으면 실시간 데이터로 덮어쓰기
      if (cnt > 0) {
        const sumDps = matchedRecs.reduce((a, c) => a + (c.dps || 0), 0);
        const sumCp = matchedRecs.reduce((a, c) => a + (c.combatPower || 0), 0);
        avgEff = sumCp > 0 ? Math.round(sumDps / sumCp) : Math.round(matchedRecs.reduce((a, c) => a + c.efficiency, 0) / cnt);

        let castSum = 0;
        const skillUseMap = new Map();
        matchedRecs.forEach(r => {
          (r.skills || []).forEach(sk => {
            const u = Number(sk.useCount) || 0;
            castSum += u;
            skillUseMap.set(sk.name, (skillUseMap.get(sk.name) || 0) + u);
          });
        });
        if (castSum > 0) avgTotalCasts = Math.round(castSum / cnt);

        const topSkills = Array.from(skillUseMap.entries())
          .map(([name, sumU]) => ({ name, avgU: Math.round(sumU / cnt) }))
          .sort((a, b) => b.avgU - a.avgU)
          .slice(0, 2);

        if (topSkills.length > 0) {
          topSkillSummary = topSkills.map(s => `${s.name}(${s.avgU.toLocaleString()}회)`).join(', ');
        }

        const bRates = matchedRecs.map(r => this.calcRecordBurstShare(r)).filter(v => v !== null);
        if (bRates.length > 0) {
          burstRate = Number((bRates.reduce((a, b) => a + b, 0) / bRates.length).toFixed(1));
        }
      }

      if (savedBurstProfiles[jobName] && typeof savedBurstProfiles[jobName].burstRate === 'number') {
        burstRate = savedBurstProfiles[jobName].burstRate;
      }

      // [핵심] 1번째 사진(헥환 11만 체급 딜량: 카데나 1위 4.965조 / 히어로 13위 4.6907조) 비례 풀강 지수 산출
      // 조각 4만 개(풀강)일 때 1번째 사진의 순위(카데나 1위 ~ 렌 48위)가 정확히 재현되도록 역산 보정
      const stdDpmRatio = (baseMeta.stdDpmJo || HERO_BASELINE_DPM_JO) / HERO_BASELINE_DPM_JO;
      const rateAt40k = this.getInterpolatedHexaRate(jobName, 40000);
      const heroRateAt40k = this.getInterpolatedHexaRate('히어로', 40000);
      const stdCalibratedFullIndex = HERO_CALIBRATED_FULL_INDEX * stdDpmRatio * (heroRateAt40k / rateAt40k);

      // 전투력 나눗셈 효율(DPS/전투력: 카이저 1위 7,914) 비례 풀강 지수
      const effCalibratedFullIndex = HERO_CALIBRATED_FULL_INDEX * (avgEff / heroAvgEff);

      // 선택된 정렬/보정 모드에 따라 적용할 풀강 지수 결정
      const activeFullIndexP = sortMode === 'DPS_EFF_DESC' ? effCalibratedFullIndex : stdCalibratedFullIndex;

      const hexaRate = this.getInterpolatedHexaRate(jobName, fragCount);
      const fullEff = activeFullIndexP * BP_EFF_TO_INDEX_DIVISOR;
      const expectedRealDps = Math.round(combatPower * fullEff * (hexaRate / 100) * realFactorK * forceMult);

      const bossHpTotal = bossHpJo * 1e12;
      const clearSec = expectedRealDps > 0 ? (bossHpTotal / expectedRealDps) : 9999;

      return {
        job: jobName,
        rank11: baseMeta.rank11 || 99,
        stdDpmJo: baseMeta.stdDpmJo || 4.5,
        bpEff: avgEff,
        recordCount: cnt,
        expectedRealDps,
        hexaRate,
        clearSec,
        burstRate,
        avgTotalCasts,
        topSkillSummary,
        hasIframe: Boolean(baseMeta.hasIframe),
        iframeCoolSec: Number(baseMeta.iframeCoolSec) || 0,
        iframeName: baseMeta.iframeName || '정보 없음',
        hasBind: Boolean(baseMeta.hasBind),
        difficulty: baseMeta.difficulty || '보통'
      };
    });

    const roleFilter = this.simRoleFilter?.value || 'ALL';
    const iframeFilter = this.simIframeFilter?.value || 'ALL';

    const filtered = jobResults.filter(item => {
      if (roleFilter === 'BURST' && (item.burstRate === null || item.burstRate < 50)) return false;
      if (roleFilter === 'SUSTAINED' && (item.burstRate === null || item.burstRate >= 50)) return false;

      if (iframeFilter === 'HAS_IFRAME' && !item.hasIframe) return false;
      if (!isNaN(Number(iframeFilter)) && Number(iframeFilter) > 0) {
        const maxCool = Number(iframeFilter);
        if (!item.hasIframe || item.iframeCoolSec <= 0 || item.iframeCoolSec > maxCool) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (sortMode === 'BURST_DESC') return (b.burstRate || 0) - (a.burstRate || 0);
      if (sortMode === 'CAST_DESC') return b.avgTotalCasts - a.avgTotalCasts;
      if (sortMode === 'CAST_ASC') return a.avgTotalCasts - b.avgTotalCasts;
      if (sortMode === 'IFRAME_ASC') {
        const coolA = a.hasIframe && a.iframeCoolSec > 0 ? a.iframeCoolSec : 999;
        const coolB = b.hasIframe && b.iframeCoolSec > 0 ? b.iframeCoolSec : 999;
        return coolA - coolB || b.expectedRealDps - a.expectedRealDps;
      }
      return b.expectedRealDps - a.expectedRealDps;
    });

    if (this.simCountStatus) {
      this.simCountStatus.textContent = `조건 부합: ${filtered.length}개 직업 (전체 ${MASTER_JOB_LIST.length}개)`;
    }

    if (!this.simCardsContainer) return;
    if (filtered.length === 0) {
      this.simCardsContainer.innerHTML = `<div style="text-align:center; color:#718096; padding:30px 10px; font-size:12px;">선택한 조건에 부합하는 직업이 없습니다.</div>`;
      return;
    }

    this.simCardsContainer.innerHTML = filtered.map((item, idx) => {
      const isBurst = item.burstRate !== null && item.burstRate >= 50;
      const cardClass = isBurst ? 'burst-card' : 'sustained-card';
      const roleTag = isBurst
        ? `<span style="color:#fc8181; font-size:10px; font-weight:bold;">[🔥극딜 ${item.burstRate}%]</span>`
        : `<span style="color:#63b3ed; font-size:10px; font-weight:bold;">[🔄평딜 ${item.burstRate}%]</span>`;

      const clearMin = Math.floor(item.clearSec / 60);
      const clearRemSec = Math.round(item.clearSec % 60);
      const clearText = `${bossHpJo}조 클리어: 약 ${clearMin}분 ${String(clearRemSec).padStart(2, '0')}초`;

      const iframeBadge = item.hasIframe
        ? `<span class="util-badge iframe-ok" title="${item.iframeName}">🛡️무적 쿨 ${item.iframeCoolSec}초 (${item.iframeName})</span>`
        : `<span class="util-badge">무적기 없음(${item.iframeName})</span>`;

      const bindBadge = item.hasBind
        ? `<span class="util-badge bind-ok">⛓️자체바인드</span>`
        : '';

      const castBadge = `<span class="util-badge cast-badge">⌨️6분 평균 타수: ${item.avgTotalCasts.toLocaleString()}회</span>`;

      return `
        <div class="job-sim-card ${cardClass}" data-job="${item.job}">
          <div class="card-top">
            <div class="job-title-wrap">
              <span class="rank-num">${idx + 1}위</span>
              <span class="job-name">${item.job}</span>
              ${roleTag}
            </div>
            <span class="dps-val">${formatKoreanNumber(item.expectedRealDps)}/초</span>
          </div>
          <div class="card-mid">
            <span style="color:#fbd38d; font-weight:bold;">⏱️ ${clearText}</span>
            <span style="font-size:10px; color:#a0aec0;">헥환 ${item.hexaRate}% · ${item.topSkillSummary}</span>
          </div>
          <div class="card-badges">
            ${iframeBadge}
            ${castBadge}
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
      const u = this.utilityDb[jobName] || { hasIframe: false, iframeCoolSec: 0, iframeName: '', stdDpmJo: 4.5 };
      return `
        <div style="background:#181e2c; border:1px solid #2d3748; border-radius:4px; padding:6px 8px; display:flex; align-items:center; justify-content:space-between; gap:6px; font-size:11px;">
          <strong style="width:90px; color:#fff; flex-shrink:0;">${jobName}</strong>
          <label style="display:flex; align-items:center; gap:2px; white-space:nowrap;" title="헥환 11만 기준 연무장 평균 딜량(조)">
            체급:<input type="number" step="0.01" class="edit-dpm-input" data-job="${jobName}" value="${u.stdDpmJo || 4.5}" style="width:46px; background:#11151e; color:#4fd1c5; border:1px solid #4a5568; text-align:right; font-size:10px;" />조
          </label>
          <label style="display:flex; align-items:center; gap:2px; white-space:nowrap;">
            <input type="checkbox" class="edit-iframe-chk" data-job="${jobName}" ${u.hasIframe ? 'checked' : ''} />무적
          </label>
          <label style="display:flex; align-items:center; gap:2px; white-space:nowrap;">
            쿨:<input type="number" class="edit-cool-input" data-job="${jobName}" value="${u.iframeCoolSec}" style="width:40px; background:#11151e; color:#fbd38d; border:1px solid #4a5568; text-align:right; font-size:10px;" />초
          </label>
          <input type="text" class="edit-desc-input" data-job="${jobName}" value="${u.iframeName}" placeholder="무적기 설명" style="flex:1; min-width:65px; background:#11151e; color:#cbd5e0; border:1px solid #4a5568; font-size:10px; padding:2px 4px;" />
        </div>
      `;
    }).join('');

    const bindUpdate = () => {
      this.utilEditListContainer.querySelectorAll('.edit-dpm-input').forEach(inp => {
        this.utilityDb[inp.dataset.job].stdDpmJo = Number(inp.value) || 4.5;
      });
      this.utilEditListContainer.querySelectorAll('.edit-iframe-chk').forEach(chk => {
        this.utilityDb[chk.dataset.job].hasIframe = chk.checked;
      });
      this.utilEditListContainer.querySelectorAll('.edit-cool-input').forEach(inp => {
        this.utilityDb[inp.dataset.job].iframeCoolSec = Number(inp.value) || 0;
      });
      this.utilEditListContainer.querySelectorAll('.edit-desc-input').forEach(inp => {
        this.utilityDb[inp.dataset.job].iframeName = inp.value;
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
      this.snapStateBtn.addEventListener('click', () => {
        ipcRenderer.send('sim-force-snap');
      });
    }

    ipcRenderer.on('snap-state-changed', (event, snapped) => {
      if (!this.snapStateBtn) return;
      this.snapStateBtn.classList.toggle('active-snap', snapped);
      this.snapStateBtn.textContent = snapped ? '🧲 자석 붙음' : '🔓 분리됨(클릭시 부착)';
    });

    ipcRenderer.on('db-updated-from-main', () => {
      this.reloadFromMainDb();
    });

    if (this.alwaysOnTopBtn) {
      this.alwaysOnTopBtn.addEventListener('click', () => {
        this.isAlwaysOnTop = !this.isAlwaysOnTop;
        this.alwaysOnTopBtn.classList.toggle('active-pin', this.isAlwaysOnTop);
        ipcRenderer.send('sim-toggle-always-on-top', this.isAlwaysOnTop);
      });
    }

    if (this.minWinBtn) {
      this.minWinBtn.addEventListener('click', () => ipcRenderer.send('sim-window-minimize'));
    }
    if (this.closeWinBtn) {
      this.closeWinBtn.addEventListener('click', () => ipcRenderer.send('sim-window-close'));
    }

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
      this.simRoleFilter,
      this.simIframeFilter,
      this.simSortSelect
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