const { ipcRenderer } = require('electron');

const SEEDRING_KEYWORDS = [
  '리스트레인트 링', '컨티뉴어스 링', '웨폰퍼프', '리스크테이커 링', '크라이시스', '링 오브 썸', '듀라빌리티 링', '얼티메이텀 링'
];

const KNOWN_BUFF_KEYWORDS = [
  '소울 컨트랙트', '그란디스 여신의 축복', '시그너스 여신의 축복', '메이플월드 여신의 축복', '이계의 여신의 축복', '초월자 륀느의 기원',
  '바디 오브 스틸', '오라 웨폰', '오버드라이브', '레디 투 다이', '에픽 어드벤처', '히어로즈 오쓰',
  '파이널 트랜스', '마제스티 오브 카이저', '로버스트 아머', '파이널 피규레이션', '초월 : 불굴의 결의', '리미트 브레이크', '메이플 용사'
];

const KNOWN_ATTACK_SUB_KEYWORDS = [
  '윌 오브 소드', '드래곤 블레이즈', '윙비트', '솔 헤카테', '에고 웨폰', '오라 웨폰(파동)', '스톰 브레이크', '어스 브레이크', '트랜스젠던스'
];

const JOB_NAME_ALIASES = {
  '캐논마스터': ['캐논마스터', '캐논슈터'],
  '캐논슈터': ['캐논슈터', '캐논마스터'],
  '듀얼블레이더': ['듀얼블레이더', '듀얼블레이드'],
  '듀얼블레이드': ['듀얼블레이드', '듀얼블레이더']
};

const HEXA_CORE_COST_TABLE = {
  mastery: [0, 50, 15, 18, 20, 23, 25, 28, 30, 33, 100, 40, 45, 50, 55, 60, 65, 70, 75, 80, 175, 85, 90, 95, 100, 105, 110, 115, 120, 125, 250],
  enhancement: [0, 75, 23, 27, 30, 34, 38, 42, 45, 49, 150, 60, 68, 75, 83, 90, 98, 105, 113, 120, 263, 128, 135, 143, 150, 158, 165, 173, 180, 188, 375],
  skill: [0, 100, 30, 35, 40, 45, 50, 55, 60, 65, 200, 80, 90, 100, 110, 120, 130, 140, 150, 160, 350, 170, 180, 190, 200, 210, 220, 230, 240, 250, 500],
  common: [0, 125, 38, 44, 50, 57, 63, 69, 75, 82, 300, 110, 124, 138, 152, 165, 179, 193, 207, 220, 525, 234, 248, 262, 275, 289, 303, 317, 330, 344, 750]
};

const HEXA_FRAGMENT_TABLE = {
  '히어로': [[64.22, 1979], [73.54, 5004], [81.08, 9905], [89.68, 19554], [99.42, 39731]],
  '배틀메이지': [[67.92, 2007], [72.72, 5115], [79.29, 10017], [87.96, 20204], [97.72, 39442]],
  '메카닉': [[67.57, 2141], [72.31, 4880], [79.62, 9971], [88.22, 19796], [98.37, 39888]],
  '아크': [[67.55, 2029], [73.39, 4798], [82.09, 10033], [90.60, 19923], [98.90, 39754]],
  '윈드브레이커': [[67.35, 2012], [72.61, 5095], [79.60, 10104], [88.03, 20251], [98.27, 40267]],
  '카이저': [[67.28, 2010], [74.26, 4770], [81.50, 10002], [89.72, 20315], [98.39, 40121]],
  '렌': [[67.26, 2052], [73.03, 5022], [80.95, 10208], [89.10, 20180], [98.53, 40517]],
  '은월': [[66.68, 2013], [72.87, 5011], [80.97, 10018], [89.15, 20013], [98.24, 40092]],
  '제로': [[66.52, 1951], [76.91, 4979], [83.96, 9941], [91.69, 20042], [99.32, 40442]],
  '캡틴': [[66.27, 2015], [72.55, 5164], [80.15, 9959], [88.81, 20273], [98.51, 39892]],
  '블래스터': [[66.06, 2112], [71.76, 5160], [78.92, 9737], [88.48, 20025], [98.24, 39570]],
  '일리움': [[65.65, 2047], [74.57, 5055], [81.82, 10005], [90.28, 19941], [98.93, 39916]],
  '팬텀': [[65.45, 2137], [70.93, 5137], [78.18, 10103], [87.15, 20662], [98.08, 40017]],
  '레테': [[65.29, 2103], [74.51, 4945], [83.44, 10003], [91.55, 20590], [99.06, 40481]],
  '아란': [[64.99, 2060], [71.96, 4944], [79.00, 10161], [87.55, 19657], [98.28, 40517]],
  '에반': [[64.92, 2140], [71.52, 4717], [79.06, 10201], [88.78, 19885], [98.51, 40025]],
  '소울마스터': [[64.85, 1998], [73.19, 4999], [80.38, 10269], [89.09, 19905], [98.63, 40242]],
  '다크나이트': [[64.77, 2083], [71.71, 5330], [79.31, 9952], [88.86, 19928], [98.34, 40430]],
  '섀도어': [[64.71, 1977], [73.69, 5127], [80.70, 10035], [89.38, 19918], [99.23, 39736]],
  '신궁': [[64.50, 2175], [70.22, 4998], [78.07, 9842], [88.73, 20019], [98.26, 39570]],
  '제논': [[64.49, 2007], [69.88, 5009], [77.75, 10036], [87.51, 20661], [98.00, 39401]],
  '루미너스': [[64.46, 2037], [72.19, 4898], [79.01, 9730], [88.74, 20067], [98.58, 40365]],
  '보우마스터': [[64.34, 2020], [71.22, 5325], [79.19, 10035], [88.55, 20588], [98.65, 40067]],
  '키네시스': [[64.26, 1968], [73.04, 5007], [81.07, 10140], [89.39, 19210], [99.55, 40229]],
  '나이트로드': [[64.04, 2064], [70.46, 4735], [78.05, 10086], [87.63, 20468], [97.82, 39291]],
  '칼리': [[63.89, 2016], [72.41, 5034], [79.64, 10096], [88.59, 19793], [98.78, 40616]],
  '데몬슬레이어': [[63.88, 1845], [70.81, 5046], [79.69, 10768], [88.24, 20003], [98.42, 40073]],
  '아크메이지(불,독)': [[63.79, 1957], [73.01, 4877], [80.47, 10058], [88.75, 20383], [98.38, 40590]],
  '패스파인더': [[63.71, 1909], [72.94, 4698], [80.91, 9905], [88.96, 19572], [98.51, 40060]],
  '플레임위자드': [[63.66, 2003], [69.42, 5019], [77.98, 10204], [87.03, 20306], [98.03, 39957]],
  '카인': [[63.57, 2055], [72.09, 4838], [80.27, 9689], [90.48, 20888], [98.38, 39432]],
  '팔라딘': [[63.54, 2006], [71.00, 4941], [78.13, 9980], [87.90, 20031], [98.43, 40048]],
  '나이트워커': [[63.49, 2005], [70.89, 4906], [77.10, 9737], [87.54, 20693], [98.21, 40004]],
  '아크메이지(썬,콜)': [[63.39, 2034], [71.53, 5073], [78.84, 10014], [87.85, 20031], [98.01, 39860]],
  '호영': [[63.23, 2016], [72.31, 5303], [79.72, 10074], [89.62, 19886], [98.64, 40150]],
  '데몬어벤져': [[63.12, 1878], [71.61, 4967], [79.30, 9952], [88.09, 20028], [98.52, 40132]],
  '엔젤릭버스터': [[62.91, 1934], [72.85, 5197], [80.61, 9937], [89.52, 20038], [98.46, 40022]],
  '와일드헌터': [[62.90, 1928], [71.74, 4940], [79.99, 10026], [88.85, 20253], [98.41, 40142]],
  '듀얼블레이드': [[62.56, 1895], [70.28, 5008], [77.04, 9971], [87.33, 20135], [98.33, 40967]],
  '듀얼블레이더': [[62.56, 1895], [70.28, 5008], [77.04, 9971], [87.33, 20135], [98.33, 40967]],
  '아델': [[62.30, 2010], [71.06, 5019], [79.03, 10163], [88.72, 19933], [98.38, 39954]],
  '메르세데스': [[62.25, 2009], [69.94, 4966], [77.31, 9959], [87.59, 20284], [98.28, 40069]],
  '캐논슈터': [[61.46, 2019], [70.05, 4798], [78.45, 9961], [88.85, 20186], [98.16, 39865]],
  '캐논마스터': [[61.46, 2019], [70.05, 4798], [78.45, 9961], [88.85, 20186], [98.16, 39865]],
  '라라': [[61.29, 1957], [70.61, 5072], [78.19, 9809], [87.95, 19857], [97.89, 39518]],
  '바이퍼': [[61.01, 2019], [68.61, 4779], [76.86, 9997], [87.49, 20354], [98.31, 39442]],
  '미하일': [[60.72, 1988], [69.15, 5031], [77.18, 10296], [87.42, 19907], [98.07, 39550]],
  '카데나': [[60.11, 1782], [70.73, 4996], [79.58, 9879], [88.79, 19483], [98.48, 39996]],
  '스트라이커': [[59.67, 1977], [68.60, 5004], [76.89, 10115], [87.42, 19714], [98.67, 41462]],
  '비숍': [[59.42, 1989], [69.57, 5149], [77.33, 10038], [87.79, 20269], [97.97, 39935]]
};

const MASTER_JOB_LIST = Object.keys(HEXA_FRAGMENT_TABLE).filter(
  j => j !== '듀얼블레이더' && j !== '캐논마스터'
);

const HERO_CALIBRATED_FULL_INDEX = 819.5;
const BP_EFF_TO_INDEX_DIVISOR = 12;

class NexonMapleApi {
  constructor(apiKey) {
    this.baseUrl = 'https://open.api.nexon.com/maplestory/v1';
    this.apiKey = apiKey ? apiKey.trim() : '';
  }

  async request(endpoint, params = {}, timeoutMs = 8000, retries = 2) {
    if (!this.apiKey) throw new Error('API Key가 입력되지 않았습니다.');
    const url = new URL(`${this.baseUrl}${endpoint}`);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.append(k, v);
    });

    for (let attempt = 1; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'x-nxopen-api-key': this.apiKey,
            'Accept': 'application/json'
          },
          signal: controller.signal
        });
        clearTimeout(timer);

        if (res.status === 429 && attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error?.message || `HTTP 오류 ${res.status}`);
        }
        return await res.json();
      } catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
          if (attempt < retries) continue;
          throw new Error('API 응답 시간 초과 (Timeout)');
        }
        if (attempt >= retries) throw err;
        await new Promise(r => setTimeout(r, 600));
      }
    }
  }

  getAccountCharacters() { return this.request('/character/list'); }
  getOcid(characterName) { return this.request('/id', { character_name: characterName }); }
  getCharacterBasic(ocid) { return this.request('/character/basic', { ocid }); }
  getCharacterStat(ocid) { return this.request('/character/stat', { ocid }); }
  getCharacterHexaMatrix(ocid) { return this.request('/character/hexamatrix', { ocid }); }
  getBattlePracticeReplayIds(ocid, date) { return this.request('/battle-practice/replay-id', { ocid, date }); }
  getBattlePracticeResult(replayId) { return this.request('/battle-practice/result', { replay_id: replayId }); }
  getBattlePracticeCharacterInfo(replayId) { return this.request('/battle-practice/character-info', { replay_id: replayId }); }

  async getCharacterSkillsByGrades(ocid, grades = ['5', '6']) {
    const skillMetaMap = {};
    const gradeLabels = { '4': '4차', 'hyperactive': '하이퍼', '5': '5차', '6': '6차' };

    for (const g of grades) {
      try {
        await new Promise(r => setTimeout(r, 180));
        const res = await this.request('/character/skill', { ocid, character_skill_grade: g });
        const list = res.character_skill || [];
        const grade = gradeLabels[g] || g;
        list.forEach(sk => {
          if (!sk.skill_name) return;
          skillMetaMap[sk.skill_name] = {
            name: sk.skill_name,
            grade,
            description: sk.skill_description || '',
            effect: sk.skill_effect || ''
          };
        });
      } catch (e) {}
    }
    return skillMetaMap;
  }

  async getBattlePracticeSkillTimelineAll(replayId) {
    let allTimelines = [];
    let pageNo = 1;
    let totalPage = 1;

    do {
      try {
        if (pageNo > 1) await new Promise(r => setTimeout(r, 150));
        const res = await this.request('/battle-practice/skill-timeline', { replay_id: replayId, page_no: pageNo });
        if (res && Array.isArray(res.skill_timeline)) {
          allTimelines = allTimelines.concat(res.skill_timeline);
        }
        totalPage = Number(res.total_page_no) || 1;
        pageNo++;
      } catch (err) {
        break;
      }
    } while (pageNo <= totalPage && pageNo <= 20);

    return allTimelines;
  }
}

const Utils = {
  formatKoreanNumber(num) {
    if (num === undefined || num === null || isNaN(num) || Number(num) <= 0) return '-';
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
  },

  formatShortDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr).slice(0, 10);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}.${mm}.${dd}`;
  },

  isSameJob(jobA, jobB) {
    if (!jobA || !jobB) return false;
    if (jobA === jobB) return true;
    const aliases = JOB_NAME_ALIASES[jobA] || [jobA];
    return aliases.includes(jobB);
  },

  getCanonicalJobName(jobName) {
    if (!jobName) return '';
    if (jobName === '캐논마스터') return '캐논슈터';
    if (jobName === '듀얼블레이더') return '듀얼블레이드';
    return jobName;
  },

  calculateHexaFragmentsFromApi(hexaData) {
    const cores = hexaData?.character_hexa_core_equipment || [];
    if (!Array.isArray(cores) || cores.length === 0) {
      return { combatFragments: 0, totalFragments: 0, summaryText: '6차 코어 정보 없음' };
    }

    let masteryFrags = 0, enhanceFrags = 0, skillFrags = 0, janusFrags = 0, skillCoreIdx = 0;

    cores.forEach(core => {
      const name = String(core.hexa_core_name || '');
      const lv = Math.min(30, Math.max(0, Number(core.hexa_core_level) || 0));
      if (lv <= 0) return;
      const type = String(core.hexa_core_type || '');

      if (type.includes('마스터리')) {
        for (let i = 1; i <= lv; i++) masteryFrags += HEXA_CORE_COST_TABLE.mastery[i] || 0;
      } else if (type.includes('강화')) {
        for (let i = 1; i <= lv; i++) enhanceFrags += HEXA_CORE_COST_TABLE.enhancement[i] || 0;
      } else if (type.includes('스킬')) {
        skillCoreIdx++;
        for (let i = 1; i <= lv; i++) {
          if (i === 1 && skillCoreIdx === 1) continue;
          skillFrags += HEXA_CORE_COST_TABLE.skill[i] || 0;
        }
      } else if (type.includes('공용')) {
        if (name.includes('야누스')) {
          for (let i = 1; i <= lv; i++) janusFrags += HEXA_CORE_COST_TABLE.common[i] || 0;
        } else {
          for (let i = 1; i <= lv; i++) skillFrags += HEXA_CORE_COST_TABLE.skill[i] || 0;
        }
      }
    });

    const combatFragments = masteryFrags + enhanceFrags + skillFrags;
    const totalFragments = combatFragments + janusFrags;
    const summaryText = `마스터리 ${masteryFrags.toLocaleString()} + 강화 ${enhanceFrags.toLocaleString()} + 스킬 ${skillFrags.toLocaleString()}`;

    return { combatFragments, totalFragments, summaryText };
  },

  groupByJob(characters) {
    const map = new Map();
    characters.forEach(ch => {
      const job = ch.character_class || '미분류';
      const lv = Number(ch.character_level) || 0;
      if (!map.has(job)) map.set(job, []);
      map.get(job).push(lv);
    });
    const list = [];
    for (const [job, levels] of map.entries()) {
      levels.sort((a, b) => b - a);
      list.push({ job, count: levels.length, levels, maxLv: levels[0] || 0 });
    }
    return list.sort((a, b) => b.maxLv - a.maxLv || b.count - a.count);
  },

  sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
};

class MapleDashboardApp {
  constructor() {
    this.STORAGE_KEY_API = 'NEXON_MAPLE_API_KEY';
    this.STORAGE_KEY_MANUAL_CATS = 'MAPLE_MANUAL_SKILL_CATS_V2';
    this.STORAGE_KEY_SAVED_BURST_PROFILES = 'MAPLE_SAVED_JOB_BURST_PROFILES_V1';

    this.api = null;
    this.allCharacters = [];
    this.filteredCharacters = [];

    this.seasonsDb = new Map();
    this.currentSeasonKey = 'season_5';
    this.skillClassificationDb = {};

    this.savedJobBurstProfiles = {};
    this.burstRateCalcMode = 'formulaBurst';
    this.customBurstRateInputVal = null;

    this.currentSelectedRecord = null;
    this.currentTimelineInterval = 30;
    this.top20TimelineInterval = 30;
    this.selectedSkills = new Set();

    this.isExtensionOpen = true;
    this.hideBuffsInMainTimeline = true;
    this.currentBurstTriggerSkill = '';
    this.burstWindowSeconds = 30;
    this.selectedBurstRound = 'ALL';

    this.isManualCutoffOverride = false;
    this.jobBurstStatsCache = new Map();
    this.top20SortKey = 'use';

    this.cacheDom();
    this.initBaselineJobSelect();
    this.restoreSavedData();
    this.bindEvents();
  }

  get recordsDb() {
    if (!this.seasonsDb.has(this.currentSeasonKey)) {
      this.seasonsDb.set(this.currentSeasonKey, {
        name: '5기 연무장',
        recordsMap: new Map()
      });
    }
    return this.seasonsDb.get(this.currentSeasonKey).recordsMap;
  }

  cacheDom() {
    this.apiKeyInput = document.getElementById('apiKeyInput');
    this.toggleKeyBtn = document.getElementById('toggleKeyBtn');
    this.loadAccountBtn = document.getElementById('loadAccountBtn');
    this.worldSelect = document.getElementById('worldSelect');
    this.maxLevelInput = document.getElementById('maxLevelInput');
    this.directCharInput = document.getElementById('directCharInput');
    this.directSearchBtn = document.getElementById('directSearchBtn');
    this.statusBadge = document.getElementById('statusBadge');

    this.charCountInfo = document.getElementById('charCountInfo');
    this.tabCharList = document.getElementById('tabCharList');
    this.tabJobSummary = document.getElementById('tabJobSummary');
    this.charListTable = document.getElementById('charListTable');
    this.jobSummaryTable = document.getElementById('jobSummaryTable');
    this.charListBody = document.getElementById('charListBody');
    this.jobSummaryBody = document.getElementById('jobSummaryBody');

    this.burstBaselineStatusText = document.getElementById('burstBaselineStatusText');
    this.baselineJobSelect = document.getElementById('baselineJobSelect');
    this.burstCutoffInput = document.getElementById('burstCutoffInput');
    this.omegaBaseInput = document.getElementById('omegaBaseInput');
    this.omegaBuffClassInput = document.getElementById('omegaBuffClassInput');
    this.filterOnlyMyAccountJobsChk = document.getElementById('filterOnlyMyAccountJobsChk');
    this.burstJobCountBadge = document.getElementById('burstJobCountBadge');
    this.sustainedJobCountBadge = document.getElementById('sustainedJobCountBadge');
    this.unclassifiedJobCountBadge = document.getElementById('unclassifiedJobCountBadge');
    this.burstJobsContainer = document.getElementById('burstJobsContainer');
    this.sustainedJobsContainer = document.getElementById('sustainedJobsContainer');
    this.unclassifiedJobsContainer = document.getElementById('unclassifiedJobsContainer');

    this.seasonSelect = document.getElementById('seasonSelect');
    this.addSeasonBtn = document.getElementById('addSeasonBtn');
    this.seasonPeriodBadge = document.getElementById('seasonPeriodBadge');
    this.toggleExtensionBtn = document.getElementById('toggleExtensionBtn');
    this.rightExtensionBox = document.getElementById('rightExtensionBox');

    this.rankJobFilter = document.getElementById('rankJobFilter');
    this.totalRecordBadge = document.getElementById('totalRecordBadge');

    this.chuchuRankView = document.getElementById('chuchuRankView');
    this.allRecordsView = document.getElementById('allRecordsView');
    this.top20SkillsView = document.getElementById('top20SkillsView');
    this.singleDetailView = document.getElementById('singleDetailView');
    this.chuchuRankBody = document.getElementById('chuchuRankBody');
    this.allRecordsBody = document.getElementById('allRecordsBody');
    this.top20SkillsBody = document.getElementById('top20SkillsBody');

    this.clearTop20SelectionBtn = document.getElementById('clearTop20SelectionBtn');
    this.top20BurstSaveBanner = document.getElementById('top20BurstSaveBanner');
    this.top20SelectedSummary = document.getElementById('top20SelectedSummary');
    this.top20TimelineIntervalSelect = document.getElementById('top20TimelineIntervalSelect');
    this.top20TimelineAccordionContainer = document.getElementById('top20TimelineAccordionContainer');

    this.modeChuchuRank = document.getElementById('modeChuchuRank');
    this.modeAllRecords = document.getElementById('modeAllRecords');
    this.modeTop20Skills = document.getElementById('modeTop20Skills');
    this.modeSingleDetail = document.getElementById('modeSingleDetail');

    this.cardCharJob = document.getElementById('cardCharJob');
    this.cardDps = document.getElementById('cardDps');
    this.cardCombatPower = document.getElementById('cardCombatPower');
    this.cardEfficiency = document.getElementById('cardEfficiency');
    this.detailRecordDateInfo = document.getElementById('detailRecordDateInfo');
    this.bpSkillTableBody = document.getElementById('bpSkillTableBody');

    this.hideBuffsInMainTimelineChk = document.getElementById('hideBuffsInMainTimelineChk');
    this.timelineIntervalSelect = document.getElementById('timelineIntervalSelect');
    this.timelineSkillDropdownBtn = document.getElementById('timelineSkillDropdownBtn');
    this.timelineSkillDropdownContent = document.getElementById('timelineSkillDropdownContent');
    this.timelineAccordionContainer = document.getElementById('timelineAccordionContainer');

    this.extTargetCharLabel = document.getElementById('extTargetCharLabel');
    this.buffCountBadge = document.getElementById('buffCountBadge');
    this.separatedBuffListContainer = document.getElementById('separatedBuffListContainer');

    this.skillDbCountBadge = document.getElementById('skillDbCountBadge');
    this.fetchApiSkillMetaBtn = document.getElementById('fetchApiSkillMetaBtn');
    this.skillDbCategoryFilter = document.getElementById('skillDbCategoryFilter');
    this.skillClassifierTableBody = document.getElementById('skillClassifierTableBody');

    this.burstTriggerSkillSelect = document.getElementById('burstTriggerSkillSelect');
    this.burstWindowSecInput = document.getElementById('burstWindowSecInput');
    this.burstRoundSelect = document.getElementById('burstRoundSelect');
    this.burstSummaryContainer = document.getElementById('burstSummaryContainer');
    this.extBurstSkillSaveLine = document.getElementById('extBurstSkillSaveLine');
    this.burstWindowsAccordionContainer = document.getElementById('burstWindowsAccordionContainer');

    this.calcJobPresetSelect = document.getElementById('calcJobPresetSelect');
    this.calcFullPInput = document.getElementById('calcFullPInput');
    this.calcBasePInput = document.getElementById('calcBasePInput');
    this.applyHeroCalibrationBtn = document.getElementById('applyHeroCalibrationBtn');
    this.calcBpSyncInfo = document.getElementById('calcBpSyncInfo');
    this.calcHexaRateBadge = document.getElementById('calcHexaRateBadge');
    this.calcFragTierButtons = document.getElementById('calcFragTierButtons');

    this.calcQ2Input = document.getElementById('calcQ2Input');
    this.calcT2Input = document.getElementById('calcT2Input');
    this.calcU2Output = document.getElementById('calcU2Output');
    this.calcR2Output = document.getElementById('calcR2Output');
    this.calcS2Output = document.getElementById('calcS2Output');

    this.calcQ3Input = document.getElementById('calcQ3Input');
    this.calcU3Output = document.getElementById('calcU3Output');
    this.calcR3Output = document.getElementById('calcR3Output');
    this.calcS3Output = document.getElementById('calcS3Output');

    this.calcCharCpManInput = document.getElementById('calcCharCpManInput');
    this.calcCharCpKoreanLabel = document.getElementById('calcCharCpKoreanLabel');
    this.calcForceMultInput = document.getElementById('calcForceMultInput');
    this.calcBossHpJoInput = document.getElementById('calcBossHpJoInput');
    this.calcRealFactorInput = document.getElementById('calcRealFactorInput');

    this.calcRealBossDpsOutput = document.getElementById('calcRealBossDpsOutput');
    this.calcPureBossDpsOutput = document.getElementById('calcPureBossDpsOutput');
    this.calcClearTimeOutput = document.getElementById('calcClearTimeOutput');
    this.calc18MinTotalOutput = document.getElementById('calc18MinTotalOutput');
  }

  initBaselineJobSelect() {
    if (!this.baselineJobSelect) return;
    const sortedJobs = ['렌', ...MASTER_JOB_LIST.filter(j => j !== '렌')];
    this.baselineJobSelect.innerHTML =
      `<option value="FIXED_50" selected>50% 표준 기준 (극딜 50% 이상)</option>` +
      sortedJobs.map(j => `<option value="${j}">${j}${j === '렌' ? ' (기점 연동)' : ''}</option>`).join('');
  }

  getCurrentActiveJobName() {
    const filterVal = this.rankJobFilter ? this.rankJobFilter.value : 'ALL';
    if (filterVal && filterVal !== 'ALL') {
      return Utils.getCanonicalJobName(filterVal);
    }
    if (this.currentSelectedRecord && this.currentSelectedRecord.job) {
      return Utils.getCanonicalJobName(this.currentSelectedRecord.job);
    }
    return '';
  }

  restoreSavedBurstSkillsForJob(jobName) {
    const canonical = Utils.getCanonicalJobName(jobName);
    const saved = this.savedJobBurstProfiles[canonical];
    if (saved && Array.isArray(saved.skills) && saved.skills.length > 0) {
      this.selectedSkills = new Set(saved.skills);
      this.customBurstRateInputVal = saved.burstRate;
      if (saved.metricMode) this.burstRateCalcMode = saved.metricMode;
      return true;
    }
    this.customBurstRateInputVal = null;
    return false;
  }

  evaluateBurstAttributionFormula(rec, customTriggerName = '', customWindowSec = null) {
    if (!rec || !Array.isArray(rec.skills) || rec.skills.length === 0) {
      return {
        totalBurstShare: 0,
        pureActiveBurstSum: 0,
        isBuffCentricClass: false,
        triggerName: '',
        windows: [],
        skillBreakdown: new Map()
      };
    }

    const windowSec = customWindowSec || this.burstWindowSeconds || 30;
    const rawOmegaBase = Number(this.omegaBaseInput?.value) || 1.75;
    const rawOmegaBuff = Number(this.omegaBuffClassInput?.value) || 2.75;

    const cacheKey = `${rec.replayId}_${customTriggerName}_${windowSec}_${rawOmegaBase}_${rawOmegaBuff}`;
    if (rec._burstCacheKey === cacheKey && rec._burstCacheResult) {
      return rec._burstCacheResult;
    }

    const skills = rec.skills;
    const timelines = Array.isArray(rec.timeline) ? rec.timeline : [];
    const { timelineCountMap } = this.classifySkillsOfRecord(rec);

    let triggerName = customTriggerName;
    if (!triggerName || !timelineCountMap.has(triggerName)) {
      for (const sName of timelineCountMap.keys()) {
        if (sName.includes('리스트레인트')) { triggerName = sName; break; }
      }
    }
    if (!triggerName || !timelineCountMap.has(triggerName)) {
      for (const sName of timelineCountMap.keys()) {
        if (SEEDRING_KEYWORDS.some(kw => sName.includes(kw))) { triggerName = sName; break; }
      }
    }
    if (!triggerName || !timelineCountMap.has(triggerName)) {
      for (const sName of timelineCountMap.keys()) {
        if (KNOWN_BUFF_KEYWORDS.some(kw => sName.includes(kw))) { triggerName = sName; break; }
      }
    }

    const preBufferMs = 3000;
    const windowMs = windowSec * 1000;
    const distinctWindows = [];

    if (triggerName && timelineCountMap.has(triggerName)) {
      const rawTimes = timelines
        .filter(t => t && t.skill_name === triggerName)
        .map(t => Number(t.elapse_time) || 0)
        .sort((a, b) => a - b);

      const debounceMs = Math.max(15000, Math.floor(windowMs * 0.8));
      const triggerTimes = [];
      rawTimes.forEach(ms => {
        if (triggerTimes.length === 0 || ms - triggerTimes[triggerTimes.length - 1] > debounceMs) {
          triggerTimes.push(ms);
        }
      });

      triggerTimes.forEach((tMs, idx) => {
        let startMs = Math.max(0, tMs - preBufferMs);
        let endMs = startMs + windowMs;
        if (endMs > 360000) {
          endMs = 360000;
          startMs = Math.max(0, endMs - windowMs);
        }
        distinctWindows.push({
          round: String(idx + 1),
          triggerMs: tMs,
          startMs,
          endMs,
          startSecStr: (startMs / 1000).toFixed(1),
          endSecStr: (endMs / 1000).toFixed(1)
        });
      });
    }

    if (distinctWindows.length === 0) {
      [0, 120000, 240000].forEach((startMs, idx) => {
        distinctWindows.push({
          round: String(idx + 1),
          triggerMs: startMs,
          startMs,
          endMs: startMs + windowMs,
          startSecStr: (startMs / 1000).toFixed(1),
          endSecStr: ((startMs + windowMs) / 1000).toFixed(1)
        });
      });
    }

    const count30Map = new Map();
    const count90Map = new Map();

    for (let i = 0; i < timelines.length; i++) {
      const t = timelines[i];
      if (!t || !t.skill_name) continue;
      const ms = Number(t.elapse_time) || 0;
      let inBurst = false;
      for (let j = 0; j < distinctWindows.length; j++) {
        if (ms >= distinctWindows[j].startMs && ms <= distinctWindows[j].endMs) {
          inBurst = true;
          break;
        }
      }
      if (inBurst) count30Map.set(t.skill_name, (count30Map.get(t.skill_name) || 0) + 1);
      else count90Map.set(t.skill_name, (count90Map.get(t.skill_name) || 0) + 1);
    }

    let pureActiveBurstSum = 0;
    skills.forEach(s => {
      if (!s || !s.name) return;
      const D_i = Number(s.rate) || 0;
      if (D_i <= 0) return;
      const cat = this.getSkillCategory(s.name, rec);
      if (cat === '소환' || cat === '설치') return;

      const n30 = count30Map.get(s.name) || 0;
      const n90 = count90Map.get(s.name) || 0;
      const nTotal = n30 + n90;
      if (nTotal > 0 && (n30 / nTotal) >= 0.85) {
        pureActiveBurstSum += D_i;
      }
    });
    pureActiveBurstSum = Number(pureActiveBurstSum.toFixed(1));
    const isBuffCentricClass = pureActiveBurstSum < 25.0;

    const skillBreakdown = new Map();
    let totalBurstShare = 0;
    const sustainedSec = Math.max(10, 120 - windowSec);

    skills.forEach(s => {
      if (!s || !s.name) return;
      const D_i = Number(s.rate) || 0;
      const n30 = count30Map.get(s.name) || 0;
      const n90 = count90Map.get(s.name) || 0;
      const nTotal = n30 + n90;
      const cat = this.getSkillCategory(s.name, rec);

      let omega = rawOmegaBase;
      let formulaType = 'active';
      let D_i_30 = 0;

      if (nTotal === 0 || cat === '소환' || cat === '설치') {
        formulaType = 'passive_time';
        omega = isBuffCentricClass ? rawOmegaBuff : rawOmegaBase;
        D_i_30 = D_i * ((windowSec * omega) / ((windowSec * omega) + sustainedSec));
      } else {
        const isMainContinuousAttack = (n90 / nTotal) >= 0.35;
        omega = (isBuffCentricClass && isMainContinuousAttack) ? rawOmegaBuff : rawOmegaBase;
        D_i_30 = D_i * ((n30 * omega) / ((n30 * omega) + n90));
      }

      D_i_30 = Number(D_i_30.toFixed(2));
      totalBurstShare += D_i_30;

      skillBreakdown.set(s.name, {
        name: s.name,
        D_i,
        n30,
        n90,
        omega,
        formulaType,
        D_i_30
      });
    });

    totalBurstShare = Math.min(100, Number(totalBurstShare.toFixed(1)));

    const resultObj = {
      totalBurstShare,
      pureActiveBurstSum,
      isBuffCentricClass,
      triggerName: triggerName || '120초 기본주기',
      windows: distinctWindows,
      skillBreakdown
    };

    rec._burstCacheKey = cacheKey;
    rec._burstCacheResult = resultObj;
    return resultObj;
  }

  computeSelectedSkillsBurstMetrics(jobName) {
    const canonical = Utils.getCanonicalJobName(jobName);
    const allRecs = Array.from(this.recordsDb.values());
    const jobRecs = canonical
      ? allRecs.filter(r => Utils.isSameJob(r.job, canonical))
      : (this.currentSelectedRecord ? [this.currentSelectedRecord] : []);

    const selectedArr = Array.from(this.selectedSkills);

    if (jobRecs.length === 0) {
      return {
        formulaBurstAll: 0,
        formulaBurstSelected: 0,
        firstBucketRate: 0,
        totalDamageShare: 0,
        activeRate: this.customBurstRateInputVal !== null ? Number(this.customBurstRateInputVal) : 0
      };
    }

    let sumFormulaAll = 0;
    let sumFormulaSelected = 0;
    let validFormulaCnt = 0;

    jobRecs.forEach(r => {
      const res = this.evaluateBurstAttributionFormula(r);
      if (res.skillBreakdown.size > 0) {
        validFormulaCnt++;
        sumFormulaAll += res.totalBurstShare;
        if (selectedArr.length > 0) {
          let selSum = 0;
          selectedArr.forEach(sName => {
            const item = res.skillBreakdown.get(sName);
            if (item) selSum += item.D_i_30;
          });
          sumFormulaSelected += selSum;
        } else {
          sumFormulaSelected += res.totalBurstShare;
        }
      }
    });

    const formulaBurstAll = validFormulaCnt > 0 ? Number((sumFormulaAll / validFormulaCnt).toFixed(1)) : 0;
    const formulaBurstSelected = validFormulaCnt > 0 ? Number((sumFormulaSelected / validFormulaCnt).toFixed(1)) : 0;

    const skillRateMap = new Map();
    jobRecs.forEach(r => {
      (r.skills || []).forEach(s => {
        if (!s || !s.name) return;
        if (!skillRateMap.has(s.name)) skillRateMap.set(s.name, { sumRate: 0, cnt: 0 });
        const o = skillRateMap.get(s.name);
        o.sumRate += Number(s.rate) || 0;
        o.cnt += 1;
      });
    });

    let totalDamageShare = 0;
    selectedArr.forEach(sName => {
      const o = skillRateMap.get(sName);
      if (o && o.cnt > 0) totalDamageShare += (o.sumRate / o.cnt);
    });
    totalDamageShare = Number(totalDamageShare.toFixed(1));

    const intervalMs = (this.top20TimelineInterval || 30) * 1000;
    let firstBucketTotal = 0, firstBucketSelected = 0;
    jobRecs.forEach(r => {
      (r.timeline || []).forEach(t => {
        if (!t) return;
        const ms = Number(t.elapse_time) || 0;
        if (ms >= 0 && ms < intervalMs) {
          firstBucketTotal += 1;
          if (this.selectedSkills.has(t.skill_name)) firstBucketSelected += 1;
        }
      });
    });
    const firstBucketRate = firstBucketTotal > 0 ? Number(((firstBucketSelected / firstBucketTotal) * 100).toFixed(1)) : 0;

    let activeRate = formulaBurstSelected;
    if (this.customBurstRateInputVal !== null) {
      activeRate = Number(this.customBurstRateInputVal);
    } else if (this.burstRateCalcMode === 'formulaBurst') {
      activeRate = selectedArr.length > 0 ? formulaBurstSelected : formulaBurstAll;
    } else if (this.burstRateCalcMode === 'firstBucket') {
      activeRate = firstBucketRate;
    } else if (this.burstRateCalcMode === 'totalShare') {
      activeRate = totalDamageShare;
    }

    return {
      formulaBurstAll,
      formulaBurstSelected,
      firstBucketRate,
      totalDamageShare,
      activeRate: Number((Number(activeRate) || 0).toFixed(1))
    };
  }

  renderBurstSkillSaveBanners() {
    const activeJob = this.getCurrentActiveJobName();
    const selectedArr = Array.from(this.selectedSkills);
    const savedProfile = activeJob ? this.savedJobBurstProfiles[activeJob] : null;
    const metrics = this.computeSelectedSkillsBurstMetrics(activeJob);

    const displayRate = metrics.activeRate;
    const activeCutoff = Number(this.burstCutoffInput?.value) || 50.0;
    const isBurstRole = displayRate >= activeCutoff;

    const skillTagsHtml = selectedArr.length > 0
      ? selectedArr.map(sName => `<span class="saved-skill-tag">${sName}</span>`).join('')
      : `<span style="color:#a0aec0;">미선택 시 전체 30초 극딜 합계(${metrics.formulaBurstAll}%)가 적용되며, 특정 스킬들을 클릭해 선택하면 선택 스킬 합산치로 저장할 수 있습니다.</span>`;

    const savedStatusBadge = savedProfile
      ? `<span style="background:#2f855a; color:#fff; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold;">💾 ${activeJob} 저장됨 (${savedProfile.burstRate}%)</span>`
      : `<span style="background:#2d3748; color:#cbd5e0; padding:2px 6px; border-radius:4px; font-size:10px;">자동 공식 적용 중</span>`;

    const buildBannerHtml = (prefixId) => `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 6px;">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <strong style="color: #fff; font-size: 12px;">
            🎯 스킬 선택 (<span style="color: #63b3ed;">${selectedArr.length}개</span>)
          </strong>
          <div style="display: inline-flex; align-items: center; gap: 4px; background: #141821; border: 1px solid #f6ad55; padding: 2px 8px; border-radius: 6px;">
            <strong style="color: #fbd38d; font-size: 12px;">[극딜 딜량</strong>
            <input type="number" class="sync-burst-rate-input" id="${prefixId}_rateInput" value="${displayRate}" step="0.1" min="0" max="100" style="width: 54px; text-align: right; font-weight: bold; font-size: 12px; color: #fbd38d; background: transparent; border: none; border-bottom: 1px dashed #f6ad55;" />
            <strong style="color: #fbd38d; font-size: 12px;">%]</strong>
          </div>
          <span style="font-size: 11px; font-weight: bold; color: ${isBurstRole ? '#fc8181' : '#63b3ed'};">
            ${isBurstRole ? `🔥극딜(≥${activeCutoff}%)` : `🔄평딜(&lt;${activeCutoff}%)`}
          </span>
          ${savedStatusBadge}
        </div>

        <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
          <button type="button" class="burst-metric-chip ${this.burstRateCalcMode === 'formulaBurst' && this.customBurstRateInputVal === null ? 'active-chip' : ''}" data-mode="formulaBurst" title="30초 극딜 구간(-3초~+27초) 귀속 딜량 합산">
            30초극딜귀속(${selectedArr.length > 0 ? metrics.formulaBurstSelected : metrics.formulaBurstAll}%)
          </button>
          <button type="button" class="burst-metric-chip ${this.burstRateCalcMode === 'firstBucket' && this.customBurstRateInputVal === null ? 'active-chip' : ''}" data-mode="firstBucket" title="타임라인 첫 구간(0~30초) 선택 스킬 시전 비율">
            0~30초시전(${metrics.firstBucketRate}%)
          </button>
          <button type="button" class="burst-metric-chip ${this.burstRateCalcMode === 'totalShare' && this.customBurstRateInputVal === null ? 'active-chip' : ''}" data-mode="totalShare" title="선택 스킬들의 전체 딜 점유율 단순 합산">
            전체점유합(${metrics.totalDamageShare}%)
          </button>
          <button type="button" class="btn-primary save-job-burst-btn" style="padding: 4px 10px; font-size: 11px; font-weight: bold;">
            💾 ${activeJob || '현재 직업'} 극딜 저장
          </button>
          ${savedProfile ? `<button type="button" class="btn-sub delete-job-burst-btn" style="padding: 4px 7px; font-size: 10px; color: #feb2b2;">초기화</button>` : ''}
        </div>
      </div>

      <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 5px; line-height: 1.5;">
        <span style="color: #cbd5e0; font-weight: bold; margin-right: 6px;">📋 사용한 스킬 목록 (${selectedArr.length}개):</span>
        ${skillTagsHtml}
      </div>
    `;

    const bindBannerEvents = (container) => {
      if (!container) return;

      const rateInp = container.querySelector('.sync-burst-rate-input');
      if (rateInp) {
        rateInp.addEventListener('input', (e) => {
          this.customBurstRateInputVal = Number(e.target.value) || 0;
          document.querySelectorAll('.sync-burst-rate-input').forEach(other => {
            if (other !== e.target) other.value = e.target.value;
          });
        });
      }

      container.querySelectorAll('.burst-metric-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          this.burstRateCalcMode = chip.dataset.mode;
          this.customBurstRateInputVal = null;
          this.renderBurstSkillSaveBanners();
        });
      });

      const saveBtn = container.querySelector('.save-job-burst-btn');
      if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
          const targetJob = this.getCurrentActiveJobName();
          if (!targetJob) {
            return this.setStatus('먼저 저장할 직업을 상단 [직업 선택]에서 고르거나 캐릭터를 클릭해주세요!', true);
          }
          const currentInput = container.querySelector('.sync-burst-rate-input');
          const finalRate = currentInput ? Number(Number(currentInput.value).toFixed(1)) : displayRate;
          const skillsArray = Array.from(this.selectedSkills);

          this.savedJobBurstProfiles[targetJob] = {
            job: targetJob,
            burstRate: finalRate,
            skills: skillsArray,
            metricMode: this.burstRateCalcMode,
            updatedAt: new Date().toISOString()
          };

          if (targetJob === (this.baselineJobSelect?.value || '')) {
            this.isManualCutoffOverride = false;
          }

          await this.saveRecordsToDisk();
          this.updateJobBurstRoleClassifier();
          this.updateChuchuRankTable();
          this.renderFilteredCharacters();
          this.renderBurstSkillSaveBanners();

          this.setStatus(`💾 [${targetJob}] 극딜 지표 저장 완료! — 스킬 선택 (${skillsArray.length}개) [극딜 딜량 ${finalRate}%]`);
        });
      }

      const delBtn = container.querySelector('.delete-job-burst-btn');
      if (delBtn) {
        delBtn.addEventListener('click', async () => {
          const targetJob = this.getCurrentActiveJobName();
          if (!targetJob || !this.savedJobBurstProfiles[targetJob]) return;
          delete this.savedJobBurstProfiles[targetJob];
          this.customBurstRateInputVal = null;
          await this.saveRecordsToDisk();
          this.updateJobBurstRoleClassifier();
          this.updateChuchuRankTable();
          this.renderFilteredCharacters();
          this.renderBurstSkillSaveBanners();
          this.setStatus(`[${targetJob}]의 저장된 극딜 지표가 자동 공식 모드로 초기화되었습니다.`);
        });
      }
    };

    if (this.extBurstSkillSaveLine) {
      this.extBurstSkillSaveLine.innerHTML = buildBannerHtml('ext');
      bindBannerEvents(this.extBurstSkillSaveLine);
    }
    if (this.top20BurstSaveBanner) {
      this.top20BurstSaveBanner.innerHTML = buildBannerHtml('top20');
      bindBannerEvents(this.top20BurstSaveBanner);
    }
  }

  updateJobBurstRoleClassifier() {
    if (!this.burstJobsContainer || !this.sustainedJobsContainer || !this.unclassifiedJobsContainer) return;

    const allRecs = Array.from(this.recordsDb.values());
    const myOwnedJobs = new Set();
    (this.filteredCharacters || []).forEach(ch => {
      if (ch.character_class) {
        myOwnedJobs.add(ch.character_class);
        (JOB_NAME_ALIASES[ch.character_class] || []).forEach(a => myOwnedJobs.add(a));
      }
    });

    const jobSet = new Set(MASTER_JOB_LIST);
    allRecs.forEach(r => {
      if (r && r.job && !JOB_NAME_ALIASES[r.job]) jobSet.add(r.job);
    });

    this.jobBurstStatsCache.clear();

    for (const jobName of jobSet) {
      const canonical = Utils.getCanonicalJobName(jobName);
      const savedProfile = this.savedJobBurstProfiles[canonical];
      const jobRecs = allRecs.filter(r => r && Utils.isSameJob(r.job, jobName));

      let finalBurstRate = null;
      let isManualSaved = false;
      let isBuffCentric = false;
      let pureBurstSum = 0;
      let savedSkills = [];

      if (savedProfile && typeof savedProfile.burstRate === 'number') {
        finalBurstRate = savedProfile.burstRate;
        isManualSaved = true;
        savedSkills = savedProfile.skills || [];
      } else if (jobRecs.length > 0) {
        const rates = [];
        let buffCentricVotes = 0;
        let pSum = 0;
        jobRecs.forEach(r => {
          const evalRes = this.evaluateBurstAttributionFormula(r);
          if (evalRes.totalBurstShare > 0) {
            rates.push(evalRes.totalBurstShare);
            pSum += evalRes.pureActiveBurstSum;
            if (evalRes.isBuffCentricClass) buffCentricVotes++;
          }
        });
        if (rates.length > 0) {
          finalBurstRate = Number((rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(1));
          isBuffCentric = buffCentricVotes >= Math.ceil(rates.length / 2);
          pureBurstSum = Number((pSum / rates.length).toFixed(1));
        }
      }

      this.jobBurstStatsCache.set(jobName, {
        job: jobName,
        recordCount: jobRecs.length,
        avgBurstRate: finalBurstRate,
        isManualSaved,
        isBuffCentric,
        pureBurstSum,
        savedSkills,
        isOwned: myOwnedJobs.has(jobName)
      });
    }

    const baseMode = this.baselineJobSelect ? this.baselineJobSelect.value : 'FIXED_50';
    let activeCutoff = Number(this.burstCutoffInput?.value) || 50.0;

    if (baseMode === 'FIXED_50' && !this.isManualCutoffOverride) {
      activeCutoff = 50.0;
      if (this.burstCutoffInput) this.burstCutoffInput.value = 50.0;
    } else if (baseMode !== 'FIXED_50') {
      const baseJobStat = this.jobBurstStatsCache.get(baseMode);
      if (baseJobStat && baseJobStat.avgBurstRate !== null && !this.isManualCutoffOverride) {
        activeCutoff = baseJobStat.avgBurstRate;
        if (this.burstCutoffInput) this.burstCutoffInput.value = activeCutoff;
      }
    }

    if (this.burstBaselineStatusText) {
      const omegaB = Number(this.omegaBaseInput?.value) || 1.75;
      const omegaC = Number(this.omegaBuffClassInput?.value) || 2.75;
      this.burstBaselineStatusText.innerHTML =
        `극딜 30초(-3~+27초) | 기본배율=${omegaB}, 버프형배율=${omegaC} | 판정선: <strong>${activeCutoff}%</strong>`;
    }

    const onlyMyJobs = Boolean(this.filterOnlyMyAccountJobsChk?.checked);
    const burstJobs = [], sustainedJobs = [], unclassifiedJobs = [];

    for (const stat of this.jobBurstStatsCache.values()) {
      if (onlyMyJobs && !stat.isOwned) continue;
      if (stat.avgBurstRate === null) unclassifiedJobs.push(stat);
      else if (stat.avgBurstRate >= activeCutoff) burstJobs.push(stat);
      else sustainedJobs.push(stat);
    }

    burstJobs.sort((a, b) => b.avgBurstRate - a.avgBurstRate);
    sustainedJobs.sort((a, b) => b.avgBurstRate - a.avgBurstRate);
    unclassifiedJobs.sort((a, b) => (b.isOwned ? 1 : 0) - (a.isOwned ? 1 : 0) || a.job.localeCompare(b.job));

    if (this.burstJobCountBadge) this.burstJobCountBadge.textContent = `${burstJobs.length}개 직업`;
    if (this.sustainedJobCountBadge) this.sustainedJobCountBadge.textContent = `${sustainedJobs.length}개 직업`;
    if (this.unclassifiedJobCountBadge) this.unclassifiedJobCountBadge.textContent = `${unclassifiedJobs.length}개 직업`;

    const renderPills = (arr, isUnclassified = false) => {
      if (arr.length === 0) return `<div class="empty-msg" style="padding: 4px; font-size: 11px;">해당 직업 없음</div>`;
      return arr.map(item => {
        const classes = ['job-role-pill', item.isOwned ? 'owned-job-pill' : ''].filter(Boolean).join(' ');
        const savedIcon = item.isManualSaved ? `<span title="수동 저장됨">💾</span>` : (item.isBuffCentric ? `<span title="버프형 5차 주력기 상향 배율 자동 적용됨">⚡</span>` : '');
        const rateText = isUnclassified
          ? `<span style="color:#718096; font-size:10px;">미수집</span>`
          : `<span style="color:${item.avgBurstRate >= activeCutoff ? '#feb2b2' : '#90cdf4'}; font-weight:bold;">${item.avgBurstRate}%</span>`;
        const ownedBadge = item.isOwned ? `<span style="color:#68d391; font-size:9px;">★보유</span>` : '';

        const tooltipText = item.isManualSaved
          ? `[${item.job}] 수동 저장된 극딜 비중: ${item.avgBurstRate}%\n선택 스킬(${item.savedSkills.length}개): ${item.savedSkills.join(', ')}`
          : `[${item.job}] 30초 극딜 귀속 비중: ${item.avgBurstRate ?? '-'}%\n순수 액티브 극딜기 합: ${item.pureBurstSum}% (${item.isBuffCentric ? '버프형 5차 주력기 상향 배율 적용' : '기본 배율 적용'})`;

        return `
          <div class="${classes}" data-role-job="${item.job}" title="${tooltipText.replace(/"/g, '&quot;')}">
            ${savedIcon}
            <span>${item.job}</span>
            ${rateText}
            ${ownedBadge}
          </div>
        `;
      }).join('');
    };

    this.burstJobsContainer.innerHTML = renderPills(burstJobs, false);
    this.sustainedJobsContainer.innerHTML = renderPills(sustainedJobs, false);
    this.unclassifiedJobsContainer.innerHTML = renderPills(unclassifiedJobs, true);

    [this.burstJobsContainer, this.sustainedJobsContainer, this.unclassifiedJobsContainer].forEach(container => {
      container.querySelectorAll('.job-role-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          this.selectJobFromLeftPanel(pill.dataset.roleJob, true);
        });
      });
    });
  }

  async loadAccountCharacterHexaToQ3(charName, charJob, charLv) {
    this.selectJobFromLeftPanel(charJob, false);

    if (charLv < 260) {
      if (this.calcQ3Input) this.calcQ3Input.value = 0;
      this.recalculateDamageEstimator();
      this.setStatus(`'${charName}' (${charJob} Lv.${charLv}) 선택됨 — 260Lv 미만으로 6차 조각 0개 적용`);
      return;
    }

    if (!this.ensureApi()) return;

    try {
      this.setStatus(`'${charName}' (${charJob} Lv.${charLv})의 6차 조각 사용량 및 전투력 불러오는 중...`);
      const { ocid } = await this.api.getOcid(charName);
      const [hexaData, statData] = await Promise.all([
        this.api.getCharacterHexaMatrix(ocid).catch(() => null),
        this.api.getCharacterStat(ocid).catch(() => null)
      ]);

      const { combatFragments, summaryText } = Utils.calculateHexaFragmentsFromApi(hexaData);
      let myCombatPower = 0;
      const cpObj = (statData?.final_stat || []).find(s => s.stat_name === '전투력');
      if (cpObj) myCombatPower = Number(cpObj.stat_value) || 0;

      if (this.calcQ3Input) this.calcQ3Input.value = combatFragments;
      if (myCombatPower > 0 && this.calcCharCpManInput) {
        this.calcCharCpManInput.value = Math.round(myCombatPower / 10000);
      }

      this.recalculateDamageEstimator();
      if (this.calcBpSyncInfo) {
        const cpStr = myCombatPower > 0 ? Utils.formatKoreanNumber(myCombatPower) : '미확인';
        this.calcBpSyncInfo.innerHTML =
          `👤 <strong>내 캐릭터 [${charName} (${charJob} Lv.${charLv})] 조각 & 전투력 반영 완료!</strong><br/>` +
          `입장 전투력: <strong style="color:#63b3ed;">${cpStr}</strong> | 보스 유효 조각: <strong style="color:#fbd38d;">${combatFragments.toLocaleString()}개</strong> (${summaryText})`;
      }

      this.setStatus(`'${charName}' 에르다 조각 사용량 반영 완료! (${combatFragments.toLocaleString()}개)`);
    } catch (err) {
      this.setStatus(`'${charName}' 조각 조회 실패: ${err.message}`, true);
    }
  }

  selectJobFromLeftPanel(rawJobName, overwriteCalcWithRanker = true) {
    if (!rawJobName) return;

    const allRecs = Array.from(this.recordsDb.values());
    const matchedRecords = allRecs.filter(r => r && Utils.isSameJob(r.job, rawJobName));
    const dbJobName = matchedRecords.length > 0 ? matchedRecords[0].job : rawJobName;

    const restored = this.restoreSavedBurstSkillsForJob(dbJobName);
    if (!restored) this.selectedSkills.clear();

    if (this.rankJobFilter) {
      const hasOption = Array.from(this.rankJobFilter.options).some(opt => opt.value === dbJobName);
      if (!hasOption) {
        const tempOpt = document.createElement('option');
        tempOpt.value = dbJobName;
        tempOpt.textContent = `${dbJobName} (기록 0건)`;
        this.rankJobFilter.appendChild(tempOpt);
      }
      this.rankJobFilter.value = dbJobName;
    }

    this.updateChuchuRankTable();
    this.updateAllRecordsTable();
    this.updateTop20SkillsTable();

    const calcAliases = JOB_NAME_ALIASES[rawJobName] || [rawJobName];
    const matchedCalcJob = calcAliases.find(name => HEXA_FRAGMENT_TABLE[name]) || rawJobName;
    if (this.calcJobPresetSelect && HEXA_FRAGMENT_TABLE[matchedCalcJob]) {
      this.calcJobPresetSelect.value = matchedCalcJob;
      this.syncCalculatorWithJobAndBp(matchedCalcJob);
    }

    if (matchedRecords.length > 0) {
      matchedRecords.sort((a, b) => b.dps - a.dps);
      const bestRecord = matchedRecords[0];
      this.currentSelectedRecord = bestRecord;

      if (this.cardCharJob) this.cardCharJob.textContent = `${bestRecord.charName} (${bestRecord.job} Lv.${bestRecord.level})`;
      if (this.cardDps) this.cardDps.textContent = Utils.formatKoreanNumber(bestRecord.dps);
      if (this.cardCombatPower) this.cardCombatPower.textContent = bestRecord.combatPower > 0 ? Utils.formatKoreanNumber(bestRecord.combatPower) : '-';
      if (this.cardEfficiency) this.cardEfficiency.textContent = bestRecord.efficiency > 0 ? bestRecord.efficiency.toLocaleString() : '-';
      if (this.detailRecordDateInfo) {
        const sName = this.seasonsDb.get(this.currentSeasonKey)?.name || '';
        this.detailRecordDateInfo.textContent = `${sName} | 기록일: ${Utils.formatShortDate(bestRecord.recordDate || bestRecord.collectedAt)}`;
      }

      if (overwriteCalcWithRanker) {
        if (bestRecord.combatPower > 0 && this.calcCharCpManInput) {
          this.calcCharCpManInput.value = Math.round(bestRecord.combatPower / 10000);
        }
        if (bestRecord.usedFragments > 0 && this.calcQ3Input) {
          this.calcQ3Input.value = bestRecord.usedFragments;
        }
      }

      this.renderDetailSkillsTable(bestRecord);
      this.buildTimelineSkillCheckboxes(bestRecord);
      this.renderTimelineSection(bestRecord);
      this.setupRightExtensionPanel(bestRecord);
      this.recalculateDamageEstimator();
      this.renderBurstSkillSaveBanners();
    } else {
      this.renderBurstSkillSaveBanners();
    }
  }

  getJobBattlePracticeStats(jobName) {
    const allRecs = Array.from(this.recordsDb.values());
    const matched = allRecs.filter(r => r && Utils.isSameJob(r.job, jobName) && r.efficiency > 0);
    if (matched.length === 0) return { count: 0, avgEff: 0, avgDps: 0, avgCp: 0 };
    const sumEff = matched.reduce((acc, cur) => acc + (cur.efficiency || 0), 0);
    const sumDps = matched.reduce((acc, cur) => acc + (cur.dps || 0), 0);
    const sumCp = matched.reduce((acc, cur) => acc + (cur.combatPower || 0), 0);
    const cnt = matched.length;
    const avgDps = Math.round(sumDps / cnt);
    const avgCp = Math.round(sumCp / cnt);
    const avgEff = avgCp > 0 ? Math.round(avgDps / avgCp) : Math.round(sumEff / cnt);
    return { count: cnt, avgEff, avgDps, avgCp };
  }

  getInterpolatedHexaRate(jobName, fragCount) {
    const aliases = JOB_NAME_ALIASES[jobName] || [jobName];
    const matchedKey = aliases.find(k => HEXA_FRAGMENT_TABLE[k]) || '히어로';
    const tiers = HEXA_FRAGMENT_TABLE[matchedKey];
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
    if (q <= 0) return { currentRate: rateAtZero, zeroRate: rateAtZero, tiers };
    if (q >= 44000) return { currentRate: 100.0, zeroRate: rateAtZero, tiers };

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i], p2 = points[i + 1];
      if (q >= p1.frag && q <= p2.frag) {
        const ratio = (q - p1.frag) / Math.max(1, (p2.frag - p1.frag));
        return {
          currentRate: Number((p1.rate + ratio * (p2.rate - p1.rate)).toFixed(2)),
          zeroRate: rateAtZero,
          tiers
        };
      }
    }
    return { currentRate: t40k[0], zeroRate: rateAtZero, tiers };
  }

  initDamageCalculatorPresets() {
    if (!this.calcJobPresetSelect) return;
    const jobNames = Object.keys(HEXA_FRAGMENT_TABLE);
    this.calcJobPresetSelect.innerHTML = jobNames.map(jName => {
      const bpStats = this.getJobBattlePracticeStats(jName);
      const bpTag = bpStats.count > 0 ? ` [연무장 ${bpStats.count}건: 효율 ${bpStats.avgEff.toLocaleString()}]` : '';
      return `<option value="${jName}">${jName}${bpTag}</option>`;
    }).join('');

    const defaultJob = this.currentSelectedRecord?.job && HEXA_FRAGMENT_TABLE[this.currentSelectedRecord.job]
      ? this.currentSelectedRecord.job
      : '히어로';

    this.calcJobPresetSelect.value = defaultJob;
    this.syncCalculatorWithJobAndBp(defaultJob);
  }

  applyHeroMainCalibration() {
    if (this.calcJobPresetSelect) this.calcJobPresetSelect.value = '히어로';
    if (this.calcFullPInput) this.calcFullPInput.value = HERO_CALIBRATED_FULL_INDEX;
    const { zeroRate } = this.getInterpolatedHexaRate('히어로', 0);
    if (this.calcBasePInput) this.calcBasePInput.value = Number((HERO_CALIBRATED_FULL_INDEX * (zeroRate / 100)).toFixed(1));
    if (this.calcQ3Input) this.calcQ3Input.value = 5656;
    if (this.calcCharCpManInput) this.calcCharCpManInput.value = 10650;
    if (this.calcForceMultInput) this.calcForceMultInput.value = 132;
    if (this.calcBossHpJoInput) this.calcBossHpJoInput.value = 779;
    if (this.calcRealFactorInput) this.calcRealFactorInput.value = 0.70;

    this.syncCalculatorWithJobAndBp('히어로', true);
    this.setStatus('본캐 히어로(1억 650만 / 조각 5,656개 / 포스 132% / 779조 18분 클리어) 역산 기준점이 적용되었습니다!');
  }

  syncCalculatorWithJobAndBp(jobName, keepManualFullP = false) {
    const bpStats = this.getJobBattlePracticeStats(jobName);
    const { zeroRate, tiers } = this.getInterpolatedHexaRate(jobName, 0);

    let fullIndexP = HERO_CALIBRATED_FULL_INDEX;
    if (!keepManualFullP) {
      if (jobName === '히어로') {
        fullIndexP = HERO_CALIBRATED_FULL_INDEX;
      } else if (bpStats.count > 0 && bpStats.avgEff > 0) {
        const heroStats = this.getJobBattlePracticeStats('히어로');
        if (heroStats.count > 0 && heroStats.avgEff > 0) {
          fullIndexP = Number((HERO_CALIBRATED_FULL_INDEX * (bpStats.avgEff / heroStats.avgEff)).toFixed(1));
        } else {
          fullIndexP = Number((bpStats.avgEff / BP_EFF_TO_INDEX_DIVISOR).toFixed(1));
        }
      }
      if (this.calcFullPInput) this.calcFullPInput.value = fullIndexP;
    } else {
      fullIndexP = Number(this.calcFullPInput?.value) || HERO_CALIBRATED_FULL_INDEX;
    }

    const baseIndexP = Number((fullIndexP * (zeroRate / 100)).toFixed(1));
    if (this.calcBasePInput) this.calcBasePInput.value = baseIndexP;

    if (this.calcBpSyncInfo) {
      const fullEffEquiv = Math.round(fullIndexP * BP_EFF_TO_INDEX_DIVISOR);
      if (bpStats.count > 0) {
        this.calcBpSyncInfo.innerHTML =
          `✅ <strong>[${jobName}] 연무장 ${bpStats.count}명 데이터 연동됨</strong> | ` +
          `연무장 평균효율: <strong style="color:#f6ad55;">${bpStats.avgEff.toLocaleString()}</strong> / 역산 풀강지수(100%): <strong>${fullIndexP}</strong> (1렙 기본값 <strong>${baseIndexP}</strong>)`;
      } else {
        this.calcBpSyncInfo.innerHTML =
          `🎯 <strong>[${jobName}] 역산 풀강효율(100%): ${fullEffEquiv.toLocaleString()}</strong> (풀강지수 <strong>${fullIndexP}</strong> / 0조각 1렙 ${zeroRate}% 기본값: <strong style="color:#63b3ed;">${baseIndexP}</strong>)`;
      }
    }

    if (this.calcFragTierButtons && tiers) {
      const curQ3 = Number(this.calcQ3Input?.value) || 0;
      const myHeroRate = this.getInterpolatedHexaRate(jobName, 5656).currentRate;
      const presetItems = [
        { label: '⭐본캐코어', rate: myHeroRate, frag: 5656 },
        { label: '2천수준', rate: tiers[0][0], frag: tiers[0][1] },
        { label: '5천수준', rate: tiers[1][0], frag: tiers[1][1] },
        { label: '1만수준', rate: tiers[2][0], frag: tiers[2][1] },
        { label: '2만수준', rate: tiers[3][0], frag: tiers[3][1] },
        { label: '4만(풀강)', rate: tiers[4][0], frag: tiers[4][1] }
      ];

      this.calcFragTierButtons.innerHTML = presetItems.map(item => {
        const isActive = Math.abs(curQ3 - item.frag) < 80;
        return `
          <button type="button" class="frag-tier-btn ${isActive ? 'active-tier' : ''}" data-frag="${item.frag}">
            <div style="font-weight:bold; color:#fff;">${item.label}</div>
            <div style="color:#4fd1c5;">${item.rate}%</div>
            <div style="font-size:9px; color:#a0aec0;">${item.frag.toLocaleString()}개</div>
          </button>
        `;
      }).join('');

      this.calcFragTierButtons.querySelectorAll('.frag-tier-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const fVal = Number(btn.dataset.frag) || 0;
          if (this.calcQ3Input) this.calcQ3Input.value = fVal;
          this.calcFragTierButtons.querySelectorAll('.frag-tier-btn').forEach(b => b.classList.remove('active-tier'));
          btn.classList.add('active-tier');
          this.recalculateDamageEstimator();
        });
      });
    }

    this.recalculateDamageEstimator();
  }

  recalculateDamageEstimator() {
    const selectedJob = this.calcJobPresetSelect?.value || '히어로';
    const P_full = Number(this.calcFullPInput?.value) || HERO_CALIBRATED_FULL_INDEX;
    const P_base = Number(this.calcBasePInput?.value) || 475.5;

    const Q2 = Number(this.calcQ2Input?.value) || 0;
    const T2 = Number(this.calcT2Input?.value) || 0;
    const Q3 = Number(this.calcQ3Input?.value) || 0;

    const cpMan = Number(this.calcCharCpManInput?.value) || 10650;
    const combatPower = cpMan * 10000;
    const forceMult = (Number(this.calcForceMultInput?.value) || 132) / 100;
    const bossHpJo = Number(this.calcBossHpJoInput?.value) || 779;
    const realFactorK = Number(this.calcRealFactorInput?.value) || 0.70;

    if (this.calcCharCpKoreanLabel) this.calcCharCpKoreanLabel.textContent = Utils.formatKoreanNumber(combatPower);

    const { currentRate, zeroRate } = this.getInterpolatedHexaRate(selectedJob, Q3);
    const U3 = zeroRate > 0 ? Number(((currentRate - zeroRate) / zeroRate).toFixed(4)) : 0;

    if (this.calcHexaRateBadge) {
      this.calcHexaRateBadge.textContent = `현재 조각(${Q3.toLocaleString()}개) 헥환보정치: ${currentRate}% (풀강=100%)`;
    }

    const U2 = T2 <= 1100 ? 0.05 : 0.075;
    const R2 = P_base + (Q2 * 12);
    const S2 = R2 * realFactorK;

    const R3 = P_full * (currentRate / 100);
    const S3 = R3 * realFactorK;

    if (this.calcU2Output) this.calcU2Output.textContent = U2.toString();
    if (this.calcR2Output) this.calcR2Output.textContent = Number(R2.toFixed(1)).toLocaleString();
    if (this.calcS2Output) this.calcS2Output.textContent = Number(S2.toFixed(1)).toLocaleString();

    if (this.calcU3Output) {
      this.calcU3Output.innerHTML = `${currentRate}% <span style="font-size:10px; color:#a0aec0;">(+${(U3 * 100).toFixed(1)}%)</span>`;
    }
    if (this.calcR3Output) this.calcR3Output.textContent = Number(R3.toFixed(1)).toLocaleString();
    if (this.calcS3Output) this.calcS3Output.textContent = Number(S3.toFixed(1)).toLocaleString();

    const fullEff = P_full * BP_EFF_TO_INDEX_DIVISOR;
    const pureRealDps = combatPower * fullEff * (currentRate / 100) * realFactorK;
    const forceRealBossDps = pureRealDps * forceMult;

    const bossHpTotal = bossHpJo * 1e12;
    const clearSeconds = forceRealBossDps > 0 ? (bossHpTotal / forceRealBossDps) : 0;
    const clearMin = Math.floor(clearSeconds / 60);
    const clearRemSec = Math.round(clearSeconds % 60);

    const totalDeal18Min = forceRealBossDps * 1080;
    const totalDeal10Min = forceRealBossDps * 600;

    if (this.calcRealBossDpsOutput) this.calcRealBossDpsOutput.textContent = `${Utils.formatKoreanNumber(forceRealBossDps)} / 초`;
    if (this.calcPureBossDpsOutput) this.calcPureBossDpsOutput.textContent = `포스 100% 기준: ${Utils.formatKoreanNumber(pureRealDps)}/초 (10분: ${Utils.formatKoreanNumber(totalDeal10Min)})`;
    if (this.calcClearTimeOutput) this.calcClearTimeOutput.textContent = `${bossHpJo}조 클리어: 약 ${clearMin}분 ${String(clearRemSec).padStart(2, '0')}초`;
    if (this.calc18MinTotalOutput) this.calc18MinTotalOutput.innerHTML = `18분 누적 딜량: <strong style="color:#4fd1c5;">${Utils.formatKoreanNumber(totalDeal18Min)}</strong>`;
  }

  async restoreSavedData() {
    const savedKey = localStorage.getItem(this.STORAGE_KEY_API);
    if (savedKey && this.apiKeyInput) {
      this.apiKeyInput.value = savedKey;
      this.api = new NexonMapleApi(savedKey);
    }

    try {
      localStorage.removeItem('MAPLE_SKILL_CLASSIFICATION_DB');
      const savedManual = localStorage.getItem(this.STORAGE_KEY_MANUAL_CATS);
      if (savedManual) {
        Object.entries(JSON.parse(savedManual) || {}).forEach(([sName, cat]) => {
          this.skillClassificationDb[sName] = { category: cat, manual: true };
        });
      }
      const savedBurstProfiles = localStorage.getItem(this.STORAGE_KEY_SAVED_BURST_PROFILES);
      if (savedBurstProfiles) {
        this.savedJobBurstProfiles = JSON.parse(savedBurstProfiles) || {};
      }
    } catch (e) {}

    try {
      const res = await ipcRenderer.invoke('load-local-db');
      if (res && res.success && res.data) {
        if (res.data.manualSkillCategories && typeof res.data.manualSkillCategories === 'object') {
          Object.entries(res.data.manualSkillCategories).forEach(([sName, cat]) => {
            this.skillClassificationDb[sName] = { category: cat, manual: true };
          });
        }
        if (res.data.savedJobBurstProfiles && typeof res.data.savedJobBurstProfiles === 'object') {
          this.savedJobBurstProfiles = { ...res.data.savedJobBurstProfiles, ...this.savedJobBurstProfiles };
        }
        if (res.data.seasons && typeof res.data.seasons === 'object') {
          Object.entries(res.data.seasons).forEach(([sKey, sObj]) => {
            const rMap = new Map();
            (sObj?.records || []).forEach(r => { if (r && r.charName) rMap.set(r.charName, r); });
            this.seasonsDb.set(sKey, { name: sObj?.name || sKey, recordsMap: rMap });
          });
          this.currentSeasonKey = res.data.currentSeasonKey || Array.from(this.seasonsDb.keys())[0] || 'season_5';
        } else if (Array.isArray(res.data.records)) {
          const rMap = new Map();
          const nowIso = new Date().toISOString();
          res.data.records.forEach(r => {
            if (!r || !r.charName) return;
            if (!r.recordDate) r.recordDate = nowIso;
            rMap.set(r.charName, r);
          });
          this.seasonsDb.set('season_5', { name: '5기 연무장', recordsMap: rMap });
          this.currentSeasonKey = 'season_5';
          await this.saveRecordsToDisk();
        }
      }
    } catch (err) {
      console.warn('로컬 DB 로드 실패:', err);
    }

    if (this.seasonsDb.size === 0) {
      this.seasonsDb.set('season_5', { name: '5기 연무장', recordsMap: new Map() });
      this.currentSeasonKey = 'season_5';
    }

    this.renderSeasonSelectUI();
    this.refreshAllSeasonViews();
    this.initDamageCalculatorPresets();
    this.renderBurstSkillSaveBanners();
  }

  async saveRecordsToDisk() {
    const manualSkillCategories = {};
    Object.entries(this.skillClassificationDb).forEach(([sName, obj]) => {
      if (obj && obj.manual && obj.category) manualSkillCategories[sName] = obj.category;
    });

    try {
      localStorage.setItem(this.STORAGE_KEY_MANUAL_CATS, JSON.stringify(manualSkillCategories));
      localStorage.setItem(this.STORAGE_KEY_SAVED_BURST_PROFILES, JSON.stringify(this.savedJobBurstProfiles));
    } catch (e) {}

    const seasonsPayload = {};
    for (const [sKey, sVal] of this.seasonsDb.entries()) {
      seasonsPayload[sKey] = {
        name: sVal.name,
        records: Array.from(sVal.recordsMap.values())
      };
    }

    try {
      await ipcRenderer.invoke('save-local-db', {
        currentSeasonKey: this.currentSeasonKey,
        seasons: seasonsPayload,
        manualSkillCategories,
        savedJobBurstProfiles: this.savedJobBurstProfiles
      });
    } catch (err) {
      console.warn('로컬 DB 디스크 저장 실패:', err);
    }

    this.updateSeasonPeriodBadge();
    if (this.totalRecordBadge) this.totalRecordBadge.textContent = this.recordsDb.size;
  }

  renderSeasonSelectUI() {
    if (!this.seasonSelect) return;
    const optionsHtml = [];
    for (const [sKey, sVal] of this.seasonsDb.entries()) {
      optionsHtml.push(`<option value="${sKey}">${sVal.name} (${sVal.recordsMap.size}건)</option>`);
    }
    this.seasonSelect.innerHTML = optionsHtml.join('');
    this.seasonSelect.value = this.currentSeasonKey;
  }

  updateSeasonPeriodBadge() {
    if (!this.seasonPeriodBadge) return;
    const seasonObj = this.seasonsDb.get(this.currentSeasonKey);
    const seasonName = seasonObj ? seasonObj.name : '현재 기수';
    const recs = Array.from(this.recordsDb.values());

    if (recs.length === 0) {
      this.seasonPeriodBadge.textContent = `📅 ${seasonName} | 기록 없음`;
      return;
    }

    const timestamps = [];
    recs.forEach(r => {
      const rawDate = r?.recordDate || r?.collectedAt;
      if (rawDate) {
        const t = new Date(rawDate).getTime();
        if (!isNaN(t)) timestamps.push(t);
      }
    });

    if (timestamps.length === 0) {
      this.seasonPeriodBadge.textContent = `📅 ${seasonName} (${recs.length}명) | 기간 정보 없음`;
      return;
    }

    const minStr = Utils.formatShortDate(new Date(Math.min(...timestamps)).toISOString());
    const maxStr = Utils.formatShortDate(new Date(Math.max(...timestamps)).toISOString());
    this.seasonPeriodBadge.textContent = `📅 ${seasonName} 기간: ${minStr} ~ ${maxStr} (총 ${recs.length}명)`;
  }

  refreshAllSeasonViews() {
    this.renderSeasonSelectUI();
    this.updateSeasonPeriodBadge();
    this.updateJobFilterDropdown();
    this.updateJobBurstRoleClassifier();
    this.updateChuchuRankTable();
    this.updateAllRecordsTable();
    this.updateTop20SkillsTable();
    this.renderBurstSkillSaveBanners();
  }

  getSkillCategory(skillName, rec = null) {
    if (!skillName || typeof skillName !== 'string') return '공격';
    const saved = this.skillClassificationDb[skillName];
    if (saved && saved.manual && saved.category) return saved.category;
    if (SEEDRING_KEYWORDS.some(kw => skillName.includes(kw))) return '시드링';
    if (KNOWN_ATTACK_SUB_KEYWORDS.some(kw => skillName.includes(kw))) return '공격';

    if (rec && Array.isArray(rec.skills)) {
      const directSkill = rec.skills.find(s => s && s.name === skillName);
      const directRate = directSkill ? Number(directSkill.rate) || 0 : 0;
      const meta = (rec.skillMeta && rec.skillMeta[skillName]) || saved || {};
      const descText = `${meta.description || ''} ${meta.effect || ''}`;

      if (descText.includes('설치') || descText.includes('영역 생성') || skillName.includes('파운틴')) return '설치';
      if (descText.includes('소환') || skillName.includes('솔 헤카테') || skillName.includes('가디언 오브 노바')) return '소환';
      if (directRate > 0) return '공격';

      const basePrefix = skillName.split(':')[0].replace(/\s+VI$/i, '').trim();
      if (basePrefix.length >= 2) {
        const hasDamagingSibling = rec.skills.some(s => s && typeof s.name === 'string' && (Number(s.rate) || 0) > 0 && s.name.includes(basePrefix));
        if (hasDamagingSibling) return '공격';
      }
    }
    return '버프';
  }

  async setManualSkillCategory(skillName, newCategory) {
    if (!skillName || !newCategory) return;
    const prev = this.skillClassificationDb[skillName] || {};
    this.skillClassificationDb[skillName] = { ...prev, category: newCategory, manual: true };

    await this.saveRecordsToDisk();
    this.updateJobBurstRoleClassifier();

    if (this.currentSelectedRecord) {
      this.renderDetailSkillsTable(this.currentSelectedRecord);
      this.renderTimelineSection(this.currentSelectedRecord);
      this.setupRightExtensionPanel(this.currentSelectedRecord);
    }
    this.setStatus(`'${skillName}' 스킬 분류가 [${newCategory}](으)로 수동 보정되어 저장되었습니다.`);
  }

  classifySkillsOfRecord(rec) {
    const damageRateMap = new Map();
    const totalUseMap = new Map();
    (rec?.skills || []).forEach(s => {
      if (!s || !s.name) return;
      damageRateMap.set(s.name, Number(s.rate) || 0);
      totalUseMap.set(s.name, Number(s.useCount) || 0);
    });

    const timelineCountMap = new Map();
    const timelineEventsBySkill = new Map();
    (rec?.timeline || []).forEach(t => {
      const name = t?.skill_name;
      if (!name) return;
      timelineCountMap.set(name, (timelineCountMap.get(name) || 0) + 1);
      if (!timelineEventsBySkill.has(name)) timelineEventsBySkill.set(name, []);
      timelineEventsBySkill.get(name).push(Number(t.elapse_time) || 0);
    });

    const allSkillNames = new Set([...damageRateMap.keys(), ...timelineCountMap.keys()]);
    const categoryMap = new Map();
    const buffSkillSet = new Set();

    allSkillNames.forEach(sName => {
      const cat = this.getSkillCategory(sName, rec);
      categoryMap.set(sName, cat);
      if (cat === '버프' || cat === '시드링') buffSkillSet.add(sName);
    });

    return { damageRateMap, totalUseMap, timelineCountMap, timelineEventsBySkill, buffSkillSet, categoryMap, allSkillNames };
  }

  toggleSkillSelection(skillName) {
    if (!skillName) return;
    if (this.selectedSkills.has(skillName)) this.selectedSkills.delete(skillName);
    else this.selectedSkills.add(skillName);
    this.customBurstRateInputVal = null;

    if (this.timelineSkillDropdownContent) {
      this.timelineSkillDropdownContent.querySelectorAll('.skill-checkbox').forEach(chk => {
        chk.checked = this.selectedSkills.has(chk.value);
      });
    }
    this.updateDropdownButtonLabel();

    if (this.currentSelectedRecord) {
      this.renderDetailSkillsTable(this.currentSelectedRecord);
      this.renderTimelineSection(this.currentSelectedRecord);
      this.renderBurstWindowAnalysis(this.currentSelectedRecord);
    }
    this.updateTop20SkillsTable();
    this.renderBurstSkillSaveBanners();
  }

  bindEvents() {
    if (this.apiKeyInput) {
      this.apiKeyInput.addEventListener('input', () => {
        const val = this.apiKeyInput.value.trim();
        localStorage.setItem(this.STORAGE_KEY_API, val);
        this.api = new NexonMapleApi(val);
      });
    }

    if (this.toggleKeyBtn && this.apiKeyInput) {
      this.toggleKeyBtn.addEventListener('click', () => {
        const isPwd = this.apiKeyInput.type === 'password';
        this.apiKeyInput.type = isPwd ? 'text' : 'password';
        this.toggleKeyBtn.textContent = isPwd ? '숨김' : '보기';
      });
    }

    if (this.loadAccountBtn) this.loadAccountBtn.addEventListener('click', () => this.loadAccountCharacters());
    if (this.worldSelect) this.worldSelect.addEventListener('change', () => this.renderFilteredCharacters());
    if (this.maxLevelInput) this.maxLevelInput.addEventListener('input', () => this.renderFilteredCharacters());

    if (this.tabCharList) this.tabCharList.addEventListener('click', () => this.switchLeftTab('char'));
    if (this.tabJobSummary) this.tabJobSummary.addEventListener('click', () => this.switchLeftTab('job'));

    if (this.directSearchBtn && this.directCharInput) {
      this.directSearchBtn.addEventListener('click', () => this.handleMultipleCharacterSearch());
      this.directCharInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleMultipleCharacterSearch();
      });
    }

    if (this.baselineJobSelect) {
      this.baselineJobSelect.addEventListener('change', () => {
        this.isManualCutoffOverride = false;
        this.updateJobBurstRoleClassifier();
        this.updateChuchuRankTable();
        this.renderBurstSkillSaveBanners();
      });
    }

    if (this.burstCutoffInput) {
      this.burstCutoffInput.addEventListener('input', () => {
        this.isManualCutoffOverride = true;
        this.updateJobBurstRoleClassifier();
        this.updateChuchuRankTable();
        this.renderBurstSkillSaveBanners();
      });
    }

    [this.omegaBaseInput, this.omegaBuffClassInput].forEach(inp => {
      if (inp) {
        inp.addEventListener('input', () => {
          this.updateJobBurstRoleClassifier();
          this.updateChuchuRankTable();
          if (this.currentSelectedRecord) {
            this.renderDetailSkillsTable(this.currentSelectedRecord);
            this.renderBurstWindowAnalysis(this.currentSelectedRecord, false);
          }
          this.renderBurstSkillSaveBanners();
        });
      }
    });

    if (this.filterOnlyMyAccountJobsChk) {
      this.filterOnlyMyAccountJobsChk.addEventListener('change', () => this.updateJobBurstRoleClassifier());
    }

    if (this.toggleExtensionBtn && this.rightExtensionBox) {
      this.toggleExtensionBtn.addEventListener('click', () => {
        this.isExtensionOpen = !this.isExtensionOpen;
        this.rightExtensionBox.classList.toggle('collapsed', !this.isExtensionOpen);
        this.toggleExtensionBtn.textContent = this.isExtensionOpen ? '⚡ 확장창 닫기 ◀' : '⚡ 확장창 열기 ▶';
        try { window.resizeBy(this.isExtensionOpen ? 590 : -590, 0); } catch (e) {}
      });
    }

    if (this.seasonSelect) {
      this.seasonSelect.addEventListener('change', async (e) => {
        this.currentSeasonKey = e.target.value;
        this.selectedSkills.clear();
        this.isManualCutoffOverride = false;
        await this.saveRecordsToDisk();
        this.refreshAllSeasonViews();
        this.initDamageCalculatorPresets();
        this.switchRightMode('rank');
      });
    }

    if (this.addSeasonBtn) {
      this.addSeasonBtn.addEventListener('click', async () => {
        const nextNum = this.seasonsDb.size + 5;
        const inputName = window.prompt('새로 추가할 연무장 기수(시즌) 이름을 입력하세요:', `${nextNum}기 연무장`);
        if (!inputName || !inputName.trim()) return;
        const cleanName = inputName.trim();
        const newKey = `season_${Date.now()}`;
        this.seasonsDb.set(newKey, { name: cleanName, recordsMap: new Map() });
        this.currentSeasonKey = newKey;
        this.selectedSkills.clear();
        this.isManualCutoffOverride = false;
        await this.saveRecordsToDisk();
        this.refreshAllSeasonViews();
        this.initDamageCalculatorPresets();
        this.switchRightMode('rank');
      });
    }

    if (this.rankJobFilter) {
      this.rankJobFilter.addEventListener('change', () => {
        const selectedJob = this.rankJobFilter.value;
        if (selectedJob !== 'ALL') {
          const restored = this.restoreSavedBurstSkillsForJob(selectedJob);
          if (!restored) this.selectedSkills.clear();
        } else {
          this.selectedSkills.clear();
        }
        this.updateChuchuRankTable();
        this.updateAllRecordsTable();
        this.updateTop20SkillsTable();
        this.renderBurstSkillSaveBanners();

        if (selectedJob !== 'ALL' && this.calcJobPresetSelect && HEXA_FRAGMENT_TABLE[selectedJob]) {
          this.calcJobPresetSelect.value = selectedJob;
          this.syncCalculatorWithJobAndBp(selectedJob);
        }
      });
    }

    if (this.modeChuchuRank) this.modeChuchuRank.addEventListener('click', () => this.switchRightMode('rank'));
    if (this.modeAllRecords) this.modeAllRecords.addEventListener('click', () => {
      this.switchRightMode('allRecords');
      this.updateAllRecordsTable();
    });
    if (this.modeTop20Skills) this.modeTop20Skills.addEventListener('click', () => {
      this.switchRightMode('top20');
      this.updateTop20SkillsTable();
      this.renderBurstSkillSaveBanners();
    });
    if (this.modeSingleDetail) this.modeSingleDetail.addEventListener('click', () => this.switchRightMode('detail'));

    if (this.hideBuffsInMainTimelineChk) {
      this.hideBuffsInMainTimelineChk.addEventListener('change', (e) => {
        this.hideBuffsInMainTimeline = e.target.checked;
        if (this.currentSelectedRecord) this.renderTimelineSection(this.currentSelectedRecord);
      });
    }

    if (this.timelineIntervalSelect) {
      this.timelineIntervalSelect.addEventListener('change', (e) => {
        this.currentTimelineInterval = Number(e.target.value) || 30;
        if (this.currentSelectedRecord) this.renderTimelineSection(this.currentSelectedRecord);
      });
    }

    if (this.top20TimelineIntervalSelect) {
      this.top20TimelineIntervalSelect.addEventListener('change', (e) => {
        this.top20TimelineInterval = Number(e.target.value) || 30;
        this.updateTop20SkillsTable();
        this.renderBurstSkillSaveBanners();
      });
    }

    if (this.clearTop20SelectionBtn) {
      this.clearTop20SelectionBtn.addEventListener('click', () => {
        this.selectedSkills.clear();
        this.customBurstRateInputVal = null;
        this.updateDropdownButtonLabel();
        this.updateTop20SkillsTable();
        this.renderBurstSkillSaveBanners();
        if (this.currentSelectedRecord) {
          this.renderDetailSkillsTable(this.currentSelectedRecord);
          this.renderTimelineSection(this.currentSelectedRecord);
          this.renderBurstWindowAnalysis(this.currentSelectedRecord);
        }
      });
    }

    if (this.fetchApiSkillMetaBtn) {
      this.fetchApiSkillMetaBtn.addEventListener('click', async () => {
        if (!this.currentSelectedRecord) return this.setStatus('먼저 캐릭터를 선택해주세요.', true);
        if (!this.ensureApi()) return;
        const charName = this.currentSelectedRecord.charName;
        try {
          this.setStatus(`'${charName}'의 스킬 설명 및 HEXA 조각수 수집 중...`);
          const { ocid } = await this.api.getOcid(charName);
          const [skillMeta, hexaData] = await Promise.all([
            this.api.getCharacterSkillsByGrades(ocid),
            this.api.getCharacterHexaMatrix(ocid).catch(() => null)
          ]);
          this.currentSelectedRecord.skillMeta = skillMeta;
          const { combatFragments } = Utils.calculateHexaFragmentsFromApi(hexaData);
          if (combatFragments > 0) {
            this.currentSelectedRecord.usedFragments = combatFragments;
            if (this.calcQ3Input) this.calcQ3Input.value = combatFragments;
          }
          Object.entries(skillMeta).forEach(([sName, meta]) => {
            const existing = this.skillClassificationDb[sName] || {};
            this.skillClassificationDb[sName] = {
              ...existing,
              grade: meta.grade,
              description: meta.description,
              effect: meta.effect,
              category: existing.manual ? existing.category : this.getSkillCategory(sName, this.currentSelectedRecord)
            };
          });
          await this.saveRecordsToDisk();
          this.renderDetailSkillsTable(this.currentSelectedRecord);
          this.setupRightExtensionPanel(this.currentSelectedRecord);
          this.recalculateDamageEstimator();
          this.setStatus(`'${charName}' 스킬 정보 및 6차 조각수(${combatFragments.toLocaleString()}개) 반영 완료!`);
        } catch (err) {
          this.setStatus(`스킬 정보 수집 실패: ${err.message}`, true);
        }
      });
    }

    if (this.skillDbCategoryFilter) {
      this.skillDbCategoryFilter.addEventListener('change', () => {
        if (this.currentSelectedRecord) this.renderSkillClassifierTable(this.currentSelectedRecord);
      });
    }

    if (this.burstTriggerSkillSelect) {
      this.burstTriggerSkillSelect.addEventListener('change', (e) => {
        this.currentBurstTriggerSkill = e.target.value;
        this.selectedBurstRound = 'ALL';
        if (this.currentSelectedRecord) {
          this.highlightActiveBuffPill();
          this.renderDetailSkillsTable(this.currentSelectedRecord);
          this.renderBurstWindowAnalysis(this.currentSelectedRecord, true);
        }
      });
    }

    if (this.burstWindowSecInput) {
      this.burstWindowSecInput.addEventListener('input', (e) => {
        const val = Math.max(5, Math.min(120, Number(e.target.value) || 30));
        this.burstWindowSeconds = val;
        document.querySelectorAll('.burst-preset-btn').forEach(btn => {
          btn.classList.toggle('active-preset', Number(btn.dataset.sec) === val);
        });
        this.updateJobBurstRoleClassifier();
        if (this.currentSelectedRecord) {
          this.renderDetailSkillsTable(this.currentSelectedRecord);
          this.renderBurstWindowAnalysis(this.currentSelectedRecord, true);
        }
      });
    }

    if (this.burstRoundSelect) {
      this.burstRoundSelect.addEventListener('change', (e) => {
        this.selectedBurstRound = e.target.value;
        if (this.currentSelectedRecord) this.renderBurstWindowAnalysis(this.currentSelectedRecord, false);
      });
    }

    document.querySelectorAll('.burst-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sec = Number(btn.dataset.sec) || 30;
        this.burstWindowSeconds = sec;
        if (this.burstWindowSecInput) this.burstWindowSecInput.value = sec;
        document.querySelectorAll('.burst-preset-btn').forEach(b => b.classList.remove('active-preset'));
        btn.classList.add('active-preset');
        this.updateJobBurstRoleClassifier();
        if (this.currentSelectedRecord) {
          this.renderDetailSkillsTable(this.currentSelectedRecord);
          this.renderBurstWindowAnalysis(this.currentSelectedRecord, true);
        }
      });
    });

    if (this.calcJobPresetSelect) {
      this.calcJobPresetSelect.addEventListener('change', (e) => this.syncCalculatorWithJobAndBp(e.target.value));
    }

    if (this.applyHeroCalibrationBtn) {
      this.applyHeroCalibrationBtn.addEventListener('click', () => this.applyHeroMainCalibration());
    }

    if (this.calcFullPInput) {
      this.calcFullPInput.addEventListener('input', () => {
        const selectedJob = this.calcJobPresetSelect?.value || '히어로';
        const { zeroRate } = this.getInterpolatedHexaRate(selectedJob, 0);
        const fullVal = Number(this.calcFullPInput.value) || 0;
        if (this.calcBasePInput) this.calcBasePInput.value = Number((fullVal * (zeroRate / 100)).toFixed(1));
        this.recalculateDamageEstimator();
      });
    }

    [
      this.calcBasePInput, this.calcQ2Input, this.calcT2Input, this.calcQ3Input,
      this.calcCharCpManInput, this.calcForceMultInput, this.calcBossHpJoInput, this.calcRealFactorInput
    ].forEach(inp => {
      if (inp) inp.addEventListener('input', () => this.recalculateDamageEstimator());
    });

    if (this.timelineSkillDropdownBtn && this.timelineSkillDropdownContent) {
      this.timelineSkillDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.timelineSkillDropdownContent.classList.toggle('show');
      });
      window.addEventListener('click', () => this.timelineSkillDropdownContent.classList.remove('show'));
      this.timelineSkillDropdownContent.addEventListener('click', (e) => e.stopPropagation());
    }
  }

  setStatus(text, isError = false) {
    if (this.statusBadge) {
      this.statusBadge.textContent = text;
      this.statusBadge.style.color = isError ? '#ff6b6b' : '#ff9900';
    }
  }

  ensureApi() {
    const key = this.apiKeyInput ? this.apiKeyInput.value.trim() : '';
    if (!key) {
      this.setStatus('API Key를 먼저 입력해주세요!', true);
      return false;
    }
    localStorage.setItem(this.STORAGE_KEY_API, key);
    this.api = new NexonMapleApi(key);
    return true;
  }

  switchLeftTab(mode) {
    const isChar = mode === 'char';
    if (this.tabCharList) this.tabCharList.classList.toggle('active', isChar);
    if (this.tabJobSummary) this.tabJobSummary.classList.toggle('active', !isChar);
    if (this.charListTable) this.charListTable.classList.toggle('hidden', !isChar);
    if (this.jobSummaryTable) this.jobSummaryTable.classList.toggle('hidden', isChar);
  }

  switchRightMode(mode) {
    const isRank = mode === 'rank', isAllRecords = mode === 'allRecords', isTop20 = mode === 'top20';
    if (this.modeChuchuRank) this.modeChuchuRank.classList.toggle('active', isRank);
    if (this.modeAllRecords) this.modeAllRecords.classList.toggle('active', isAllRecords);
    if (this.modeTop20Skills) this.modeTop20Skills.classList.toggle('active', isTop20);
    if (this.modeSingleDetail) this.modeSingleDetail.classList.toggle('active', !isRank && !isAllRecords && !isTop20);

    if (this.chuchuRankView) this.chuchuRankView.classList.toggle('hidden', !isRank);
    if (this.allRecordsView) this.allRecordsView.classList.toggle('hidden', !isAllRecords);
    if (this.top20SkillsView) this.top20SkillsView.classList.toggle('hidden', !isTop20);
    if (this.singleDetailView) this.singleDetailView.classList.toggle('hidden', isRank || isAllRecords || isTop20);
  }

  async loadAccountCharacters() {
    if (!this.ensureApi()) return;
    try {
      this.setStatus('계정 캐릭터 불러오는 중...');
      const data = await this.api.getAccountCharacters();
      this.allCharacters = [];
      const worldSet = new Set();
      (data.account_list || []).forEach(acc => {
        (acc.character_list || []).forEach(ch => {
          this.allCharacters.push(ch);
          if (ch.world_name) worldSet.add(ch.world_name);
        });
      });
      this.allCharacters.sort((a, b) => (b.character_level || 0) - (a.character_level || 0));

      if (this.worldSelect) {
        const worlds = Array.from(worldSet);
        this.worldSelect.innerHTML = `<option value="ALL">전체 월드 (${this.allCharacters.length})</option>` +
          worlds.map(w => `<option value="${w}">${w}</option>`).join('');
        this.worldSelect.disabled = false;
      }
      this.renderFilteredCharacters();
      this.setStatus(`총 ${this.allCharacters.length}캐릭 로드 완료`);
    } catch (err) {
      this.setStatus(`로드 실패: ${err.message}`, true);
    }
  }

  renderFilteredCharacters() {
    const selectedWorld = this.worldSelect ? this.worldSelect.value : 'ALL';
    const maxLevel = this.maxLevelInput ? (Number(this.maxLevelInput.value) || 300) : 300;

    this.filteredCharacters = this.allCharacters.filter(ch => {
      const matchWorld = selectedWorld === 'ALL' || ch.world_name === selectedWorld;
      const matchLevel = (Number(ch.character_level) || 0) <= maxLevel;
      return matchWorld && matchLevel;
    });

    const totalLvSum = this.filteredCharacters.reduce((acc, cur) => acc + (Number(cur.character_level) || 0), 0);
    if (this.charCountInfo) {
      this.charCountInfo.textContent = `${maxLevel}Lv 이하: ${this.filteredCharacters.length}명 (레벨 합: ${totalLvSum.toLocaleString()})`;
    }

    if (this.charListBody) {
      if (this.filteredCharacters.length === 0) {
        this.charListBody.innerHTML = `<tr><td colspan="4" class="empty-msg">조건에 해당하는 캐릭터가 없습니다.</td></tr>`;
      } else {
        this.charListBody.innerHTML = this.filteredCharacters.map(ch => `
          <tr class="clickable-row" data-name="${ch.character_name}" data-job="${ch.character_class}" data-lv="${ch.character_level}">
            <td><strong>${ch.character_name}</strong></td>
            <td>${ch.character_class}</td>
            <td>Lv.${ch.character_level}</td>
            <td>${ch.world_name}</td>
          </tr>
        `).join('');

        this.charListBody.querySelectorAll('.clickable-row').forEach(row => {
          row.addEventListener('click', async () => {
            this.charListBody.querySelectorAll('.clickable-row').forEach(r => r.classList.remove('selected'));
            row.classList.add('selected');
            await this.loadAccountCharacterHexaToQ3(row.dataset.name, row.dataset.job, Number(row.dataset.lv) || 0);
          });
        });
      }
    }

    this.updateJobBurstRoleClassifier();

    if (this.jobSummaryBody) {
      const grouped = Utils.groupByJob(this.filteredCharacters);
      const currentFilterJob = this.rankJobFilter ? this.rankJobFilter.value : 'ALL';
      const activeCutoff = Number(this.burstCutoffInput?.value) || 50.0;

      this.jobSummaryBody.innerHTML = grouped.length === 0
        ? `<tr><td colspan="3" class="empty-msg">데이터 없음</td></tr>`
        : grouped.map(g => {
            const isSelected = currentFilterJob !== 'ALL' && Utils.isSameJob(g.job, currentFilterJob);
            const aliases = JOB_NAME_ALIASES[g.job] || [g.job];
            const statKey = aliases.find(k => this.jobBurstStatsCache.has(k)) || g.job;
            const bStat = this.jobBurstStatsCache.get(statKey);
            let roleBadge = `<span style="color:#718096; font-size:10px; margin-left:4px;">[미분류]</span>`;
            if (bStat && bStat.avgBurstRate !== null) {
              const savedMark = bStat.isManualSaved ? '💾' : (bStat.isBuffCentric ? '⚡' : '');
              roleBadge = bStat.avgBurstRate >= activeCutoff
                ? `<span style="color:#fc8181; font-size:10px; margin-left:4px;">[${savedMark}🔥극딜 ${bStat.avgBurstRate}%]</span>`
                : `<span style="color:#63b3ed; font-size:10px; margin-left:4px;">[${savedMark}🔄평딜 ${bStat.avgBurstRate}%]</span>`;
            }

            return `
              <tr class="clickable-row skill-selectable-row ${isSelected ? 'selected-skill-row' : ''}" data-job="${g.job}">
                <td><strong>${g.job}</strong>${roleBadge}</td>
                <td>${g.count}개</td>
                <td>${g.levels.map(l => `<span class="level-badge">Lv.${l}</span>`).join('')}</td>
              </tr>
            `;
          }).join('');

      this.jobSummaryBody.querySelectorAll('.clickable-row').forEach(row => {
        row.addEventListener('click', async () => {
          this.jobSummaryBody.querySelectorAll('.clickable-row').forEach(r => {
            r.classList.remove('selected', 'selected-skill-row');
          });
          row.classList.add('selected', 'selected-skill-row');

          const targetJob = row.dataset.job;
          const myCharsOfJob = this.filteredCharacters
            .filter(c => c.character_class === targetJob)
            .sort((a, b) => (b.character_level || 0) - (a.character_level || 0));

          if (myCharsOfJob.length > 0 && (Number(myCharsOfJob[0].character_level) || 0) >= 260) {
            const topChar = myCharsOfJob[0];
            await this.loadAccountCharacterHexaToQ3(topChar.character_name, topChar.character_class, Number(topChar.character_level));
          } else {
            this.selectJobFromLeftPanel(targetJob, true);
          }
        });
      });
    }
  }

  async handleMultipleCharacterSearch() {
    if (!this.ensureApi()) return;
    const rawText = this.directCharInput ? this.directCharInput.value.trim() : '';
    if (!rawText) return this.setStatus('조회할 닉네임을 입력하세요.', true);

    const inputNames = rawText.split(/[,，\s]+/).map(n => n.trim()).filter(n => n.length > 0);
    if (inputNames.length === 0) return;

    const currentSeasonName = this.seasonsDb.get(this.currentSeasonKey)?.name || '현재 기수';
    const targetNames = inputNames.filter(name => {
      const existing = this.recordsDb.get(name);
      return !existing || !existing.timeline || existing.timeline.length === 0;
    });

    const skippedCount = inputNames.length - targetNames.length;
    if (targetNames.length === 0) {
      return this.setStatus(`[${currentSeasonName}] 입력한 ${inputNames.length}명 모두 이미 DB와 타임라인이 존재합니다.`);
    }

    let successCount = 0;
    for (let i = 0; i < targetNames.length; i++) {
      const name = targetNames[i];
      this.setStatus(`[${currentSeasonName}] 진행 중 (${i + 1}/${targetNames.length}): ${name} 확인 중...`);
      try {
        await this.searchSingleCharacterByName(name, false);
        successCount++;
      } catch (err) {
        console.warn(`[${name}] 조회 실패:`, err.message);
      }
      await Utils.sleep(700);
    }

    await this.saveRecordsToDisk();
    this.refreshAllSeasonViews();
    this.renderFilteredCharacters();
    this.initDamageCalculatorPresets();
    this.setStatus(`[${currentSeasonName}] 일괄 조회 완료! (성공: ${successCount}/${targetNames.length}명, 패스: ${skippedCount}명)`);
  }

  async searchSingleCharacterByName(charName, updateTable = true) {
    const { ocid } = await this.api.getOcid(charName);
    const replayRes = await this.api.getBattlePracticeReplayIds(ocid);
    const replayList = replayRes.replay_list || [];
    if (replayList.length === 0) throw new Error(`연무장 기록 없음`);

    const latestReplayObj = replayList[0];
    const latestReplayId = latestReplayObj.replay_id;

    const [resultData, charInfoData, basicInfoData, timelineData, hexaData] = await Promise.all([
      this.api.getBattlePracticeResult(latestReplayId),
      this.api.getBattlePracticeCharacterInfo(latestReplayId),
      this.api.getCharacterBasic(ocid).catch(() => ({})),
      this.api.getBattlePracticeSkillTimelineAll(latestReplayId),
      updateTable ? this.api.getCharacterHexaMatrix(ocid).catch(() => null) : Promise.resolve(null)
    ]);

    const basicObj = charInfoData.basic_object || {};
    const job = basicObj.character_class || basicInfoData.character_class || '미분류';
    const level = basicObj.character_level || basicInfoData.character_level || 0;
    const dps = Number(resultData.total_dps || 0);

    let combatPower = 0;
    const cpStat = (charInfoData.stat_object?.basic_stat_object?.final_stat || []).find(s => s.stat_name === '전투력');
    if (cpStat) combatPower = Number(cpStat.stat_value) || 0;

    const efficiency = combatPower > 0 ? Math.round(dps / combatPower) : 0;
    const skills = (resultData.skill_statistic || []).map(s => ({
      name: s.skill_name,
      rate: Number(s.damage_percent || 0),
      useCount: Number(s.use_count || 0)
    })).sort((a, b) => b.rate - a.rate);

    const recordDate = latestReplayObj.register_date || latestReplayObj.date || resultData.register_date || new Date().toISOString();
    const { combatFragments } = Utils.calculateHexaFragmentsFromApi(hexaData);
    const existingRec = this.recordsDb.get(charName) || {};

    const recordObj = {
      replayId: latestReplayId,
      charName,
      job,
      level,
      dps,
      combatPower,
      efficiency,
      usedFragments: combatFragments || existingRec.usedFragments || 0,
      recordDate,
      collectedAt: new Date().toISOString(),
      skills,
      timeline: timelineData || []
    };

    this.recordsDb.set(charName, recordObj);

    if (updateTable) {
      await this.saveRecordsToDisk();
      this.refreshAllSeasonViews();
      this.renderFilteredCharacters();
      this.initDamageCalculatorPresets();
      this.renderDetailView(recordObj);
      const sName = this.seasonsDb.get(this.currentSeasonKey)?.name || '현재 기수';
      this.setStatus(`[${sName}] '${charName}' (${job}) 연무장 데이터 및 30초 극딜 비중 갱신 완료!`);
    }
  }

  renderDetailView(rec) {
    if (!rec) return;
    const isSameCharacter = this.currentSelectedRecord && this.currentSelectedRecord.charName === rec.charName;
    this.currentSelectedRecord = rec;
    this.switchRightMode('detail');

    if (this.cardCharJob) this.cardCharJob.textContent = `${rec.charName} (${rec.job} Lv.${rec.level})`;
    if (this.cardDps) this.cardDps.textContent = Utils.formatKoreanNumber(rec.dps);
    if (this.cardCombatPower) this.cardCombatPower.textContent = rec.combatPower > 0 ? Utils.formatKoreanNumber(rec.combatPower) : '-';
    if (this.cardEfficiency) this.cardEfficiency.textContent = rec.efficiency > 0 ? rec.efficiency.toLocaleString() : '-';
    if (this.detailRecordDateInfo) {
      const sName = this.seasonsDb.get(this.currentSeasonKey)?.name || '';
      this.detailRecordDateInfo.textContent = `${sName} | 기록일: ${Utils.formatShortDate(rec.recordDate || rec.collectedAt)}`;
    }

    if (!isSameCharacter) {
      const restored = this.restoreSavedBurstSkillsForJob(rec.job);
      if (!restored) this.selectedSkills.clear();
      this.selectedBurstRound = 'ALL';
    }

    if (rec.combatPower > 0 && this.calcCharCpManInput) {
      this.calcCharCpManInput.value = Math.round(rec.combatPower / 10000);
    }
    if (rec.usedFragments > 0 && this.calcQ3Input) {
      this.calcQ3Input.value = rec.usedFragments;
    }

    const aliases = JOB_NAME_ALIASES[rec.job] || [rec.job];
    const matchedCalcJob = aliases.find(k => HEXA_FRAGMENT_TABLE[k]) || rec.job;
    if (this.calcJobPresetSelect && HEXA_FRAGMENT_TABLE[matchedCalcJob]) {
      this.calcJobPresetSelect.value = matchedCalcJob;
      this.syncCalculatorWithJobAndBp(matchedCalcJob);
    } else {
      this.recalculateDamageEstimator();
    }

    this.setupRightExtensionPanel(rec);
    this.renderDetailSkillsTable(rec);
    this.buildTimelineSkillCheckboxes(rec);
    this.renderTimelineSection(rec);
    this.renderBurstSkillSaveBanners();
  }

  setupRightExtensionPanel(rec) {
    if (!rec) return;
    if (this.extTargetCharLabel) {
      this.extTargetCharLabel.textContent = `대상: ${rec.charName} (${rec.job} Lv.${rec.level})`;
    }

    const { timelineCountMap, timelineEventsBySkill, buffSkillSet, categoryMap } = this.classifySkillsOfRecord(rec);

    const buffList = Array.from(buffSkillSet)
      .filter(name => timelineCountMap.has(name))
      .map(name => ({
        name,
        category: categoryMap.get(name) || '버프',
        rawCount: timelineCountMap.get(name) || 0,
        events: timelineEventsBySkill.get(name) || []
      }));

    buffList.sort((a, b) => {
      const aIsSeed = a.category === '시드링' ? -1 : 0;
      const bIsSeed = b.category === '시드링' ? -1 : 0;
      if (aIsSeed !== bIsSeed) return aIsSeed - bIsSeed;
      return a.rawCount - b.rawCount || a.name.localeCompare(b.name);
    });

    if (this.buffCountBadge) this.buffCountBadge.textContent = `${buffList.length}개 ▼`;

    const allTimelineSkills = Array.from(timelineCountMap.keys()).sort();
    if (this.burstTriggerSkillSelect) {
      const buffOpts = buffList.map(b => `<option value="${b.name}">${b.category === '시드링' ? '💍' : '🛡️'} ${b.name} (${b.rawCount}회)</option>`).join('');
      const otherOpts = allTimelineSkills
        .filter(s => !buffSkillSet.has(s))
        .map(s => `<option value="${s}">⚔️ ${s} (${timelineCountMap.get(s)}회)</option>`)
        .join('');

      this.burstTriggerSkillSelect.innerHTML =
        `<optgroup label="분리된 시드링 / 버프">${buffOpts || '<option disabled>버프 없음</option>'}</optgroup>` +
        `<optgroup label="공격 / 소환 / 설치 스킬">${otherOpts}</optgroup>`;

      if (!this.currentBurstTriggerSkill || !timelineCountMap.has(this.currentBurstTriggerSkill)) {
        const restraint = buffList.find(b => b.name.includes('리스트레인트') || b.category === '시드링');
        if (restraint) this.currentBurstTriggerSkill = restraint.name;
        else if (buffList.length > 0) this.currentBurstTriggerSkill = buffList[0].name;
        else if (allTimelineSkills.length > 0) this.currentBurstTriggerSkill = allTimelineSkills[0];
        else this.currentBurstTriggerSkill = '';
      }
      this.burstTriggerSkillSelect.value = this.currentBurstTriggerSkill;
    }

    if (this.separatedBuffListContainer) {
      if (buffList.length === 0) {
        this.separatedBuffListContainer.innerHTML = `<div class="empty-msg" style="padding: 8px; font-size: 11px;">분리된 버프/시드링 스킬이 없습니다.</div>`;
      } else {
        this.separatedBuffListContainer.innerHTML = buffList.map(b => {
          const isActive = b.name === this.currentBurstTriggerSkill;
          return `
            <div class="buff-pill ${isActive ? 'active-trigger' : ''}" data-buff="${b.name}">
              <span>${b.category === '시드링' ? '💍' : '🛡️'} ${b.name} (${b.rawCount}회)</span>
              <button type="button" class="pill-reclassify-btn" data-reclass="${b.name}">⚔️공격전환</button>
            </div>
          `;
        }).join('');

        this.separatedBuffListContainer.querySelectorAll('.buff-pill').forEach(pill => {
          pill.addEventListener('click', (e) => {
            if (e.target.classList.contains('pill-reclassify-btn')) return;
            this.currentBurstTriggerSkill = pill.dataset.buff;
            this.selectedBurstRound = 'ALL';
            if (this.burstTriggerSkillSelect) this.burstTriggerSkillSelect.value = this.currentBurstTriggerSkill;
            this.highlightActiveBuffPill();
            this.renderDetailSkillsTable(rec);
            this.renderBurstWindowAnalysis(rec, true);
          });
        });

        this.separatedBuffListContainer.querySelectorAll('.pill-reclassify-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.setManualSkillCategory(btn.dataset.reclass, '공격');
          });
        });
      }
    }

    this.renderSkillClassifierTable(rec);
    this.renderBurstWindowAnalysis(rec, true);
  }

  renderSkillClassifierTable(rec) {
    if (!this.skillClassifierTableBody || !rec) return;
    const { damageRateMap, timelineCountMap, categoryMap, allSkillNames } = this.classifySkillsOfRecord(rec);
    const filterCat = this.skillDbCategoryFilter ? this.skillDbCategoryFilter.value : 'ALL';

    const list = Array.from(allSkillNames).map(sName => {
      const cat = categoryMap.get(sName) || '공격';
      const dbEntry = this.skillClassificationDb[sName] || {};
      const meta = (rec.skillMeta && rec.skillMeta[sName]) || dbEntry;
      return {
        name: sName,
        category: cat,
        manual: Boolean(dbEntry.manual),
        grade: meta.grade || '-',
        dmgRate: damageRateMap.get(sName) || 0,
        useCount: timelineCountMap.get(sName) || 0
      };
    });

    if (this.skillDbCountBadge) this.skillDbCountBadge.textContent = `총 ${list.length}개 스킬 ▼`;
    const filtered = filterCat === 'ALL' ? list : list.filter(item => item.category === filterCat);
    filtered.sort((a, b) => b.dmgRate - a.dmgRate || b.useCount - a.useCount);

    if (filtered.length === 0) {
      this.skillClassifierTableBody.innerHTML = `<tr><td colspan="3" class="empty-msg">해당 분류의 스킬이 없습니다.</td></tr>`;
      return;
    }

    const categories = ['공격', '버프', '시드링', '소환', '설치'];
    this.skillClassifierTableBody.innerHTML = filtered.map(item => `
      <tr>
        <td>
          <strong>${item.name}</strong>
          <span style="font-size: 10px; color: #a0aec0; margin-left: 4px;">(${item.dmgRate}% / ${item.useCount}회)</span>
          ${item.manual ? '<span style="color:#f6ad55; font-size:9px; margin-left:4px;">[수동]</span>' : ''}
        </td>
        <td style="color: #cbd5e0;">${item.grade}</td>
        <td>
          <select class="skill-cat-select" data-skill="${item.name}" style="font-size: 11px; padding: 2px 4px; width: 100%; background: #141821; color: #fff; border: 1px solid #4a5568; border-radius: 4px;">
            ${categories.map(c => `<option value="${c}" ${item.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </td>
      </tr>
    `).join('');

    this.skillClassifierTableBody.querySelectorAll('.skill-cat-select').forEach(sel => {
      sel.addEventListener('change', (e) => this.setManualSkillCategory(sel.dataset.skill, e.target.value));
    });
  }

  highlightActiveBuffPill() {
    if (!this.separatedBuffListContainer) return;
    this.separatedBuffListContainer.querySelectorAll('.buff-pill').forEach(pill => {
      pill.classList.toggle('active-trigger', pill.dataset.buff === this.currentBurstTriggerSkill);
    });
  }

  renderBurstWindowAnalysis(rec, rebuildRoundDropdown = false) {
    if (!this.burstWindowsAccordionContainer || !this.burstSummaryContainer || !rec) return;
    const evalRes = this.evaluateBurstAttributionFormula(rec, this.currentBurstTriggerSkill, this.burstWindowSeconds);
    this.renderBurstSkillSaveBanners();

    if (evalRes.skillBreakdown.size === 0) {
      this.burstSummaryContainer.innerHTML = '';
      this.burstWindowsAccordionContainer.innerHTML = `<div class="empty-msg" style="padding: 14px; text-align: center;">분석할 스킬 데이터가 없습니다.</div>`;
      return;
    }

    const activeCutoff = Number(this.burstCutoffInput?.value) || 50.0;
    const isBurstClass = evalRes.totalBurstShare >= activeCutoff;
    const roleVerdictBadge = isBurstClass
      ? `<span style="color:#fc8181; font-weight:bold;">[🔥극딜 직업 (≥${activeCutoff}%)]</span>`
      : `<span style="color:#63b3ed; font-weight:bold;">[🔄평딜 직업 (&lt;${activeCutoff}%)]</span>`;

    const omegaModeBadge = evalRes.isBuffCentricClass
      ? `<span style="color:#fbd38d;" title="순수 극딜기 합계(${evalRes.pureActiveBurstSum}%)가 25% 미만으로 판별되어 주력기/사출기에 상향 배율 적용">⚡버프형 5차 보정(순수극딜합 ${evalRes.pureActiveBurstSum}% &lt; 25%)</span>`
      : `<span style="color:#a0aec0;">일반 극딜 구조(순수극딜합 ${evalRes.pureActiveBurstSum}% ≥ 25%)</span>`;

    this.burstSummaryContainer.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; background: #141821; border: 1px solid #2d3748; padding: 7px 10px; border-radius: 6px; font-size: 11px;">
        <div>
          <span>🔥 기준: <strong>${evalRes.triggerName}</strong> ([-3초~+${this.burstWindowSeconds - 3}초] × ${evalRes.windows.length}회)</span>
          <span style="margin-left: 8px;">${omegaModeBadge}</span>
        </div>
        <div>
          <span>최종 30초 극딜 귀속 비중: <strong style="color:#f6ad55; font-size:13px;">${evalRes.totalBurstShare}%</strong> ${roleVerdictBadge}</span>
        </div>
      </div>
    `;

    if (this.burstRoundSelect && rebuildRoundDropdown) {
      const roundOpts = evalRes.windows.map(w =>
        `<option value="${w.round}">${w.round}회차 극딜 구간 (${w.startSecStr}초 ~ ${w.endSecStr}초)</option>`
      ).join('');
      this.burstRoundSelect.innerHTML =
        `<option value="ALL">🔥 전체 주기 합산 (30초 극딜 공식 표준)</option>` + roundOpts;
      this.burstRoundSelect.value = this.selectedBurstRound;
    }

    const activeSelected = this.selectedSkills;

    if (this.selectedBurstRound === 'ALL') {
      const list = Array.from(evalRes.skillBreakdown.values()).sort((a, b) => b.D_i_30 - a.D_i_30);
      let selectedBurstSum = 0;
      list.forEach(item => {
        if (activeSelected.has(item.name)) selectedBurstSum += item.D_i_30;
      });
      selectedBurstSum = Number(selectedBurstSum.toFixed(1));

      const chartValue = activeSelected.size > 0 ? selectedBurstSum : evalRes.totalBurstShare;
      const clamped = Math.min(100, Math.max(0, chartValue));
      const donutSvg = `<circle cx="21" cy="21" r="15.9155" fill="transparent" stroke="${chartValue >= activeCutoff ? '#e53e3e' : '#3182ce'}" stroke-width="4" stroke-dasharray="${clamped} ${100 - clamped}" stroke-dashoffset="100" />`;

      this.burstWindowsAccordionContainer.innerHTML = `
        <div class="timeline-accordion-item open">
          <div class="timeline-accordion-header" onclick="this.parentElement.classList.toggle('open')">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div class="donut-chart-wrap" style="width: 36px; height: 36px; position: relative;">
                <svg viewBox="0 0 42 42" style="width: 36px; height: 36px; transform: rotate(-90deg);">
                  <circle cx="21" cy="21" r="15.9155" fill="transparent" stroke="#2d3748" stroke-width="4"></circle>
                  ${donutSvg}
                </svg>
                <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: bold; color: #fff;">
                  ${Math.round(chartValue)}%
                </div>
              </div>
              <div>
                <span style="font-weight: bold; color: #fff; font-size: 12px;">🎯 스킬별 30초 극딜 귀속량 상세 내역</span>
                <span class="sub-info" style="display: block; font-size: 11px; color: #63b3ed;">
                  ${activeSelected.size > 0 ? `선택 스킬(${activeSelected.size}개) 극딜 귀속 합계: ${selectedBurstSum}%` : `전체 스킬 30초 극딜 귀속 합계: ${evalRes.totalBurstShare}%`}
                </span>
              </div>
            </div>
            <span class="sub-info" style="font-size: 11px;">총 ${list.length}개 딜 스킬 ▼</span>
          </div>
          <div class="timeline-accordion-body">
            <table class="data-table ext-table">
              <thead>
                <tr>
                  <th>스킬명 (클릭 시 선택)</th>
                  <th>전체 점유율</th>
                  <th>시전(극딜30초 / 평딜90초)</th>
                  <th>버프 배율</th>
                  <th>30초 극딜 귀속량</th>
                </tr>
              </thead>
              <tbody>
                ${list.map(item => {
                  const isHighlighted = activeSelected.has(item.name);
                  const castText = item.formulaType === 'passive_time'
                    ? `<span style="color:#a0aec0;">시간비례(30:90)</span>`
                    : `<strong>${item.n30}회</strong> / ${item.n90}회`;
                  return `
                    <tr class="skill-selectable-row ${isHighlighted ? 'selected-skill-row' : ''}" data-skill="${item.name}">
                      <td style="font-size: 12px;"><strong>${item.name}</strong></td>
                      <td style="color:#cbd5e0;">${item.D_i}%</td>
                      <td style="font-size: 11px;">${castText}</td>
                      <td style="color:${item.omega > 2.0 ? '#fbd38d' : '#63b3ed'}; font-weight:bold;">×${item.omega}</td>
                      <td><strong style="color:#4fd1c5; font-size:12px;">${item.D_i_30}%</strong></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else {
      const targetW = evalRes.windows.find(w => w.round === String(this.selectedBurstRound)) || evalRes.windows[0];
      const timelines = rec.timeline || [];
      const { buffSkillSet } = this.classifySkillsOfRecord(rec);
      const events = timelines.filter(t => {
        const ms = Number(t?.elapse_time) || 0;
        return ms >= targetW.startMs && ms <= targetW.endMs && !buffSkillSet.has(t?.skill_name);
      });

      const cntMap = new Map();
      events.forEach(e => cntMap.set(e.skill_name, (cntMap.get(e.skill_name) || 0) + 1));
      const skillList = Array.from(cntMap.entries()).map(([name, count]) => ({
        name,
        count,
        rate: events.length > 0 ? Number(((count / events.length) * 100).toFixed(1)) : 0,
        D_i_30: evalRes.skillBreakdown.get(name)?.D_i_30 || 0
      })).sort((a, b) => b.count - a.count);

      this.burstWindowsAccordionContainer.innerHTML = `
        <div class="timeline-accordion-item open">
          <div class="timeline-accordion-header" onclick="this.parentElement.classList.toggle('open')">
            <span style="font-weight: bold; color: #fff; font-size: 12px;">🎯 ${targetW.round}회차 극딜 구간 (${targetW.startSecStr}초 ~ ${targetW.endSecStr}초)</span>
            <span class="sub-info" style="font-size: 11px;">총 ${events.length}회 시전 ▼</span>
          </div>
          <div class="timeline-accordion-body">
            <table class="data-table ext-table">
              <thead>
                <tr>
                  <th>스킬명</th>
                  <th>회차 내 시전 비중</th>
                  <th>시전 횟수</th>
                  <th>전체 30초 극딜 귀속량</th>
                </tr>
              </thead>
              <tbody>
                ${skillList.map(s => {
                  const isHighlighted = activeSelected.has(s.name);
                  return `
                    <tr class="skill-selectable-row ${isHighlighted ? 'selected-skill-row' : ''}" data-skill="${s.name}">
                      <td><strong>${s.name}</strong></td>
                      <td>${s.rate}%</td>
                      <td><strong>${s.count}회</strong></td>
                      <td style="color:#4fd1c5; font-weight:bold;">${s.D_i_30}%</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    this.burstWindowsAccordionContainer.querySelectorAll('.skill-selectable-row').forEach(row => {
      row.addEventListener('click', () => this.toggleSkillSelection(row.dataset.skill));
    });
  }

  renderDetailSkillsTable(rec) {
    if (!this.bpSkillTableBody || !rec) return;
    if (!rec.skills || rec.skills.length === 0) {
      this.bpSkillTableBody.innerHTML = `<tr><td colspan="6" class="empty-msg">스킬 통계 데이터가 없습니다.</td></tr>`;
      return;
    }

    const evalRes = this.evaluateBurstAttributionFormula(rec, this.currentBurstTriggerSkill, this.burstWindowSeconds);
    const sortedSkills = [...rec.skills];

    this.bpSkillTableBody.innerHTML = sortedSkills.map(s => {
      const isSelected = this.selectedSkills.has(s.name);
      const cat = this.getSkillCategory(s.name, rec);
      const bItem = evalRes.skillBreakdown.get(s.name);
      const castInfo = bItem
        ? (bItem.formulaType === 'passive_time' ? '시간비례(30:90)' : `${bItem.n30}회 / ${bItem.n90}회`)
        : '-';
      const omegaInfo = bItem ? `×${bItem.omega}` : '-';
      const d30Info = bItem ? `${bItem.D_i_30}%` : '-';

      return `
        <tr class="skill-selectable-row ${isSelected ? 'selected-skill-row' : ''}" data-skill="${s.name}">
          <td>
            <strong>${s.name}</strong>
            ${isSelected ? '<span style="color: #63b3ed; font-size: 11px; margin-left: 6px;">(선택됨)</span>' : ''}
          </td>
          <td><span class="cat-badge cat-${cat}">${cat}</span></td>
          <td style="font-size: 11px; color: #cbd5e0;">${castInfo}</td>
          <td style="font-size: 11px; color: #fbd38d; font-weight: bold;">${omegaInfo}</td>
          <td>
            <div class="rate-bar-wrap">
              <div class="rate-bar-bg">
                <div class="rate-bar-fill" style="width: ${Math.min(100, Math.max(0, s.rate))}%"></div>
              </div>
              <span class="rate-text">${s.rate}%</span>
            </div>
          </td>
          <td><strong style="color: #4fd1c5;">${d30Info}</strong> <span style="font-size:10px; color:#a0aec0;">(${s.useCount.toLocaleString()}회)</span></td>
        </tr>
      `;
    }).join('');

    this.bpSkillTableBody.querySelectorAll('.skill-selectable-row').forEach(row => {
      row.addEventListener('click', () => this.toggleSkillSelection(row.dataset.skill));
    });
  }

  buildTimelineSkillCheckboxes(rec) {
    if (!this.timelineSkillDropdownContent || !this.timelineSkillDropdownBtn || !rec) return;
    const skillSet = new Set();
    (rec.timeline || []).forEach(t => { if (t && t.skill_name) skillSet.add(t.skill_name); });
    (rec.skills || []).forEach(s => { if (s && s.name) skillSet.add(s.name); });
    const uniqueSkills = Array.from(skillSet).sort();

    this.timelineSkillDropdownContent.innerHTML = `
      <div style="padding: 6px 10px; border-bottom: 1px solid #2d3748; display: flex; justify-content: space-between; font-size: 11px;">
        <span id="selectAllSkills" style="color: #63b3ed; cursor: pointer;">전체 선택</span>
        <span id="clearAllSkills" style="color: #a0aec0; cursor: pointer;">선택 해제</span>
      </div>
      <div style="max-height: 200px; overflow-y: auto; padding: 4px 0;">
        ${uniqueSkills.map(sName => `
          <label style="display: flex; align-items: center; gap: 8px; padding: 4px 10px; cursor: pointer; font-size: 12px; color: #e2e8f0;">
            <input type="checkbox" class="skill-checkbox" value="${sName}" ${this.selectedSkills.has(sName) ? 'checked' : ''}>
            <span>${sName}</span>
          </label>
        `).join('')}
      </div>
    `;

    this.timelineSkillDropdownContent.querySelectorAll('.skill-checkbox').forEach(chk => {
      chk.addEventListener('change', (e) => {
        if (e.target.checked) this.selectedSkills.add(e.target.value);
        else this.selectedSkills.delete(e.target.value);
        this.customBurstRateInputVal = null;
        this.updateDropdownButtonLabel();
        if (this.currentSelectedRecord) {
          this.renderDetailSkillsTable(this.currentSelectedRecord);
          this.renderTimelineSection(this.currentSelectedRecord);
          this.renderBurstWindowAnalysis(this.currentSelectedRecord);
        }
        this.renderBurstSkillSaveBanners();
      });
    });

    const selAllBtn = this.timelineSkillDropdownContent.querySelector('#selectAllSkills');
    if (selAllBtn) {
      selAllBtn.addEventListener('click', () => {
        uniqueSkills.forEach(s => this.selectedSkills.add(s));
        this.customBurstRateInputVal = null;
        this.timelineSkillDropdownContent.querySelectorAll('.skill-checkbox').forEach(c => c.checked = true);
        this.updateDropdownButtonLabel();
        if (this.currentSelectedRecord) {
          this.renderDetailSkillsTable(this.currentSelectedRecord);
          this.renderTimelineSection(this.currentSelectedRecord);
          this.renderBurstWindowAnalysis(this.currentSelectedRecord);
        }
        this.renderBurstSkillSaveBanners();
      });
    }

    const clrAllBtn = this.timelineSkillDropdownContent.querySelector('#clearAllSkills');
    if (clrAllBtn) {
      clrAllBtn.addEventListener('click', () => {
        this.selectedSkills.clear();
        this.customBurstRateInputVal = null;
        this.timelineSkillDropdownContent.querySelectorAll('.skill-checkbox').forEach(c => c.checked = false);
        this.updateDropdownButtonLabel();
        if (this.currentSelectedRecord) {
          this.renderDetailSkillsTable(this.currentSelectedRecord);
          this.renderTimelineSection(this.currentSelectedRecord);
          this.renderBurstWindowAnalysis(this.currentSelectedRecord);
        }
        this.renderBurstSkillSaveBanners();
      });
    }

    this.updateDropdownButtonLabel();
  }

  updateDropdownButtonLabel() {
    if (!this.timelineSkillDropdownBtn) return;
    if (this.selectedSkills.size === 0) {
      this.timelineSkillDropdownBtn.textContent = '전체 스킬 (선택 없음)';
    } else {
      const first = Array.from(this.selectedSkills)[0];
      this.timelineSkillDropdownBtn.textContent = this.selectedSkills.size === 1
        ? first
        : `${first} 외 ${this.selectedSkills.size - 1}개`;
    }
  }

  buildTimelineBucketsHtml(timelines, intervalSec, divisorCount = 1, isAverageMode = false) {
    const intervalMs = intervalSec * 1000;
    const maxTimeSec = 360;
    const totalBuckets = Math.ceil(maxTimeSec / intervalSec);

    const buckets = new Map();
    for (let i = 0; i < totalBuckets; i++) {
      const startTime = i * intervalSec;
      const endTime = Math.min((i + 1) * intervalSec, maxTimeSec);
      buckets.set(`${startTime}-${endTime}`, { startTime, endTime, totalCount: 0, skillCounts: new Map() });
    }

    timelines.forEach(t => {
      if (!t) return;
      const rawMs = Number(t.elapse_time) || 0;
      const clampedMs = Math.min(rawMs, maxTimeSec * 1000 - 1);
      const bucketIndex = Math.max(0, Math.floor(clampedMs / intervalMs));
      const startTime = bucketIndex * intervalSec;
      const endTime = Math.min((bucketIndex + 1) * intervalSec, maxTimeSec);
      const bucketKey = `${startTime}-${endTime}`;
      const bucket = buckets.get(bucketKey);
      if (bucket) {
        bucket.totalCount++;
        const sName = t.skill_name || '미분류 스킬';
        bucket.skillCounts.set(sName, (bucket.skillCounts.get(sName) || 0) + 1);
      }
    });

    const sortedBuckets = Array.from(buckets.values()).filter(b => b.totalCount > 0).sort((a, b) => a.startTime - b.startTime);
    const activeSelected = this.selectedSkills;

    return sortedBuckets.map((b) => {
      const avgTotalCount = isAverageMode ? Number((b.totalCount / divisorCount).toFixed(1)) : b.totalCount;
      const skillList = Array.from(b.skillCounts.entries())
        .map(([name, rawCount]) => ({
          name,
          count: isAverageMode ? Number((rawCount / divisorCount).toFixed(1)) : rawCount,
          rate: Number(((rawCount / b.totalCount) * 100).toFixed(1))
        }))
        .sort((a, b) => b.count - a.count);

      let combinedRate = 0, combinedCount = 0;
      if (activeSelected.size > 0) {
        skillList.forEach(s => {
          if (activeSelected.has(s.name)) {
            combinedRate += s.rate;
            combinedCount += s.count;
          }
        });
        combinedRate = Number(combinedRate.toFixed(1));
        combinedCount = isAverageMode ? Number(combinedCount.toFixed(1)) : combinedCount;
      } else {
        combinedRate = skillList.length > 0 ? skillList[0].rate : 0;
      }

      const topSkillName = skillList.length > 0 ? skillList[0].name : '-';
      const topSkillRate = skillList.length > 0 ? skillList[0].rate : 0;
      const headerSubText = activeSelected.size > 0
        ? `선택 스킬 합산: ${combinedRate}% (${isAverageMode ? '평균 ' : ''}${combinedCount}회)`
        : `1위: ${topSkillName} (${topSkillRate}%)`;

      const clampedRate = Math.min(100, Math.max(0, activeSelected.size > 0 ? combinedRate : topSkillRate));
      const donutSegments = `<circle cx="21" cy="21" r="15.9155" fill="transparent" stroke="#3182ce" stroke-width="4" stroke-dasharray="${clampedRate} ${100 - clampedRate}" stroke-dashoffset="100" />`;

      return `
        <div class="timeline-accordion-item open">
          <div class="timeline-accordion-header" onclick="this.parentElement.classList.toggle('open')">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div class="donut-chart-wrap" style="width: 38px; height: 38px; position: relative;">
                <svg viewBox="0 0 42 42" style="width: 38px; height: 38px; transform: rotate(-90deg);">
                  <circle cx="21" cy="21" r="15.9155" fill="transparent" stroke="#2d3748" stroke-width="4"></circle>
                  ${donutSegments}
                </svg>
                <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: bold; color: #fff;">
                  ${Math.round(clampedRate)}%
                </div>
              </div>
              <div>
                <span style="font-weight: bold; color: #fff;">⏱️ ${b.startTime}초 - ${b.endTime}초 구간</span>
                <span class="sub-info" style="display: block; font-size: 11px; color: ${activeSelected.size > 0 ? '#63b3ed' : '#a0aec0'};">${headerSubText}</span>
              </div>
            </div>
            <span class="sub-info">${isAverageMode ? `평균 ${avgTotalCount}회 입력` : `총 ${avgTotalCount}회 입력`} ▼</span>
          </div>
          <div class="timeline-accordion-body">
            <table class="data-table">
              <thead>
                <tr>
                  <th>스킬명 (클릭 시 선택/해제)</th>
                  <th style="width: 200px;">구간 점유율 (%)</th>
                  <th>${isAverageMode ? '평균 사용 횟수' : '사용 횟수'}</th>
                </tr>
              </thead>
              <tbody>
                ${skillList.map(s => {
                  const isHighlighted = activeSelected.has(s.name);
                  return `
                    <tr class="skill-selectable-row ${isHighlighted ? 'selected-skill-row' : ''}" data-skill="${s.name}">
                      <td><strong>${s.name}</strong> ${isHighlighted ? '<span style="color: #63b3ed; font-size: 11px;">(선택됨)</span>' : ''}</td>
                      <td>
                        <div class="rate-bar-wrap">
                          <div class="rate-bar-bg"><div class="rate-bar-fill" style="width: ${Math.min(100, Math.max(0, s.rate))}%"></div></div>
                          <span class="rate-text">${s.rate}%</span>
                        </div>
                      </td>
                      <td><strong>${s.count}회</strong></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');
  }

  renderTimelineSection(rec) {
    if (!this.timelineAccordionContainer || !rec) return;
    let timelines = rec.timeline || [];
    if (timelines.length === 0) {
      this.timelineAccordionContainer.innerHTML = `<div class="empty-msg" style="padding: 20px; text-align: center;">이 기록에는 스킬 타임라인 데이터가 없습니다.</div>`;
      return;
    }

    if (this.hideBuffsInMainTimeline) {
      const { buffSkillSet } = this.classifySkillsOfRecord(rec);
      timelines = timelines.filter(t => t && !buffSkillSet.has(t.skill_name));
    }

    this.timelineAccordionContainer.innerHTML = this.buildTimelineBucketsHtml(timelines, this.currentTimelineInterval, 1, false);
    this.timelineAccordionContainer.querySelectorAll('.skill-selectable-row').forEach(row => {
      row.addEventListener('click', () => this.toggleSkillSelection(row.dataset.skill));
    });
  }

  updateJobFilterDropdown() {
    if (!this.rankJobFilter) return;
    const allRecs = Array.from(this.recordsDb.values());
    const jobs = Array.from(new Set(allRecs.map(r => r?.job))).filter(Boolean).sort();
    const curVal = this.rankJobFilter.value;
    this.rankJobFilter.innerHTML = `<option value="ALL">전체 직업 보기</option>` + jobs.map(j => `<option value="${j}">${j}</option>`).join('');
    this.rankJobFilter.value = jobs.includes(curVal) ? curVal : 'ALL';
  }

  updateAllRecordsTable() {
    let allRecs = Array.from(this.recordsDb.values()).filter(Boolean);
    const selectedJob = this.rankJobFilter ? this.rankJobFilter.value : 'ALL';
    if (selectedJob !== 'ALL') allRecs = allRecs.filter(r => Utils.isSameJob(r.job, selectedJob));

    if (!this.allRecordsBody) return;
    if (allRecs.length === 0) {
      this.allRecordsBody.innerHTML = `<tr><td colspan="7" class="empty-msg">선택한 직업(${selectedJob})의 조회된 개별 기록이 없습니다.</td></tr>`;
      return;
    }
    allRecs.sort((a, b) => b.dps - a.dps);
    this.allRecordsBody.innerHTML = allRecs.map((r, idx) => `
      <tr class="clickable-row" data-replay="${r.replayId}">
        <td><strong>${idx + 1}</strong></td>
        <td><strong>${r.charName}</strong></td>
        <td>${r.job} (Lv.${r.level})</td>
        <td class="blue-dps">${Utils.formatKoreanNumber(r.dps)}</td>
        <td>${r.combatPower > 0 ? Utils.formatKoreanNumber(r.combatPower) : '-'}</td>
        <td class="orange-eff">${r.efficiency > 0 ? r.efficiency.toLocaleString() : '-'}</td>
        <td class="sub-info">${Utils.formatShortDate(r.recordDate || r.collectedAt)}</td>
      </tr>
    `).join('');

    this.allRecordsBody.querySelectorAll('[data-replay]').forEach(el => {
      el.addEventListener('click', () => {
        const rec = Array.from(this.recordsDb.values()).find(r => r && r.replayId === el.dataset.replay);
        if (rec) this.renderDetailView(rec);
      });
    });
  }

  updateChuchuRankTable() {
    let allRecs = Array.from(this.recordsDb.values()).filter(Boolean);
    const selectedJob = this.rankJobFilter ? this.rankJobFilter.value : 'ALL';
    if (selectedJob !== 'ALL') allRecs = allRecs.filter(r => Utils.isSameJob(r.job, selectedJob));

    if (this.totalRecordBadge) this.totalRecordBadge.textContent = allRecs.length;
    if (!this.chuchuRankBody) return;
    if (allRecs.length === 0) {
      this.chuchuRankBody.innerHTML = `<tr><td colspan="7" class="empty-msg">선택한 직업(${selectedJob})의 연무장 기록이 없습니다.</td></tr>`;
      return;
    }

    const jobMap = new Map();
    allRecs.forEach(r => {
      const job = r.job || '미분류';
      if (!jobMap.has(job)) jobMap.set(job, { job, records: [], sumDps: 0, sumCp: 0, sumEff: 0 });
      const g = jobMap.get(job);
      g.records.push(r);
      g.sumDps += r.dps || 0;
      g.sumCp += r.combatPower || 0;
      g.sumEff += r.efficiency || 0;
    });

    const rankList = Array.from(jobMap.values()).map(g => {
      const cnt = g.records.length;
      const avgDps = Math.round(g.sumDps / cnt);
      const avgCp = Math.round(g.sumCp / cnt);
      const avgEff = avgCp > 0 ? Math.round(avgDps / avgCp) : Math.round(g.sumEff / cnt);
      g.records.sort((a, b) => b.dps - a.dps);
      return { job: g.job, avgDps, avgCp, avgEff, count: cnt, bestRecord: g.records[0] };
    });

    rankList.sort((a, b) => b.avgEff - a.avgEff || b.avgDps - a.avgDps);
    const activeCutoff = Number(this.burstCutoffInput?.value) || 50.0;

    this.chuchuRankBody.innerHTML = rankList.map((item, idx) => {
      const aliases = JOB_NAME_ALIASES[item.job] || [item.job];
      const statKey = aliases.find(k => this.jobBurstStatsCache.has(k)) || item.job;
      const bStat = this.jobBurstStatsCache.get(statKey);
      let roleLabel = `<span style="color:#718096; font-size:10px; margin-left:6px;">[미분류]</span>`;
      if (bStat && bStat.avgBurstRate !== null) {
        const savedMark = bStat.isManualSaved ? '💾' : (bStat.isBuffCentric ? '⚡' : '');
        roleLabel = bStat.avgBurstRate >= activeCutoff
          ? `<span style="color:#fc8181; font-size:10px; margin-left:6px;">[${savedMark}🔥극딜 ${bStat.avgBurstRate}%]</span>`
          : `<span style="color:#63b3ed; font-size:10px; margin-left:6px;">[${savedMark}🔄평딜 ${bStat.avgBurstRate}%]</span>`;
      }

      return `
        <tr class="clickable-row" data-replay="${item.bestRecord.replayId}">
          <td><strong>${idx + 1}</strong></td>
          <td><strong>${item.job}</strong>${roleLabel}</td>
          <td>${item.bestRecord.charName}</td>
          <td class="blue-dps">${Utils.formatKoreanNumber(item.avgDps)}</td>
          <td>${item.avgCp > 0 ? Utils.formatKoreanNumber(item.avgCp) : '-'}</td>
          <td class="orange-eff">${item.avgEff.toLocaleString()}</td>
          <td>${item.count} 개</td>
        </tr>
      `;
    }).join('');

    this.chuchuRankBody.querySelectorAll('[data-replay]').forEach(el => {
      el.addEventListener('click', () => {
        const rec = Array.from(this.recordsDb.values()).find(r => r && r.replayId === el.dataset.replay);
        if (rec) this.renderDetailView(rec);
      });
    });
  }

  updateTop20SkillsTable() {
    if (!this.top20SkillsBody) return;
    let allRecs = Array.from(this.recordsDb.values()).filter(Boolean);
    const selectedJob = this.rankJobFilter ? this.rankJobFilter.value : 'ALL';
    if (selectedJob !== 'ALL') allRecs = allRecs.filter(r => Utils.isSameJob(r.job, selectedJob));

    this.renderBurstSkillSaveBanners();

    if (allRecs.length === 0) {
      this.top20SkillsBody.innerHTML = `<tr><td colspan="4" class="empty-msg">선택한 직업(${selectedJob})의 조회된 기록이 없습니다.</td></tr>`;
      if (this.top20TimelineAccordionContainer) {
        this.top20TimelineAccordionContainer.innerHTML = `<div class="empty-msg" style="padding: 20px; text-align: center;">선택한 직업의 타임라인 데이터가 없습니다.</div>`;
      }
      return;
    }

    const skillMap = new Map();
    allRecs.forEach(r => {
      (r.skills || []).forEach(s => {
        if (!s || !s.name) return;
        if (!skillMap.has(s.name)) skillMap.set(s.name, { name: s.name, sumUse: 0, sumRate: 0, count: 0 });
        const obj = skillMap.get(s.name);
        obj.sumUse += s.useCount || 0;
        obj.sumRate += s.rate || 0;
        obj.count += 1;
      });
    });

    let skillList = Array.from(skillMap.values()).map(s => ({
      name: s.name,
      use: Math.round(s.sumUse / s.count),
      rate: Number((s.sumRate / s.count).toFixed(2))
    }));

    skillList.sort((a, b) => b[this.top20SortKey] - a[this.top20SortKey]);
    const top20 = skillList.slice(0, 20);

    this.top20SkillsBody.innerHTML = top20.map((s, idx) => {
      const isSelected = this.selectedSkills.has(s.name);
      return `
        <tr class="skill-selectable-row ${isSelected ? 'selected-skill-row' : ''}" data-skill="${s.name}">
          <td><strong>${idx + 1}</strong></td>
          <td><strong>${s.name}</strong> ${isSelected ? '<span style="color: #63b3ed; font-size: 11px;">(선택됨)</span>' : ''}</td>
          <td>${s.use.toLocaleString()}회</td>
          <td class="orange-eff">${s.rate}%</td>
        </tr>
      `;
    }).join('');

    this.top20SkillsBody.querySelectorAll('.skill-selectable-row').forEach(row => {
      row.addEventListener('click', () => this.toggleSkillSelection(row.dataset.skill));
    });

    if (this.top20TimelineAccordionContainer) {
      const recordsWithTimeline = allRecs.filter(r => Array.isArray(r.timeline) && r.timeline.length > 0);
      if (recordsWithTimeline.length === 0) {
        this.top20TimelineAccordionContainer.innerHTML = `<div class="empty-msg" style="padding: 20px; text-align: center;">수집된 타임라인 데이터가 없습니다.</div>`;
      } else {
        const mergedTimelines = [];
        for (let i = 0; i < recordsWithTimeline.length; i++) {
          const tl = recordsWithTimeline[i].timeline;
          for (let j = 0; j < tl.length; j++) {
            mergedTimelines.push(tl[j]);
          }
        }
        this.top20TimelineAccordionContainer.innerHTML = this.buildTimelineBucketsHtml(
          mergedTimelines,
          this.top20TimelineInterval,
          recordsWithTimeline.length,
          true
        );
        this.top20TimelineAccordionContainer.querySelectorAll('.skill-selectable-row').forEach(row => {
          row.addEventListener('click', () => this.toggleSkillSelection(row.dataset.skill));
        });
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => { new MapleDashboardApp(); });