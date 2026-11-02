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

/**
 * ============================================================================
 * [메이플스토리 공식 연계 직업 8종 고정 DB (STRICT_COMBO_JOBS_DB)]
 * - 질문 6 ("연계직업이 좋은가?")에서 '아니오' 선택 시 아래 8개 직업은
 *   추천 결과 및 시뮬레이터 목록에서 100% 제외(숨김)됩니다.
 * ============================================================================
 */
const STRICT_COMBO_JOBS_DB = {
  '카데나': {
    weapon: '체인 (도적)',
    feature: '짧은 쿨타임의 다양한 무기를 연계해 화력을 뿜어내며, 피지컬과 숙련도에 따른 고점 차이가 매우 큽니다.'
  },
  '블래스터': {
    weapon: '건틀릿 리볼버 (전사)',
    feature: '일정한 리듬에 맞춰 스킬을 연타하는 캔슬 플레이가 필수적이며, 조작 성공 시 화력 리턴이 확실합니다.'
  },
  '칼리': {
    weapon: '차크람 (도적)',
    feature: '아츠-보이드 캔슬-헥스로 이어지는 스타일리쉬한 연계를 사용하며, 기동성과 속도감이 뛰어납니다.'
  },
  '에반': {
    weapon: '완드/스태프 (마법사)',
    feature: '에반 본인과 미르(드래곤)의 스킬을 번갈아 사용하며, 다수의 융합 커맨드와 거리 조절이 필요합니다.'
  },
  '제로': {
    weapon: '대검/태도 (전사)',
    feature: '알파와 베타 두 캐릭터를 교대하며 태그(연계) 플레이를 수행합니다.'
  },
  '메르세데스': {
    weapon: '듀얼보우건 (궁수)',
    feature: '공중 체공 및 연계 스킬 사용 시 주요 스킬의 쿨타임이 줄어드는 구조를 가지고 있습니다.'
  },
  '아크': {
    weapon: '너클 (해적)',
    feature: '기본 상태와 스펙터 상태를 오가며 스킬 연계를 통해 잠식 제어와 딜링을 동시에 수행합니다.'
  },
  '스트라이커': {
    weapon: '너클 (해적)',
    feature: '기본기 스킬들 간의 연계가 물 흐르듯 이어지는 해적 직업으로 타격감이 시원합니다.'
  }
};

/**
 * ============================================================================
 * [질문 1 ~ 질문 7 분기형 결정 트리 (DECISION_TREE_NODES)]
 * ============================================================================
 */
const DECISION_TREE_NODES = {
  Q1: {
    id: 'Q1',
    stepNum: 1,
    question: '질문 1. 메이플을 처음하는가?',
    subtitle: '메이플스토리 보스전 및 시스템 숙련도 확인',
    yesLabel: '⭕ 예 (처음입니다)',
    yesDesc: '질문 3 (조작 편의성)으로 이동',
    yesNext: 'Q3',
    noLabel: '❌ 아니오 (경험자입니다)',
    noDesc: '질문 2 (성능픽 여부)로 이동',
    noNext: 'Q2'
  },
  Q2: {
    id: 'Q2',
    stepNum: 2,
    question: '질문 2. 성능픽을 할 것인가?',
    subtitle: '체급·전투 효율 고점을 우선할지 여부',
    yesLabel: '⭕ 예 (성능픽 선호)',
    yesDesc: '질문 3 (조작 편의성)으로 이동',
    yesNext: 'Q3',
    noLabel: '❌ 아니오 (취향/손맛 우선)',
    noDesc: '질문 4 (손 바쁨 선호도)로 이동',
    noNext: 'Q4'
  },
  Q3: {
    id: 'Q3',
    stepNum: 3,
    question: '질문 3. 조작이 편한것을 할 것인가?',
    subtitle: '복잡한 커맨드 대신 직관적인 조작을 선호하는지 확인',
    yesLabel: '⭕ 예 (조작이 편한 직업)',
    yesDesc: '질문 5 (극딜 선호 여부)로 이동',
    yesNext: 'Q5',
    noLabel: '❌ 아니오 (조작 난이도 무관)',
    noDesc: '질문 6 (연계 직업 선호 여부)으로 이동',
    noNext: 'Q6'
  },
  Q4: {
    id: 'Q4',
    stepNum: 4,
    question: '질문 4. 손이 바쁜 직업을 할 것인가?',
    subtitle: '스킬 가용횟수 기준 정렬 vs 성능 우선 정렬 결정',
    yesLabel: '⭕ 예',
    yesDesc: '선택 캐릭터 중 스킬 가용횟수가 적은것을 내림차순으로 정렬',
    yesNext: 'RESULT_CAST_SORT',
    noLabel: '❌ 아니오',
    noDesc: '선택 캐릭터 중 성능 우선으로 정렬',
    noNext: 'RESULT_PERF_SORT'
  },
  Q5: {
    id: 'Q5',
    stepNum: 5,
    question: '질문 5. 극딜 캐릭이 좋은가?',
    subtitle: '30초 극딜 압축형(≥50%) 선호 여부 판별',
    yesLabel: '⭕ 예 (극딜 캐릭 선호)',
    yesDesc: '질문 7 (손 바쁨 선호 여부)로 이동',
    yesNext: 'Q7',
    noLabel: '❌ 아니오 (지속/평딜 포함)',
    noDesc: '질문 6 (연계 직업 선호 여부)으로 이동',
    noNext: 'Q6'
  },
  Q6: {
    id: 'Q6',
    stepNum: 6,
    question: '질문 6. 연계직업이 좋은가?',
    subtitle: '카데나·블래·칼리·에반·제로·메르·아크·스커 (8종) 포함 여부 결정',
    yesLabel: '⭕ 예 (연계 직업 좋음)',
    yesDesc: '연계 직업을 포함하여 성능 우선으로 정렬',
    yesNext: 'RESULT_PERF_SORT',
    noLabel: '❌ 아니오 (연계 직업 제외)',
    noDesc: '8대 연계 직업(카데나 등)을 완전히 제외하고 정렬',
    noNext: 'RESULT_NO_COMBO_SORT'
  },
  Q7: {
    id: 'Q7',
    stepNum: 7,
    question: '질문 7. 손이 바쁜게 좋은가?',
    subtitle: '극딜 선호 캐릭터 중 성능 우선 vs 스킬 가용횟수 정렬 결정',
    yesLabel: '⭕ 예 (손 바빠도 성능 고점)',
    yesDesc: '선택 캐릭터 중 성능 우선으로 정렬',
    yesNext: 'RESULT_PERF_SORT',
    noLabel: '❌ 아니오 (손 편한 저타수)',
    noDesc: '선택 캐릭터 중 스킬 가용횟수가 적은것을 내림차순으로 정렬',
    noNext: 'RESULT_CAST_SORT'
  }
};

const ICON_PATHS = {
  activity: `<path d="M3 12h4l2.2-7 4.2 14 2.1-7H21" />`,
  arrow: `<path d="M5 12h14M13 6l6 6-6 6" />`,
  bolt: `<path d="m13 2-9 12h8l-1 8 9-12h-8z" />`,
  chart: `<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />`,
  chevron: `<path d="m6 9 6 6 6-6" />`,
  clock: `<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />`,
  filter: `<path d="M4 5h16M7 12h10M10 19h4" />`,
  key: `<circle cx="8" cy="15" r="4" /><path d="m11 12 8-8M16 7l2 2M14 9l2 2" />`,
  layers: `<path d="m12 2 9 5-9 5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5" />`,
  search: `<circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" />`,
  shield: `<path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z" /><path d="m9 12 2 2 4-5" />`,
  spark: `<path d="m12 2 1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />`,
  target: `<circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 3v3M21 12h-3M12 21v-3M3 12h3" />`,
  users: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />`
};

function createIconSvg(name, size = 16) {
  const path = ICON_PATHS[name] || ICON_PATHS.spark;
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">${path}</svg>`;
}

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
  } catch {
    return String(num);
  }
}

class MapleLabDashboard {
  constructor() {
    this.STORAGE_KEY_CUSTOM_UTIL = 'MAPLE_SIM_CUSTOM_UTIL_DB_V3';

    this.localDb = {
      currentSeasonKey: 'season_5',
      seasons: { season_5: { name: '5기 연무장', records: [] } },
      manualSkillCategories: {},
      savedJobBurstProfiles: {},
      customJobSkills: {},
      customJobUtilityDb: {}
    };
    this.utilityDb = JSON.parse(JSON.stringify(DEFAULT_JOB_UTILITY_DB));
    this.normalizeStrictComboAttackStyles();

    // 기본 샘플 저레벨 캐릭터 풀 (API 로드 전에도 즉시 다중 선택 테스트 가능)
    this.accountCharacters = [
      { id: 'sample_1', nickname: '유니온아란', job: '아란', level: 200, world: '스카니아' },
      { id: 'sample_2', nickname: '링크메르', job: '메르세데스', level: 210, world: '스카니아' },
      { id: 'sample_3', nickname: '주보히어로', job: '히어로', level: 215, world: '스카니아' },
      { id: 'sample_4', nickname: '체급카데나', job: '카데나', level: 220, world: '스카니아' },
      { id: 'sample_5', nickname: '무적미하일', job: '미하일', level: 220, world: '스카니아' },
      { id: 'sample_6', nickname: '극딜카이저', job: '카이저', level: 225, world: '스카니아' },
      { id: 'sample_7', nickname: '평딜불독', job: '아크메이지(불,독)', level: 230, world: '스카니아' },
      { id: 'sample_8', nickname: '배트나워', job: '나이트워커', level: 235, world: '스카니아' },
      { id: 'sample_9', nickname: '해신스커', job: '스트라이커', level: 240, world: '스카니아' },
      { id: 'sample_10', nickname: '속사보마', job: '보우마스터', level: 245, world: '스카니아' },
      { id: 'sample_11', nickname: '도원호영', job: '호영', level: 250, world: '스카니아' },
      { id: 'sample_12', nickname: '사슬듀블', job: '듀얼블레이드', level: 255, world: '스카니아' }
    ];

    this.selectedLowCharIds = new Set(this.accountCharacters.map(c => c.id));

    // 질문 1~7 분기 트리 응답 상태 저장
    this.treeAnswers = {
      Q1: 'YES',
      Q2: 'YES',
      Q3: 'NO',
      Q4: 'NO',
      Q5: 'YES',
      Q6: 'NO',
      Q7: 'NO'
    };
    this.focusedQuestionId = 'Q1';

    this.mainCenterViewMode = 'analytics';
    this.activeTab = 'ranking';
    this.rightOpen = true;
    this.studioOpen = true;
    this.studioSubTab = 'skills';
    this.detailMode = 'burst';
    this.simTab = 'recommend';
    this.charViewMode = 'indiv';

    this.selectedJob = '카이저';
    this.burstThreshold = 50;
    this.burstWindowSec = 30;
    this.sortMode = 'EFF_DESC';
    this.searchQuery = '';
    this.currentPage = 1;
    this.pageSize = 12;
    this.showAllJobs = false;

    this.selectedBurstSkillMap = {};
    this.burstSumCalcMode = 'ATTR_30';

    this.injectStaticIcons();
    this.cacheDom();
    this.bindEvents();
    this.initData();
  }

  // 오직 8대 연계 직업만 COMBO_CDR로 설정하고, 나머지 40개 직업은 비연계로 정규화
  normalizeStrictComboAttackStyles() {
    Object.keys(this.utilityDb).forEach(jobName => {
      if (STRICT_COMBO_JOBS_DB[jobName]) {
        this.utilityDb[jobName].attackStyle = 'COMBO_CDR';
      } else if (this.utilityDb[jobName].attackStyle === 'COMBO_CDR') {
        this.utilityDb[jobName].attackStyle = 'HOLD_660';
      }
    });
  }

  injectStaticIcons() {
    const brandSpark = document.getElementById('brandSparkIcon');
    if (brandSpark) brandSpark.innerHTML = createIconSvg('spark', 20);

    const searchBtn = document.getElementById('topQuickSearchBtn');
    if (searchBtn) searchBtn.innerHTML = `${createIconSvg('search', 16)} 전체 48직업 펼치기`;

    const extBtn = document.getElementById('toggleExtensionBtn');
    if (extBtn) extBtn.innerHTML = `${createIconSvg('bolt', 16)} 분석 패널 닫기`;

    document.querySelectorAll('[data-icon]').forEach(el => {
      const name = el.getAttribute('data-icon');
      const size = Number(el.getAttribute('data-size')) || 16;
      el.innerHTML = createIconSvg(name, size);
    });
  }

  cacheDom() {
    this.mainWorkspace = document.getElementById('mainWorkspace');
    this.analyticsMainView = document.getElementById('analyticsMainView');
    this.jobRecommendOverlayView = document.getElementById('jobRecommendOverlayView');

    this.rightDetailPanel = document.getElementById('rightDetailPanel');
    this.customDbStudioPanel = document.getElementById('customDbStudioPanel');
    this.toggleExtensionBtn = document.getElementById('toggleExtensionBtn');
    this.toggleCustomStudioBtn = document.getElementById('toggleCustomStudioBtn');
    this.toggleMainRecommendBtn = document.getElementById('toggleMainRecommendBtn');
    this.studioOpenRecommendWizardBtn = document.getElementById('studioOpenRecommendWizardBtn');
    this.backToAnalyticsBtn = document.getElementById('backToAnalyticsBtn');
    this.closeStudioPanelBtn = document.getElementById('closeStudioPanelBtn');
    this.topQuickSearchBtn = document.getElementById('topQuickSearchBtn');
    this.rankJobFilter = document.getElementById('rankJobFilter');

    this.apiKeyInput = document.getElementById('apiKeyInput');
    this.toggleApiKeyVisBtn = document.getElementById('toggleApiKeyVisBtn');
    this.loadAccountBtn = document.getElementById('loadAccountBtn');
    this.apiStatusBadge = document.getElementById('apiStatusBadge');
    this.worldFilterSelect = document.getElementById('worldFilterSelect');
    this.maxLevelInput = document.getElementById('maxLevelInput');
    this.nicknameSearchInput = document.getElementById('nicknameSearchInput');
    this.nicknameSearchBtn = document.getElementById('nicknameSearchBtn');

    this.charCountBadge = document.getElementById('charCountBadge');
    this.charViewIndivBtn = document.getElementById('charViewIndivBtn');
    this.charViewJobBtn = document.getElementById('charViewJobBtn');
    this.sidebarCharListContainer = document.getElementById('sidebarCharListContainer');

    this.cycleThresholdBtn = document.getElementById('cycleThresholdBtn');
    this.classifierThresholdLabel = document.getElementById('classifierThresholdLabel');
    this.classifierMiniDonut = document.getElementById('classifierMiniDonut');
    this.classifierMiniDonutText = document.getElementById('classifierMiniDonutText');
    this.burstJobCountEm = document.getElementById('burstJobCountEm');
    this.sustainJobCountEm = document.getElementById('sustainJobCountEm');
    this.burstJobPills = document.getElementById('burstJobPills');
    this.sustainJobPills = document.getElementById('sustainJobPills');

    this.seasonFilterSelect = document.getElementById('seasonFilterSelect');
    this.mainJobFilterSelect = document.getElementById('mainJobFilterSelect');

    this.kpiTotalRecords = document.getElementById('kpiTotalRecords');
    this.kpiSeasonSub = document.getElementById('kpiSeasonSub');
    this.kpiAvgDps = document.getElementById('kpiAvgDps');
    this.kpiMaxEff = document.getElementById('kpiMaxEff');
    this.kpiMaxEffJob = document.getElementById('kpiMaxEffJob');
    this.kpiCustomCount = document.getElementById('kpiCustomCount');

    this.mainContentTabs = document.getElementById('mainContentTabs');
    this.tabRankingCountBadge = document.getElementById('tabRankingCountBadge');
    this.toolbarSortStatus = document.getElementById('toolbarSortStatus');
    this.cycleSortModeBtn = document.getElementById('cycleSortModeBtn');
    this.mainTableHead = document.getElementById('mainTableHead');
    this.mainTableBody = document.getElementById('mainTableBody');
    this.tableFooterSummary = document.getElementById('tableFooterSummary');
    this.tablePagination = document.getElementById('tablePagination');

    // 대화면 직업 추천 위자드 DOM
    this.lowLevelCharStatusText = document.getElementById('lowLevelCharStatusText');
    this.recLowLevelLimitInput = document.getElementById('recLowLevelLimitInput');
    this.selectAllLowCharsBtn = document.getElementById('selectAllLowCharsBtn');
    this.clearSelectedLowCharsBtn = document.getElementById('clearSelectedLowCharsBtn');
    this.loadSampleLowCharsBtn = document.getElementById('loadSampleLowCharsBtn');
    this.recLowLevelCharGrid = document.getElementById('recLowLevelCharGrid');

    this.treeCurrentPathSummary = document.getElementById('treeCurrentPathSummary');
    this.recTargetCpMan = document.getElementById('recTargetCpMan');
    this.recTargetFrags = document.getElementById('recTargetFrags');
    this.resetSurveyTreeBtn = document.getElementById('resetSurveyTreeBtn');
    this.treeBreadcrumbBar = document.getElementById('treeBreadcrumbBar');
    this.activeQuestionHeroBox = document.getElementById('activeQuestionHeroBox');
    this.treeNodesOverviewBox = document.getElementById('treeNodesOverviewBox');

    this.recResultHeaderTitle = document.getElementById('recResultHeaderTitle');
    this.recSelectedCharCompareSummary = document.getElementById('recSelectedCharCompareSummary');
    this.recPerfFormulaToggle = document.getElementById('recPerfFormulaToggle');
    this.recCastOrderToggle = document.getElementById('recCastOrderToggle');
    this.recCurrentCharBanner = document.getElementById('recCurrentCharBanner');
    this.recResultCardsGrid = document.getElementById('recResultCardsGrid');

    // 우측 분석 패널 DOM
    this.detailJobTitle = document.getElementById('detailJobTitle');
    this.detailJobAvatar = document.getElementById('detailJobAvatar');
    this.detailModeTabs = document.getElementById('detailModeTabs');
    this.detailBurstView = document.getElementById('detailBurstView');
    this.detailCalcView = document.getElementById('detailCalcView');

    this.detailScoreRing = document.getElementById('detailScoreRing');
    this.detailBurstScoreVal = document.getElementById('detailBurstScoreVal');
    this.detailBurstSourceBadge = document.getElementById('detailBurstSourceBadge');
    this.detailRoleTypeTitle = document.getElementById('detailRoleTypeTitle');
    this.detailBurstDiffText = document.getElementById('detailBurstDiffText');

    this.detailRangeAccordionBtn = document.getElementById('detailRangeAccordionBtn');
    this.detailRangeAccordionBody = document.getElementById('detailRangeAccordionBody');
    this.detailTriggerSkillSelect = document.getElementById('detailTriggerSkillSelect');
    this.rangeEndLabel = document.getElementById('rangeEndLabel');
    this.burstWindowPresetRow = document.getElementById('burstWindowPresetRow');

    this.metricBurstDmg = document.getElementById('metricBurstDmg');
    this.metricSustainDmg = document.getElementById('metricSustainDmg');
    this.metricApmCasts = document.getElementById('metricApmCasts');
    this.metricBpEfficiency = document.getElementById('metricBpEfficiency');

    this.calcHexaRateBadge = document.getElementById('calcHexaRateBadge');
    this.calcStdRealDps = document.getElementById('calcStdRealDps');
    this.calcMyRealDps = document.getElementById('calcMyRealDps');
    this.calcClearTimeText = document.getElementById('calcClearTimeText');
    this.calcUtilSummaryText = document.getElementById('calcUtilSummaryText');

    this.inlineSimTabs = document.getElementById('inlineSimTabs');
    this.inlineSimRecommendList = document.getElementById('inlineSimRecommendList');
    this.inlineSimSettingsPanel = document.getElementById('inlineSimSettingsPanel');
    this.inlineSimCountText = document.getElementById('inlineSimCountText');

    this.inlineSimCpInput = document.getElementById('inlineSimCpInput');
    this.inlineSimFragInput = document.getElementById('inlineSimFragInput');
    this.inlineSimHatSelect = document.getElementById('inlineSimHatSelect');
    this.inlineSimIframeSelect = document.getElementById('inlineSimIframeSelect');
    this.inlineSimBossHpInput = document.getElementById('inlineSimBossHpInput');
    this.inlineSimSortSelect = document.getElementById('inlineSimSortSelect');

    // 커스텀 스튜디오 DOM
    this.studioJobTitle = document.getElementById('studioJobTitle');
    this.studioJobSelect = document.getElementById('studioJobSelect');
    this.saveJobCustomDbBtn = document.getElementById('saveJobCustomDbBtn');
    this.resetJobCustomDbBtn = document.getElementById('resetJobCustomDbBtn');
    this.studioSaveStatusMsg = document.getElementById('studioSaveStatusMsg');
    this.studioSubTabs = document.getElementById('studioSubTabs');
    this.studioSkillsTabView = document.getElementById('studioSkillsTabView');
    this.studioParamsTabView = document.getElementById('studioParamsTabView');

    this.toggleBuffListAccordionBtn = document.getElementById('toggleBuffListAccordionBtn');
    this.buffAndProcListBody = document.getElementById('buffAndProcListBody');
    this.studioSkillSourceLabel = document.getElementById('studioSkillSourceLabel');
    this.selectedSkillCountText = document.getElementById('selectedSkillCountText');
    this.selectedBurstSumBtnText = document.getElementById('selectedBurstSumBtnText');
    this.applySelectedBurstRateBtn = document.getElementById('applySelectedBurstRateBtn');
    this.chip30AttrMode = document.getElementById('chip30AttrMode');
    this.chip30AttrVal = document.getElementById('chip30AttrVal');
    this.chipRawSumMode = document.getElementById('chipRawSumMode');
    this.chipRawSumVal = document.getElementById('chipRawSumVal');
    this.selectAllBurstSkillsBtn = document.getElementById('selectAllBurstSkillsBtn');
    this.clearAllBurstSkillsBtn = document.getElementById('clearAllBurstSkillsBtn');
    this.selectedSkillNamesSummary = document.getElementById('selectedSkillNamesSummary');
    this.studioSkillListContainer = document.getElementById('studioSkillListContainer');

    this.newCustomSkillName = document.getElementById('newCustomSkillName');
    this.newCustomSkillRate = document.getElementById('newCustomSkillRate');
    this.newCustomSkillRole = document.getElementById('newCustomSkillRole');
    this.addCustomSkillBtn = document.getElementById('addCustomSkillBtn');

    this.editJobBurstRate = document.getElementById('editJobBurstRate');
    this.editJobAttackStyle = document.getElementById('editJobAttackStyle');
    this.editJobStdDpmJo = document.getElementById('editJobStdDpmJo');
    this.editJobBpEff = document.getElementById('editJobBpEff');
    this.editJobRecHatSec = document.getElementById('editJobRecHatSec');
    this.editJobCdrShare = document.getElementById('editJobCdrShare');
    this.editJobCdrBaseCool = document.getElementById('editJobCdrBaseCool');
    this.editJobCdrEffFactor = document.getElementById('editJobCdrEffFactor');
    this.editJobHasIframe = document.getElementById('editJobHasIframe');
    this.editJobIframeCool = document.getElementById('editJobIframeCool');
    this.editJobIframeName = document.getElementById('editJobIframeName');
    this.editJobNormActions = document.getElementById('editJobNormActions');
    this.editJobProcCasts = document.getElementById('editJobProcCasts');
  }

  async initData() {
    const savedKey = localStorage.getItem('NEXON_OPEN_API_KEY') || '';
    if (this.apiKeyInput && savedKey) {
      this.apiKeyInput.value = savedKey;
      if (this.apiStatusBadge) {
        this.apiStatusBadge.textContent = 'Key 저장됨';
        this.apiStatusBadge.style.color = 'var(--green)';
      }
    }

    const jobOpts = `<option value="ALL">전체 직업</option>` +
      MASTER_JOB_LIST.map(j => `<option value="${j}">${j}</option>`).join('');
    if (this.mainJobFilterSelect) this.mainJobFilterSelect.innerHTML = jobOpts;
    if (this.rankJobFilter) this.rankJobFilter.innerHTML = jobOpts;
    if (this.studioJobSelect) {
      this.studioJobSelect.innerHTML = MASTER_JOB_LIST.map(j => `<option value="${j}">${j}</option>`).join('');
    }

    try {
      const res = await ipcRenderer.invoke('load-local-db');
      if (res && res.success && res.data) {
        this.localDb = {
          currentSeasonKey: 'season_5',
          seasons: { season_5: { name: '5기 연무장', records: [] } },
          manualSkillCategories: {},
          savedJobBurstProfiles: {},
          customJobSkills: {},
          customJobUtilityDb: {},
          ...res.data
        };
      }
    } catch (e) {
      console.warn('로컬 DB 로드 실패:', e);
    }

    this.loadMergedUtilityDb();
    this.populateSeasonSelect();
    this.syncStudioFormInputs(this.selectedJob);
    this.renderAll();
  }

  loadMergedUtilityDb() {
    this.utilityDb = JSON.parse(JSON.stringify(DEFAULT_JOB_UTILITY_DB));

    try {
      const savedLocal = localStorage.getItem(this.STORAGE_KEY_CUSTOM_UTIL);
      if (savedLocal) {
        const parsed = JSON.parse(savedLocal);
        Object.keys(parsed).forEach(j => {
          if (this.utilityDb[j]) this.utilityDb[j] = { ...this.utilityDb[j], ...parsed[j] };
        });
      }
    } catch (e) {}

    const dbCustomUtil = this.localDb?.customJobUtilityDb || {};
    Object.keys(dbCustomUtil).forEach(j => {
      if (this.utilityDb[j]) {
        this.utilityDb[j] = { ...this.utilityDb[j], ...dbCustomUtil[j] };
      }
    });

    const savedBurst = this.localDb?.savedJobBurstProfiles || {};
    Object.keys(savedBurst).forEach(j => {
      if (this.utilityDb[j] && typeof savedBurst[j].burstRate === 'number') {
        this.utilityDb[j].burstRate = savedBurst[j].burstRate;
      }
    });

    // 8대 연계 직업 기준으로 공격 유형 정규화
    this.normalizeStrictComboAttackStyles();
  }

  async persistAllCustomDataToLocalDb(toastMessage = '✅ 로컬 DB(maple_local_db.json) 및 시뮬레이터에 즉시 저장되었습니다!') {
    try {
      localStorage.setItem(this.STORAGE_KEY_CUSTOM_UTIL, JSON.stringify(this.utilityDb));
    } catch (e) {}

    this.localDb.customJobUtilityDb = JSON.parse(JSON.stringify(this.utilityDb));

    try {
      await ipcRenderer.invoke('save-local-db', this.localDb);
    } catch (e) {
      console.error('로컬 DB 파일 저장 실패:', e);
    }

    if (this.studioSaveStatusMsg) {
      this.studioSaveStatusMsg.textContent = toastMessage;
      this.studioSaveStatusMsg.classList.remove('hidden');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => {
        this.studioSaveStatusMsg.classList.add('hidden');
      }, 2800);
    }
  }

  switchMainCenterView(mode) {
    this.mainCenterViewMode = mode;
    const isRec = mode === 'recommend';

    if (this.analyticsMainView) this.analyticsMainView.classList.toggle('hidden', isRec);
    if (this.jobRecommendOverlayView) this.jobRecommendOverlayView.classList.toggle('hidden', !isRec);

    if (this.toggleMainRecommendBtn) {
      this.toggleMainRecommendBtn.classList.toggle('active-rec-btn', isRec);
      this.toggleMainRecommendBtn.textContent = isRec ? '📊 연무장 기록 분석 보기' : '🧭 대화면 직업추천 열기';
    }

    this.renderAll();
  }

  populateSeasonSelect() {
    if (!this.seasonFilterSelect) return;
    const seasons = this.localDb?.seasons || {};
    const keys = Object.keys(seasons);
    if (keys.length > 0) {
      const curKey = this.localDb.currentSeasonKey || keys[0];
      this.seasonFilterSelect.innerHTML = keys.map(k =>
        `<option value="${k}" ${k === curKey ? 'selected' : ''}>${seasons[k].name || k}</option>`
      ).join('');
    }
  }

  getActiveRecords() {
    if (!this.localDb) return [];
    const seasons = this.localDb.seasons || {};
    const selectedKey = this.seasonFilterSelect?.value || this.localDb.currentSeasonKey || Object.keys(seasons)[0];
    if (seasons[selectedKey] && Array.isArray(seasons[selectedKey].records)) {
      return seasons[selectedKey].records;
    }
    if (Array.isArray(this.localDb.records)) {
      return this.localDb.records;
    }
    return [];
  }

  isSameJob(jobA, jobB) {
    if (!jobA || !jobB) return false;
    if (jobA === jobB) return true;
    const aliases = JOB_NAME_ALIASES[jobA] || [jobA];
    return aliases.includes(jobB);
  }

  // 오직 8대 연계 직업(카데나, 블래스터, 칼리, 에반, 제로, 메르세데스, 아크, 스트라이커)만 true 반환
  isComboJob(jobInfo) {
    if (!jobInfo) return false;
    const jName = typeof jobInfo === 'string' ? jobInfo : jobInfo.job;
    return Boolean(STRICT_COMBO_JOBS_DB[jName]);
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

  // 질문 1 ~ 질문 7 분기 트리 경로 추적기
  traceDecisionTreePath() {
    const visitedSteps = [];
    let currentId = 'Q1';
    let guard = 0;

    while (currentId && DECISION_TREE_NODES[currentId] && guard < 10) {
      guard++;
      const node = DECISION_TREE_NODES[currentId];
      const ans = this.treeAnswers[currentId] || 'YES';
      const nextTarget = ans === 'YES' ? node.yesNext : node.noNext;

      visitedSteps.push({
        nodeId: currentId,
        stepNum: node.stepNum,
        question: node.question,
        subtitle: node.subtitle,
        answer: ans,
        answerText: ans === 'YES' ? '예' : '아니오',
        chosenDesc: ans === 'YES' ? node.yesDesc : node.noDesc,
        nextTarget
      });

      if (nextTarget.startsWith('RESULT_')) {
        return {
          visitedSteps,
          terminalRule: nextTarget,
          reachedViaQ5Burst: visitedSteps.some(s => s.nodeId === 'Q5' && s.answer === 'YES'),
          reachedViaQ3Easy: visitedSteps.some(s => s.nodeId === 'Q3' && s.answer === 'YES')
        };
      }
      currentId = nextTarget;
    }

    return {
      visitedSteps,
      terminalRule: 'RESULT_PERF_SORT',
      reachedViaQ5Burst: false,
      reachedViaQ3Easy: false
    };
  }

  getJobSkillsForStudio(jobName) {
    const allRecs = this.getActiveRecords();
    const matched = allRecs.filter(r => this.isSameJob(r?.job, jobName) && Array.isArray(r.skills) && r.skills.length > 0);
    const manualCats = (this.localDb?.manualSkillCategories && this.localDb.manualSkillCategories[jobName]) || {};
    const customAdded = (this.localDb?.customJobSkills && this.localDb.customJobSkills[jobName]) || [];

    const meta = this.utilityDb[jobName] || DEFAULT_JOB_UTILITY_DB[jobName] || {};
    const skillMap = new Map();

    if (matched.length > 0) {
      const cnt = matched.length;
      const windows = [
        { startMs: 0, endMs: this.burstWindowSec * 1000 },
        { startMs: 120000, endMs: 120000 + this.burstWindowSec * 1000 },
        { startMs: 240000, endMs: 240000 + this.burstWindowSec * 1000 }
      ];

      matched.forEach(rec => {
        const tl30 = new Map();
        const tl90 = new Map();
        (rec.timeline || []).forEach(t => {
          if (!t || !t.skill_name) return;
          const ms = Number(t.elapse_time) || 0;
          if (windows.some(w => ms >= w.startMs && ms <= w.endMs)) {
            tl30.set(t.skill_name, (tl30.get(t.skill_name) || 0) + 1);
          } else {
            tl90.set(t.skill_name, (tl90.get(t.skill_name) || 0) + 1);
          }
        });

        (rec.skills || []).forEach(sk => {
          const cur = skillMap.get(sk.name) || { name: sk.name, sumRate: 0, sumUse: 0, sumN30: 0, sumN90: 0 };
          cur.sumRate += Number(sk.rate) || 0;
          cur.sumUse += Number(sk.useCount) || 0;
          cur.sumN30 += tl30.get(sk.name) || 0;
          cur.sumN90 += tl90.get(sk.name) || 0;
          skillMap.set(sk.name, cur);
        });
      });

      const list = Array.from(skillMap.values()).map(item => {
        const rate = Number((item.sumRate / cnt).toFixed(2));
        const useCount = Math.round(item.sumUse / cnt);
        const n30 = Number((item.sumN30 / cnt).toFixed(1));
        const n90 = Number((item.sumN90 / cnt).toFixed(1));
        const role = manualCats[item.name] || this.inferDefaultSkillRole(item.name, rate, useCount, n30, n90);
        return { name: item.name, rate, useCount, n30, n90, role, isRealRecord: true };
      });

      customAdded.forEach(cs => {
        if (!skillMap.has(cs.name)) {
          list.push({
            name: cs.name,
            rate: Number(cs.rate) || 5.0,
            useCount: cs.useCount || 12,
            n30: cs.role === 'BURST' ? 3 : 0,
            n90: cs.role === 'SUSTAIN' ? 9 : 0,
            role: manualCats[cs.name] || cs.role || 'BURST',
            isRealRecord: false
          });
        }
      });

      return list.sort((a, b) => b.rate - a.rate);
    }

    const baseBurst = meta.burstRate ?? 55.0;
    const remain = Math.max(10, 100 - baseBurst);
    const defaultTemplate = [
      { name: `${jobName} 6차 오리진 / 30초 극딜 주력기 I`, rate: Number((baseBurst * 0.46).toFixed(1)), useCount: 36, n30: 3, n90: 0, role: 'BURST' },
      { name: `${jobName} 5차/6차 극딜 버프 주력기 II`, rate: Number((baseBurst * 0.34).toFixed(1)), useCount: 64, n30: 6, n90: 0, role: 'BURST' },
      { name: `${jobName} 서브 극딜 / 짧쿨 극딜 연계기`, rate: Number((baseBurst * 0.20).toFixed(1)), useCount: 95, n30: 6, n90: 6, role: 'BURST' },
      { name: `${jobName} 660ms 상시 주력 평딜기`, rate: Number((remain * 0.65).toFixed(1)), useCount: Math.round(meta.normActions6m * 0.68), n30: 0, n90: 0, role: 'MAIN_660' },
      { name: `${jobName} 쿨타임 지속 보조기 (쿨뚝 적용)`, rate: Number((remain * 0.20).toFixed(1)), useCount: Math.round(meta.normActions6m * 0.22), n30: 3, n90: 9, role: 'SUSTAIN' },
      { name: `${jobName} 패시브 사출기 / 파이널 어택`, rate: Number((remain * 0.15).toFixed(1)), useCount: meta.procCasts6m || 800, n30: 0, n90: 0, role: 'PROC' },
      { name: `리스트레인트 링 / 극딜 시드링 버프`, rate: 0.0, useCount: 3, n30: 3, n90: 0, role: 'BUFF' }
    ];

    customAdded.forEach(cs => {
      defaultTemplate.push({
        name: cs.name,
        rate: Number(cs.rate) || 5.0,
        useCount: cs.useCount || 10,
        n30: cs.role === 'BURST' ? 3 : 0,
        n90: cs.role === 'SUSTAIN' ? 6 : 0,
        role: cs.role || 'BURST'
      });
    });

    return defaultTemplate.map(sk => ({
      ...sk,
      role: manualCats[sk.name] || sk.role,
      isRealRecord: false
    }));
  }

  inferDefaultSkillRole(skillName, rate, useCount, n30, n90) {
    const name = skillName || '';
    if (rate <= 0.05 && (n30 + n90 > 0 || useCount <= 12)) return 'BUFF';
    if (PASSIVE_PROC_SKILL_KEYWORDS.some(kw => name.includes(kw))) return 'PROC';
    if (KEYDOWN_SKILL_KEYWORDS.some(kw => name.includes(kw)) && n90 === 0) return 'BURST';
    if (n30 > 0 && n90 === 0) return 'BURST';
    if (n30 + n90 === 0 && rate >= 12) return 'MAIN_660';
    if (n30 > 0 && n30 * 1.75 >= n90) return 'BURST';
    return 'SUSTAIN';
  }

  calcSingleSkillBurstContribution(sk, isSelectedBurst) {
    const d = Number(sk.rate) || 0;
    if (d <= 0 || sk.role === 'BUFF') return 0;

    if (this.burstSumCalcMode === 'RAW_SUM') {
      return isSelectedBurst ? d : 0;
    }

    const omega = 1.75;
    if (sk.role === 'BURST') return isSelectedBurst ? d : 0;
    if (sk.role === 'MAIN_660') {
      if (!isSelectedBurst) return 0;
      const burstExcessShare = (30 * (omega - 1.0)) / (30 * omega + 90 * 1.0);
      return Number((d * burstExcessShare).toFixed(2));
    }
    if (sk.role === 'SUSTAIN' || sk.role === 'PROC') {
      if (!isSelectedBurst) return 0;
      if (sk.n30 + sk.n90 > 0) {
        return Number((d * ((sk.n30 * omega) / (sk.n30 * omega + sk.n90))).toFixed(2));
      }
      return Number((d * ((30 * omega) / (30 * omega + 90))).toFixed(2));
    }
    return 0;
  }

  buildAggregatedJobs() {
    const allRecs = this.getActiveRecords();
    const savedBurst = this.localDb?.savedJobBurstProfiles || {};
    const windowScale = this.burstWindowSec === 15 ? 0.76 : (this.burstWindowSec === 20 ? 0.88 : 1.0);

    return MASTER_JOB_LIST.map(jobName => {
      const meta = this.utilityDb[jobName] || DEFAULT_JOB_UTILITY_DB[jobName] || {};
      const matched = allRecs.filter(r => this.isSameJob(r?.job, jobName) && r.efficiency > 0);
      const cnt = matched.length;

      let repName = `${meta.recHatSec > 0 ? meta.recHatSec + '초뚝' : '스탯뚝'} 표준`;
      let avgDpsNum = Math.round((meta.stdDpmJo || 4.6) * 1e12);
      let avgPowerNum = Math.round(avgDpsNum / (meta.bpEff || 7138));
      let efficiency = meta.bpEff || 7138;
      let rawBurst = meta.burstRate ?? 55.0;
      let normActions6m = meta.normActions6m || 620;
      let procCasts6m = meta.procCasts6m || 850;

      if (cnt > 0) {
        const sortedRecs = [...matched].sort((a, b) => (b.dps || 0) - (a.dps || 0));
        repName = sortedRecs[0]?.nickname || sortedRecs[0]?.name || repName;
        avgDpsNum = Math.round(matched.reduce((a, c) => a + (c.dps || 0), 0) / cnt);
        avgPowerNum = Math.round(matched.reduce((a, c) => a + (c.combatPower || 0), 0) / cnt);
        if (!this.localDb?.customJobUtilityDb?.[jobName]?.bpEff) {
          efficiency = avgPowerNum > 0
            ? Math.round(avgDpsNum / avgPowerNum)
            : Math.round(matched.reduce((a, c) => a + (c.efficiency || 0), 0) / cnt);
        }
      }

      if (savedBurst[jobName] && typeof savedBurst[jobName].burstRate === 'number') {
        rawBurst = savedBurst[jobName].burstRate;
      }

      const burst = Number(Math.min(98, Math.max(10, rawBurst * windowScale)).toFixed(1));
      const tag = burst >= this.burstThreshold ? '극딜' : '평딜';
      const comboMeta = STRICT_COMBO_JOBS_DB[jobName] || null;

      return {
        job: jobName,
        tag,
        burst,
        rawBurst,
        name: repName,
        dpsNum: avgDpsNum,
        dps: formatKoreanNumber(avgDpsNum),
        powerNum: avgPowerNum,
        power: formatKoreanNumber(avgPowerNum),
        efficiencyNum: efficiency,
        efficiency: efficiency.toLocaleString(),
        records: cnt,
        normActions6m,
        procCasts6m,
        stdDpmJo: meta.stdDpmJo || 4.6,
        recHatSec: meta.recHatSec ?? 0,
        cdrShare: meta.cdrShare ?? 25,
        cdrBaseCool: meta.cdrBaseCool ?? 15,
        cdrEfficiencyFactor: meta.cdrEfficiencyFactor ?? 0.75,
        hasIframe: Boolean(meta.hasIframe),
        iframeCoolSec: Number(meta.iframeCoolSec) || 0,
        iframeName: meta.iframeName || '정보 없음',
        hasBind: Boolean(meta.hasBind),
        attackStyle: comboMeta ? 'COMBO_CDR' : (meta.attackStyle === 'COMBO_CDR' ? 'HOLD_660' : (meta.attackStyle || 'HOLD_660')),
        comboWeapon: comboMeta ? comboMeta.weapon : null,
        comboFeature: comboMeta ? comboMeta.feature : null,
        matchedRecords: matched
      };
    });
  }

  renderAll() {
    const jobsData = this.buildAggregatedJobs();
    const allRecs = this.getActiveRecords();

    const topRecText = document.getElementById('topRecordCountText');
    if (topRecText) {
      topRecText.textContent = allRecs.length > 0 ? `${allRecs.length.toLocaleString()}개 기록` : `48개 직업 체급 DB`;
    }

    if (this.kpiTotalRecords) {
      this.kpiTotalRecords.textContent = allRecs.length > 0 ? allRecs.length.toLocaleString() : '48직업';
    }

    const avgDpsAll = Math.round(jobsData.reduce((a, b) => a + b.dpsNum, 0) / jobsData.length);
    if (this.kpiAvgDps) this.kpiAvgDps.textContent = formatKoreanNumber(avgDpsAll);

    const topEffJob = [...jobsData].sort((a, b) => b.efficiencyNum - a.efficiencyNum)[0];
    if (topEffJob) {
      if (this.kpiMaxEff) this.kpiMaxEff.textContent = topEffJob.efficiency;
      if (this.kpiMaxEffJob) this.kpiMaxEffJob.textContent = topEffJob.job;
    }

    const customCount = Object.keys(this.localDb?.savedJobBurstProfiles || {}).length;
    if (this.kpiCustomCount) {
      this.kpiCustomCount.textContent = `${customCount}개 수동보정`;
    }

    this.renderSidebarClassifier(jobsData);
    this.renderSidebarCharacters(allRecs);
    this.renderMainContent(jobsData, allRecs);
    this.renderBigRecommendOverlay(jobsData);
    this.renderRightDetailPanel(jobsData);
    this.renderInlineSimulator(jobsData);
    this.renderCustomStudioPanel(jobsData);
  }

  // =========================================================================
  // [대화면 직업 추천 위자드: 다중 캐릭터 선택 + 질문 1~7 트리 + 선택 캐릭터 한정 출력]
  // =========================================================================
  renderBigRecommendOverlay(jobsData) {
    if (!this.jobRecommendOverlayView || this.mainCenterViewMode !== 'recommend') return;

    const trace = this.traceDecisionTreePath();
    const excludeComboMode = trace.terminalRule === 'RESULT_NO_COMBO_SORT';

    // 1. 저레벨 캐릭터 필터링 (질문 6에서 '아니오' 선택 시 8대 연계 직업은 캐릭터 후보에서도 자동 숨김!)
    const maxLowLv = Number(this.recLowLevelLimitInput?.value) || 260;
    const allLowChars = [...this.accountCharacters]
      .filter(ch => (Number(ch.level) || 200) <= maxLowLv)
      .sort((a, b) => (Number(a.level) || 0) - (Number(b.level) || 0));

    // 질문 6 === 아니오(연계 제외)일 때는 카데나 등 8개 연계 직업 카드가 보이지 않도록 필터링
    const visibleLowChars = excludeComboMode
      ? allLowChars.filter(ch => !this.isComboJob(ch.job))
      : allLowChars;

    const selectedInView = visibleLowChars.filter(ch => this.selectedLowCharIds.has(ch.id));

    if (this.lowLevelCharStatusText) {
      const comboHiddenMsg = excludeComboMode
        ? ` · <span style="color:var(--orange);">연계 직업(카데나 등 8종) 제외됨</span>`
        : '';
      this.lowLevelCharStatusText.innerHTML =
        `Lv.${maxLowLv} 이하 대상 캐릭터 <b>${visibleLowChars.length}명</b> 중 <b style="color:var(--green);">${selectedInView.length}명 다중 선택됨</b>${comboHiddenMsg}`;
    }

    if (this.recLowLevelCharGrid) {
      if (visibleLowChars.length === 0) {
        this.recLowLevelCharGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 24px; color: var(--text-3);">
            조건에 부합하는 저레벨 캐릭터가 없습니다. 상단 기준 레벨을 높이거나 [🧪 샘플 저레벨 12종 불러오기]를 눌러주세요.
          </div>
        `;
      } else {
        this.recLowLevelCharGrid.innerHTML = visibleLowChars.map(ch => {
          const isSel = this.selectedLowCharIds.has(ch.id);
          const jobMeta = jobsData.find(j => this.isSameJob(j.job, ch.job));
          const isCombo = this.isComboJob(ch.job);
          const castCnt = jobMeta ? jobMeta.normActions6m : 600;
          return `
            <div class="low-char-card ${isSel ? 'selected-low-char' : ''}" data-cid="${ch.id}">
              <div class="low-char-top">
                <div style="display:flex; align-items:center; gap:6px;">
                  <span class="low-char-chk">✓</span>
                  <span class="low-char-lv">Lv.${ch.level}</span>
                </div>
                <span class="low-char-world">${ch.world || '스카니아'}</span>
              </div>
              <strong class="low-char-name">${ch.nickname}</strong>
              <div class="low-char-job">
                <span>${ch.job}</span>
                <small style="color:var(--text-3); font-size:9px;">${isCombo ? '🎹연계(8종)' : '⚡비연계'} · ${castCnt}회</small>
              </div>
            </div>
          `;
        }).join('');

        this.recLowLevelCharGrid.querySelectorAll('.low-char-card').forEach(card => {
          card.addEventListener('click', () => {
            const cid = card.getAttribute('data-cid');
            if (this.selectedLowCharIds.has(cid)) {
              this.selectedLowCharIds.delete(cid);
            } else {
              this.selectedLowCharIds.add(cid);
            }
            this.renderAll();
          });
        });
      }
    }

    // 2. STEP 2: 질문 트리 렌더링 (경로에 없는 질문 & 내부 영문 코드는 숨기고 진행한 경로만 깔끔히 표시)
    const visitedIds = new Set(trace.visitedSteps.map(s => s.nodeId));
    if (!visitedIds.has(this.focusedQuestionId)) {
      this.focusedQuestionId = trace.visitedSteps[trace.visitedSteps.length - 1]?.nodeId || 'Q1';
    }

    const terminalTitleMap = {
      'RESULT_PERF_SORT': '🏆 성능 우선 정렬 (선택한 캐릭터 중 딜 체급·전투 효율 최우선)',
      'RESULT_CAST_SORT': '⌨️ 스킬 가용횟수 적은순 내림차순 정렬 (조작 편한 캐릭터 우선)',
      'RESULT_NO_COMBO_SORT': '🚫 연계 직업(카데나·블래·칼리·에반·제로·메르·아크·스커) 제외 정렬'
    };

    if (this.treeBreadcrumbBar) {
      const crumbsHtml = trace.visitedSteps.map(st => {
        const isFocus = st.nodeId === this.focusedQuestionId;
        const ansClass = st.answer === 'YES' ? 'crumb-ans-yes' : 'crumb-ans-no';
        return `
          <span class="crumb-node ${isFocus ? 'active-crumb' : ''}" data-focus-q="${st.nodeId}" title="클릭하여 이 질문 다시 선택">
            질문 ${st.stepNum}<span class="${ansClass}">(${st.answerText})</span>
          </span>
          <span style="color:var(--text-3);">➔</span>
        `;
      }).join('');

      this.treeBreadcrumbBar.innerHTML =
        `<strong style="color:var(--primary-bright); margin-right:4px;">진행 경로:</strong>` +
        crumbsHtml +
        `<span class="crumb-terminal">${terminalTitleMap[trace.terminalRule] || '정렬 완료'}</span>`;

      this.treeBreadcrumbBar.querySelectorAll('[data-focus-q]').forEach(el => {
        el.addEventListener('click', () => {
          this.focusedQuestionId = el.getAttribute('data-focus-q');
          this.renderAll();
        });
      });
    }

    // 좌측 대형 활성 질문 카드
    const focusNode = DECISION_TREE_NODES[this.focusedQuestionId] || DECISION_TREE_NODES.Q1;
    const focusAns = this.treeAnswers[focusNode.id] || 'YES';

    if (this.activeQuestionHeroBox) {
      this.activeQuestionHeroBox.innerHTML = `
        <div>
          <span class="hero-q-badge">STEP 2 · 현재 질문 (클릭 시 다음 질문으로 자동 이동)</span>
          <h3 class="hero-q-title">${focusNode.question}</h3>
          <p class="hero-q-sub">${focusNode.subtitle}</p>
        </div>
        <div class="hero-yn-buttons">
          <button type="button" class="yn-btn yes-btn ${focusAns === 'YES' ? 'selected-yn' : ''}" data-q-ans="YES">
            <strong>${focusNode.yesLabel}</strong>
            <span>➔ ${focusNode.yesDesc}</span>
          </button>
          <button type="button" class="yn-btn no-btn ${focusAns === 'NO' ? 'selected-yn' : ''}" data-q-ans="NO">
            <strong>${focusNode.noLabel}</strong>
            <span>➔ ${focusNode.noDesc}</span>
          </button>
        </div>
      `;

      this.activeQuestionHeroBox.querySelectorAll('[data-q-ans]').forEach(btn => {
        btn.addEventListener('click', () => {
          const chosen = btn.getAttribute('data-q-ans');
          this.treeAnswers[focusNode.id] = chosen;
          const nextId = chosen === 'YES' ? focusNode.yesNext : focusNode.noNext;
          if (DECISION_TREE_NODES[nextId]) {
            this.focusedQuestionId = nextId;
          }
          this.renderAll();
        });
      });
    }

    // 우측: 전체 7개 질문 대신 '내가 실제로 지나온 질문 단계'만 깔끔한 한글로 표시 (내부 영문 코드 제거!)
    if (this.treeNodesOverviewBox) {
      this.treeNodesOverviewBox.innerHTML =
        `<div style="font-size:11px; color:var(--text-3); margin-bottom:4px; font-weight:700;">📌 현재 응답한 질문 경로 (클릭하여 바로 수정 가능)</div>` +
        trace.visitedSteps.map((st, idx) => {
          const isCurrent = st.nodeId === focusNode.id;
          return `
            <div class="tree-node-row visited-node ${isCurrent ? 'current-node' : ''}" data-jump-q="${st.nodeId}">
              <div style="cursor:pointer; flex:1;">
                <strong style="color:#fff;">${idx + 1}단계. ${st.question}</strong>
                <div style="font-size:10px; color:var(--primary-bright); margin-top:2px;">
                  선택 결과: ${st.chosenDesc}
                </div>
              </div>
              <div class="mini-yn-group">
                <button type="button" class="mini-yn-btn ${st.answer === 'YES' ? 'active-yes' : ''}" data-mini-q="${st.nodeId}" data-mini-ans="YES">예</button>
                <button type="button" class="mini-yn-btn ${st.answer === 'NO' ? 'active-no' : ''}" data-mini-q="${st.nodeId}" data-mini-ans="NO">아니오</button>
              </div>
            </div>
          `;
        }).join('');

      this.treeNodesOverviewBox.querySelectorAll('[data-jump-q]').forEach(row => {
        row.addEventListener('click', (e) => {
          if (e.target && e.target.hasAttribute('data-mini-ans')) return;
          this.focusedQuestionId = row.getAttribute('data-jump-q');
          this.renderAll();
        });
      });

      this.treeNodesOverviewBox.querySelectorAll('[data-mini-ans]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const qid = btn.getAttribute('data-mini-q');
          const ans = btn.getAttribute('data-mini-ans');
          this.treeAnswers[qid] = ans;
          const nextId = ans === 'YES' ? DECISION_TREE_NODES[qid].yesNext : DECISION_TREE_NODES[qid].noNext;
          if (DECISION_TREE_NODES[nextId]) {
            this.focusedQuestionId = nextId;
          } else {
            this.focusedQuestionId = qid;
          }
          this.renderAll();
        });
      });
    }

    // 3. STEP 3: 다중 선택한 캐릭터 한정 최종 정렬 결과 (질문 6 === 아니오 시 카데나 등 8종 완전 제외)
    const cp = (Number(this.recTargetCpMan?.value) || 10650) * 10000;
    const frag = Number(this.recTargetFrags?.value) || 5656;
    const perfFormula = this.recPerfFormulaToggle?.value || 'STD';
    const castOrder = this.recCastOrderToggle?.value || 'LOW_FIRST';
    const heroRateAt40k = this.getInterpolatedHexaRate('히어로', 40000);

    let candidateChars = selectedInView.map(ch => {
      const jobInfo = jobsData.find(j => this.isSameJob(j.job, ch.job)) || jobsData[0];
      const hexaRate = this.getInterpolatedHexaRate(jobInfo.job, frag);
      const rateAt40k = this.getInterpolatedHexaRate(jobInfo.job, 40000);

      const stdIdx = HERO_CALIBRATED_FULL_INDEX * (jobInfo.stdDpmJo / HERO_BASELINE_DPM_JO) * (heroRateAt40k / rateAt40k);
      const revIdx = HERO_CALIBRATED_FULL_INDEX * (jobInfo.efficiencyNum / 7138);

      const stdDps = Math.round(cp * stdIdx * BP_EFF_TO_INDEX_DIVISOR * (hexaRate / 100) * 0.70 * 1.32);
      const revDps = Math.round(cp * revIdx * BP_EFF_TO_INDEX_DIVISOR * (hexaRate / 100) * 0.70 * 1.32);
      const clearSec779 = stdDps > 0 ? Math.round((779 * 1e12) / stdDps) : 9999;

      const isCombo = this.isComboJob(jobInfo.job);
      const isBurst = jobInfo.burst >= this.burstThreshold;

      return {
        charId: ch.id,
        nickname: ch.nickname,
        level: ch.level,
        world: ch.world || '스카니아',
        ...jobInfo,
        hexaRate,
        stdDps,
        revDps,
        clearSec779,
        isCombo,
        isBurst
      };
    });

    // 질문 6 -> '아니오' 선택 시 8대 연계 직업(카데나, 블래스터, 칼리, 에반, 제로, 메르세데스, 아크, 스트라이커) 완전 제외
    if (excludeComboMode) {
      candidateChars = candidateChars.filter(item => !this.isComboJob(item.job));
    }

    // 정렬 로직 적용
    candidateChars.sort((a, b) => {
      // 질문 6 -> '예'(연계 직업이 좋은가? -> 예)일 때는 8대 연계 직업을 우선 배치한 뒤 성능순 정렬
      const choseComboYes = trace.visitedSteps.some(s => s.nodeId === 'Q6' && s.answer === 'YES');
      if (choseComboYes && a.isCombo !== b.isCombo) {
        return a.isCombo ? -1 : 1;
      }

      // 질문 5 -> '예'(극딜 캐릭이 좋은가? -> 예) 경로일 때는 극딜 캐릭터를 우선 배치
      if (trace.reachedViaQ5Burst && a.isBurst !== b.isBurst) {
        return a.isBurst ? -1 : 1;
      }

      // 스킬 가용횟수 정렬 도달 시 (질문 4 -> 예 / 질문 7 -> 아니오)
      if (trace.terminalRule === 'RESULT_CAST_SORT') {
        if (castOrder === 'HIGH_FIRST') {
          return b.normActions6m - a.normActions6m;
        }
        return a.normActions6m - b.normActions6m;
      }

      // 성능 우선 정렬
      if (perfFormula === 'REV') {
        return b.revDps - a.revDps;
      }
      return b.stdDps - a.stdDps;
    });

    const pathString = trace.visitedSteps.map(s => `질문${s.stepNum}(${s.answerText})`).join(' ➔ ');

    if (this.recCurrentCharBanner) {
      this.recCurrentCharBanner.innerHTML = `
        <div>
          <span style="color: var(--green); font-weight: 800;">🎯 최종 판정 경로:</span>
          <strong style="color: #fff; margin-left: 6px;">${pathString}</strong>
          <span style="color: var(--primary-bright); font-weight: 700; margin-left: 8px;">
            ➔ ${terminalTitleMap[trace.terminalRule]}
          </span>
        </div>
        <div style="color: var(--text-2);">
          출력 결과: 조건 부합 캐릭터 <b style="color:var(--orange);">${candidateChars.length}명</b>
        </div>
      `;
    }

    if (this.recResultCardsGrid) {
      if (candidateChars.length === 0) {
        this.recResultCardsGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 36px; color: var(--text-3); font-size: 13px;">
            ⚠️ 출력할 캐릭터가 없습니다. STEP 1에서 캐릭터를 선택해 주세요!
          </div>
        `;
        return;
      }

      this.recResultCardsGrid.innerHTML = candidateChars.map((item, idx) => {
        const min = Math.floor(item.clearSec779 / 60);
        const sec = String(item.clearSec779 % 60).padStart(2, '0');
        const apm = (item.normActions6m / 6).toFixed(1);

        const primaryMetricBadge = trace.terminalRule === 'RESULT_CAST_SORT'
          ? `⌨️ 6분 가용횟수 ${item.normActions6m}회 (분당 ${apm}회)`
          : (perfFormula === 'REV' ? `🔵 역산효율 ${item.efficiency}` : `🟢 표준체급 ${item.stdDpmJo}조`);

        const comboFeatureLine = item.isCombo && item.comboFeature
          ? `<div style="font-size:10px; color:#fbd38d; background:rgba(242,164,82,0.1); padding:6px 8px; border-radius:6px; border:1px solid rgba(242,164,82,0.3);">
               🎹 <b>${item.comboWeapon}:</b> ${item.comboFeature}
             </div>`
          : '';

        return `
          <article class="rec-big-card ${idx === 0 ? 'top-1-card' : ''}" data-job="${item.job}">
            <div class="rec-big-top">
              <div style="display:flex; align-items:center; gap:7px; min-width:0;">
                <span class="rank rank-${idx + 1}">${idx + 1}</span>
                <div style="display:flex; flex-direction:column;">
                  <strong style="font-size:14px; color:#fff;">${item.nickname} <span style="color:var(--orange); font-size:11px;">(Lv.${item.level})</span></strong>
                  <span style="font-size:11px; color:var(--primary-bright); font-weight:700;">
                    ${item.job} · <span class="${item.tag === '극딜' ? 'type-burst' : 'type-sustain'}">${item.tag} ${item.burst}%</span>
                  </span>
                </div>
              </div>
              <span class="rec-match-score">${primaryMetricBadge}</span>
            </div>

            <div class="formula-values" style="background: var(--bg); padding: 8px 10px; border-radius: 7px; border: 1px solid var(--border);">
              <span style="color: var(--green); font-weight: 700; font-size: 11px;">
                <i class="standard-dot"></i>🟢 표준체급(Q3): ${formatKoreanNumber(item.stdDps)}/초 (779조 약 ${min}분 ${sec}초)
              </span>
              <span style="color: var(--blue); font-weight: 700; font-size: 11px;">
                <i class="reverse-dot"></i>🔵 내 역산공식: ${formatKoreanNumber(item.revDps)}/초 (전투력효율 ${item.efficiency})
              </span>
            </div>

            ${comboFeatureLine}

            <div class="rec-reason-tags">
              <span class="rec-reason-tag" style="color:#90cdf4; border-color:rgba(85,167,255,0.4);">
                ⌨️ 6분 스킬 가용횟수: <b>${item.normActions6m}회</b> (사출 ${item.procCasts6m}제외)
              </span>
              <span class="rec-reason-tag">
                ${item.isCombo ? '🎹 연계 직업 (8종)' : '🛋️ 비연계 직업'}
              </span>
              <span class="rec-reason-tag">
                🛡️ 무적: ${item.hasIframe ? item.iframeCoolSec + '초' : '없음'}
              </span>
              <span class="rec-reason-tag">
                🎩 권장: ${item.recHatSec > 0 ? item.recHatSec + '초뚝' : '스탯뚝'}
              </span>
            </div>
          </article>
        `;
      }).join('');

      this.recResultCardsGrid.querySelectorAll('.rec-big-card').forEach(card => {
        card.addEventListener('click', () => {
          this.selectJob(card.getAttribute('data-job'));
        });
      });
    }
  }

  renderSidebarClassifier(jobsData) {
    if (this.classifierThresholdLabel) {
      this.classifierThresholdLabel.textContent = `30초 피해 비중 ${this.burstThreshold}%`;
    }
    if (this.classifierMiniDonut) {
      this.classifierMiniDonut.style.background = `conic-gradient(var(--primary) ${this.burstThreshold}%, var(--surface-3) 0)`;
    }
    if (this.classifierMiniDonutText) {
      this.classifierMiniDonutText.textContent = String(this.burstThreshold);
    }

    const burstList = jobsData.filter(j => j.burst >= this.burstThreshold);
    const sustainList = jobsData.filter(j => j.burst < this.burstThreshold);

    if (this.burstJobCountEm) this.burstJobCountEm.textContent = String(burstList.length);
    if (this.sustainJobCountEm) this.sustainJobCountEm.textContent = String(sustainList.length);

    if (this.burstJobPills) {
      this.burstJobPills.innerHTML = burstList.map(j =>
        `<span class="pill burst-pill ${j.job === this.selectedJob ? 'active-pill' : ''}" data-job="${j.job}" title="${j.job} (${j.burst}%)">${j.job}</span>`
      ).join('');
      this.burstJobPills.querySelectorAll('.pill').forEach(p => {
        p.addEventListener('click', () => this.selectJob(p.dataset.job));
      });
    }

    if (this.sustainJobPills) {
      this.sustainJobPills.innerHTML = sustainList.map(j =>
        `<span class="pill sustain-pill ${j.job === this.selectedJob ? 'active-pill' : ''}" data-job="${j.job}" title="${j.job} (${j.burst}%)">${j.job}</span>`
      ).join('');
      this.sustainJobPills.querySelectorAll('.pill').forEach(p => {
        p.addEventListener('click', () => this.selectJob(p.dataset.job));
      });
    }
  }

  renderSidebarCharacters(allRecs) {
    if (!this.sidebarCharListContainer) return;
    const listSource = this.accountCharacters.length > 0 ? this.accountCharacters : allRecs;

    if (this.charCountBadge) {
      this.charCountBadge.textContent = `${listSource.length}명`;
    }

    if (listSource.length === 0) {
      this.sidebarCharListContainer.innerHTML = `
        <div class="empty-state">
          <span>${createIconSvg('users', 22)}</span>
          <strong>캐릭터를 불러와 주세요</strong>
          <p>API Key로 계정을 로드한 뒤 저레벨 캐릭터를 클릭하면 다중 선택 목록에 토글됩니다.</p>
        </div>
      `;
      return;
    }

    if (this.charViewMode === 'job') {
      const jobGroupMap = new Map();
      listSource.forEach(c => {
        const j = c.job || c.character_class || '기타';
        jobGroupMap.set(j, (jobGroupMap.get(j) || 0) + 1);
      });
      const entries = Array.from(jobGroupMap.entries()).sort((a, b) => b[1] - a[1]);
      this.sidebarCharListContainer.innerHTML = `<div class="sidebar-char-scroll">` +
        entries.map(([jName, count]) => `
          <div class="sidebar-char-item" data-job="${jName}">
            <strong style="color:var(--text);">${jName}</strong>
            <span style="color:var(--primary-bright); font-weight:700;">${count}명</span>
          </div>
        `).join('') + `</div>`;
    } else {
      const sortedChars = [...listSource].sort((a, b) => (Number(a.level) || 300) - (Number(b.level) || 300));
      const displayChars = sortedChars.slice(0, 50);
      this.sidebarCharListContainer.innerHTML = `<div class="sidebar-char-scroll">` +
        displayChars.map(c => {
          const cid = c.id || `char_${c.nickname}`;
          const isSel = this.selectedLowCharIds.has(cid);
          const name = c.nickname || c.character_name || c.name || '캐릭터';
          const job = c.job || c.character_class || '-';
          const lv = c.level || c.character_level || '';
          return `
            <div class="sidebar-char-item ${isSel ? 'selected-sidebar-char' : ''}" data-cid="${cid}" data-job="${job}">
              <div>
                <strong style="color:var(--text);">${isSel ? '✓ ' : ''}${name}</strong>
                <span style="color:var(--text-3); margin-left:5px;">${job}</span>
              </div>
              <span style="color:var(--orange); font-weight:700;">${lv ? 'Lv.' + lv : formatKoreanNumber(c.dps || 0)}</span>
            </div>
          `;
        }).join('') + `</div>`;
    }

    this.sidebarCharListContainer.querySelectorAll('.sidebar-char-item').forEach(el => {
      el.addEventListener('click', () => {
        const cid = el.getAttribute('data-cid');
        const job = el.dataset.job;
        if (cid) {
          if (this.selectedLowCharIds.has(cid)) this.selectedLowCharIds.delete(cid);
          else this.selectedLowCharIds.add(cid);
          this.switchMainCenterView('recommend');
        }
        if (MASTER_JOB_LIST.includes(job)) {
          this.selectJob(job);
        }
      });
    });
  }

  renderMainContent(jobsData, allRecs) {
    const filterJob = this.mainJobFilterSelect?.value || 'ALL';
    const q = (this.searchQuery || '').trim().toLowerCase();

    let sortedJobs = [...jobsData];
    if (this.sortMode === 'STD_DESC') {
      sortedJobs.sort((a, b) => b.stdDpmJo - a.stdDpmJo);
      if (this.toolbarSortStatus) this.toolbarSortStatus.textContent = '정렬: 🟢표준체급(Q3) 딜량순';
    } else if (this.sortMode === 'BURST_DESC') {
      sortedJobs.sort((a, b) => b.burst - a.burst);
      if (this.toolbarSortStatus) this.toolbarSortStatus.textContent = '정렬: 🔥30초 극딜 비중순';
    } else if (this.sortMode === 'ACT_ASC') {
      sortedJobs.sort((a, b) => a.normActions6m - b.normActions6m);
      if (this.toolbarSortStatus) this.toolbarSortStatus.textContent = '정렬: ⌨️스킬 가용횟수 적은순';
    } else {
      sortedJobs.sort((a, b) => b.efficiencyNum - a.efficiencyNum);
      if (this.toolbarSortStatus) this.toolbarSortStatus.textContent = '정렬: 🔵인게임 전투력 효율순';
    }

    sortedJobs.forEach((item, idx) => { item.rank = idx + 1; });

    if (filterJob !== 'ALL') {
      sortedJobs = sortedJobs.filter(j => this.isSameJob(j.job, filterJob));
    }
    if (q) {
      sortedJobs = sortedJobs.filter(j =>
        j.job.toLowerCase().includes(q) || (j.name && j.name.toLowerCase().includes(q))
      );
    }

    if (this.tabRankingCountBadge) {
      this.tabRankingCountBadge.textContent = String(sortedJobs.length);
    }

    if (this.activeTab === 'characters') {
      this.renderCharactersTabTable(allRecs, filterJob, q);
      return;
    }
    if (this.activeTab === 'skills') {
      this.renderSkillsTop20TabTable(jobsData);
      return;
    }
    if (this.activeTab === 'detail') {
      this.renderDetailFormulaTabTable(jobsData);
      return;
    }

    if (this.mainTableHead) {
      this.mainTableHead.innerHTML = `
        <tr>
          <th>순위</th>
          <th>직업 (극딜 비중)</th>
          <th>대표 캐릭터 / 표준뚝</th>
          <th>표준 체급 딜량(Q3)</th>
          <th>기준 전투력</th>
          <th>전투 효율 (역산)</th>
          <th>6분 가용횟수</th>
        </tr>
      `;
    }

    const totalItems = sortedJobs.length;
    const effectivePageSize = this.showAllJobs ? totalItems : this.pageSize;
    const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(1, effectivePageSize)));
    if (this.currentPage > totalPages) this.currentPage = 1;

    const startIdx = (this.currentPage - 1) * effectivePageSize;
    const pageItems = this.showAllJobs ? sortedJobs : sortedJobs.slice(startIdx, startIdx + effectivePageSize);

    if (this.mainTableBody) {
      this.mainTableBody.innerHTML = pageItems.map(job => {
        const isSelected = job.job === this.selectedJob;
        const rankClass = job.rank <= 3 ? `rank-${job.rank}` : '';
        const customBadge = this.localDb?.savedJobBurstProfiles?.[job.job]
          ? `<span class="custom-tag-badge">커스텀</span>`
          : '';
        return `
          <tr class="${isSelected ? 'selected' : ''}" data-job="${job.job}">
            <td><span class="rank ${rankClass}">${job.rank}</span></td>
            <td>
              <div class="job-cell">
                <strong>${job.job}${customBadge}</strong>
                <span class="${job.tag === '극딜' ? 'type-burst' : 'type-sustain'}">${job.tag} · ${job.burst}%</span>
              </div>
            </td>
            <td>${job.name}</td>
            <td class="dps">${job.dps}</td>
            <td>${job.power}</td>
            <td class="efficiency">${job.efficiency}</td>
            <td><span class="record-count">${job.normActions6m}회</span></td>
          </tr>
        `;
      }).join('');

      this.mainTableBody.querySelectorAll('tr[data-job]').forEach(tr => {
        tr.addEventListener('click', () => this.selectJob(tr.dataset.job));
      });
    }

    if (this.tableFooterSummary) {
      this.tableFooterSummary.textContent = `총 ${totalItems}개 직업 중 ${pageItems.length}개 표시`;
    }

    this.renderPaginationControls(totalPages);
  }

  renderCharactersTabTable(allRecs, filterJob, q) {
    if (this.mainTableHead) {
      this.mainTableHead.innerHTML = `
        <tr>
          <th>#</th>
          <th>닉네임</th>
          <th>직업</th>
          <th>연무장 DPS</th>
          <th>전투력</th>
          <th>전투 효율</th>
          <th>무적기 쿨</th>
        </tr>
      `;
    }

    let list = [...allRecs].sort((a, b) => (b.dps || 0) - (a.dps || 0));
    if (filterJob !== 'ALL') list = list.filter(r => this.isSameJob(r.job, filterJob));
    if (q) list = list.filter(r => (r.nickname || '').toLowerCase().includes(q) || (r.job || '').toLowerCase().includes(q));

    if (list.length === 0) {
      this.mainTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-3);">저장된 개별 캐릭터 연무장 기록이 없습니다.</td></tr>`;
      return;
    }

    this.mainTableBody.innerHTML = list.slice(0, 50).map((r, i) => {
      const meta = this.utilityDb[r.job] || {};
      return `
        <tr data-job="${r.job}">
          <td><span class="rank">${i + 1}</span></td>
          <td><strong style="color:var(--text);">${r.nickname || r.name || '-'}</strong></td>
          <td>${r.job || '-'}</td>
          <td class="dps">${formatKoreanNumber(r.dps)}</td>
          <td>${formatKoreanNumber(r.combatPower)}</td>
          <td class="efficiency">${(r.efficiency || 0).toLocaleString()}</td>
          <td><span class="record-count">${meta.hasIframe ? meta.iframeCoolSec + '초' : '없음'}</span></td>
        </tr>
      `;
    }).join('');

    this.mainTableBody.querySelectorAll('tr[data-job]').forEach(tr => {
      tr.addEventListener('click', () => this.selectJob(tr.dataset.job));
    });
  }

  renderSkillsTop20TabTable(jobsData) {
    const target = jobsData.find(j => j.job === this.selectedJob) || jobsData[0];
    const skills = this.getJobSkillsForStudio(target.job);

    if (this.mainTableHead) {
      this.mainTableHead.innerHTML = `
        <tr>
          <th>순위</th>
          <th>[${target.job}] 스킬명</th>
          <th>현재 판정 분류</th>
          <th>평균 딜 점유율</th>
          <th>6분 시전/타수</th>
          <th>30초/90초 타임라인</th>
          <th>커스텀 설정</th>
        </tr>
      `;
    }

    const roleLabelMap = {
      'BURST': '🔥 극딜기 (100% 귀속)',
      'MAIN_660': '⚡ 660ms 상시주력기',
      'SUSTAIN': '🔄 평딜기 (지속)',
      'PROC': '👻 사출기/패시브 (타수제외)',
      'BUFF': '🛡️ 버프/시드링'
    };

    this.mainTableBody.innerHTML = skills.map((sk, idx) => `
      <tr>
        <td><span class="rank">${idx + 1}</span></td>
        <td><strong style="color:var(--text);">${sk.name}</strong></td>
        <td><span class="${sk.role === 'BURST' ? 'type-burst' : 'type-sustain'}">${roleLabelMap[sk.role] || sk.role}</span></td>
        <td class="dps">${sk.rate}%</td>
        <td>${sk.useCount.toLocaleString()}회</td>
        <td>30초:${sk.n30} / 90초:${sk.n90}</td>
        <td><span class="record-count">우측 스튜디오에서 변경</span></td>
      </tr>
    `).join('');
  }

  renderDetailFormulaTabTable(jobsData) {
    const target = jobsData.find(j => j.job === this.selectedJob) || jobsData[0];
    if (this.mainTableHead) {
      this.mainTableHead.innerHTML = `
        <tr>
          <th>착용 모자 (쿨뚝)</th>
          <th>대상 직업</th>
          <th>쿨감 적용 후 주력쿨</th>
          <th>순수 쿨감 딜상승</th>
          <th>🟢 표준체급 실전 DPS</th>
          <th>🔵 내 역산공식 실전 DPS</th>
          <th>목표 보스 클리어</th>
        </tr>
      `;
    }

    const cp = (Number(this.inlineSimCpInput?.value) || 10650) * 10000;
    const frag = Number(this.inlineSimFragInput?.value) || 5656;
    const bossHp = (Number(this.inlineSimBossHpInput?.value) || 779) * 1e12;
    const hexaRate = this.getInterpolatedHexaRate(target.job, frag);
    const rateAt40k = this.getInterpolatedHexaRate(target.job, 40000);
    const heroRateAt40k = this.getInterpolatedHexaRate('히어로', 40000);

    const hats = [0, 1, 2, 3, 4, 5, 6];
    this.mainTableBody.innerHTML = hats.map(hatSec => {
      const cool0 = calcMapleReducedCooldown(target.cdrBaseCool, 0);
      const coolH = calcMapleReducedCooldown(target.cdrBaseCool, hatSec);
      const gainPct = hatSec > 0 && coolH < cool0
        ? Number((target.cdrShare * ((cool0 / coolH) - 1) * target.cdrEfficiencyFactor).toFixed(2))
        : 0;

      const coolRec = calcMapleReducedCooldown(target.cdrBaseCool, target.recHatSec);
      const gainRec = target.recHatSec > 0 && coolRec < cool0
        ? Number((target.cdrShare * ((cool0 / coolRec) - 1) * target.cdrEfficiencyFactor).toFixed(2))
        : 0;

      const relMult = (1 + gainPct / 100) / (1 + gainRec / 100);
      const stdIdx = HERO_CALIBRATED_FULL_INDEX * (target.stdDpmJo / HERO_BASELINE_DPM_JO) * (heroRateAt40k / rateAt40k) * relMult;
      const myIdx = HERO_CALIBRATED_FULL_INDEX * (target.efficiencyNum / 7138) * relMult;

      const stdDps = Math.round(cp * stdIdx * BP_EFF_TO_INDEX_DIVISOR * (hexaRate / 100) * 0.70 * 1.32);
      const myDps = Math.round(cp * myIdx * BP_EFF_TO_INDEX_DIVISOR * (hexaRate / 100) * 0.70 * 1.32);
      const clearSec = stdDps > 0 ? Math.round(bossHp / stdDps) : 0;
      const isRec = hatSec === target.recHatSec;

      return `
        <tr class="${isRec ? 'selected' : ''}">
          <td><span class="rank ${isRec ? 'rank-1' : ''}">${hatSec}초</span></td>
          <td><strong style="color:var(--text);">${target.job} ${isRec ? '(권장 표준뚝)' : ''}</strong></td>
          <td>${coolH}초</td>
          <td class="efficiency">+${gainPct}%</td>
          <td style="color:var(--green); font-weight:700;">${formatKoreanNumber(stdDps)}/초</td>
          <td style="color:var(--blue); font-weight:700;">${formatKoreanNumber(myDps)}/초</td>
          <td><span class="record-count">${Math.floor(clearSec / 60)}분 ${String(clearSec % 60).padStart(2, '0')}초</span></td>
        </tr>
      `;
    }).join('');
  }

  renderPaginationControls(totalPages) {
    if (!this.tablePagination) return;
    if (this.showAllJobs) {
      this.tablePagination.innerHTML = `<button type="button" class="active" id="collapsePageBtn">12개씩 페이지 보기</button>`;
      document.getElementById('collapsePageBtn')?.addEventListener('click', () => {
        this.showAllJobs = false;
        this.renderAll();
      });
      return;
    }

    let html = `<button type="button" data-page="prev">이전</button>`;
    for (let p = 1; p <= totalPages; p++) {
      html += `<button type="button" class="${p === this.currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
    }
    html += `<button type="button" data-page="next">다음</button>`;
    this.tablePagination.innerHTML = html;

    this.tablePagination.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.page;
        if (val === 'prev') this.currentPage = Math.max(1, this.currentPage - 1);
        else if (val === 'next') this.currentPage = Math.min(totalPages, this.currentPage + 1);
        else this.currentPage = Number(val) || 1;
        this.renderAll();
      });
    });
  }

  renderRightDetailPanel(jobsData) {
    const target = jobsData.find(j => j.job === this.selectedJob) || jobsData[0];
    if (!target) return;

    if (this.detailJobTitle) this.detailJobTitle.textContent = `${target.job} 전투 분석`;
    if (this.detailJobAvatar) this.detailJobAvatar.textContent = target.job.charAt(0);

    const savedProfile = this.localDb?.savedJobBurstProfiles?.[target.job];
    if (this.detailBurstSourceBadge) {
      this.detailBurstSourceBadge.textContent = savedProfile
        ? `30초 극딜 비중 (🛠️ 사용자 수동 저장됨)`
        : `30초 극딜 비중 (660ms 표준 보정)`;
      this.detailBurstSourceBadge.style.color = savedProfile ? 'var(--orange)' : 'var(--text-3)';
    }

    const avgBurst = jobsData.reduce((a, b) => a + b.burst, 0) / jobsData.length;
    const diffBurst = Number((target.burst - avgBurst).toFixed(1));

    if (this.detailScoreRing) {
      const ringColor = target.burst >= this.burstThreshold ? 'var(--primary)' : 'var(--blue)';
      this.detailScoreRing.style.background = `radial-gradient(circle closest-side, var(--surface-2) 79%, transparent 80% 99%), conic-gradient(${ringColor} ${target.burst}%, var(--surface-3) 0)`;
    }
    if (this.detailBurstScoreVal) this.detailBurstScoreVal.textContent = String(target.burst);
    if (this.detailRoleTypeTitle) {
      this.detailRoleTypeTitle.textContent = target.burst >= this.burstThreshold ? '극딜형 직업' : '지속딜형(평딜) 직업';
    }
    if (this.detailBurstDiffText) {
      this.detailBurstDiffText.textContent = diffBurst >= 0
        ? `전체 직업 평균보다 ${diffBurst}%p 높아요.`
        : `전체 직업 평균보다 ${Math.abs(diffBurst)}%p 낮아요 (평딜 우세).`;
      this.detailBurstDiffText.style.color = diffBurst >= 0 ? 'var(--green)' : 'var(--blue)';
    }

    if (this.detailTriggerSkillSelect) {
      const isCombo = this.isComboJob(target.job);
      this.detailTriggerSkillSelect.innerHTML = `
        <option>${target.iframeName} / ${isCombo ? '🎹 8대 연계 직업 (' + target.comboWeapon + ')' : '🛋️ 비연계 표준 사이클'}</option>
      `;
    }

    if (this.rangeEndLabel) {
      this.rangeEndLabel.textContent = `+${this.burstWindowSec - 3}초`;
    }

    const burstDmgNum = Math.round(target.dpsNum * (target.burst / 100));
    const sustainDmgNum = Math.max(0, target.dpsNum - burstDmgNum);
    const apm = (target.normActions6m / 6).toFixed(1);

    if (this.metricBurstDmg) this.metricBurstDmg.textContent = formatKoreanNumber(burstDmgNum);
    if (this.metricSustainDmg) this.metricSustainDmg.textContent = formatKoreanNumber(sustainDmgNum);
    if (this.metricApmCasts) this.metricApmCasts.textContent = `${apm}회/분 (6분 ${target.normActions6m}회)`;
    if (this.metricBpEfficiency) this.metricBpEfficiency.textContent = target.efficiency;

    const cp = (Number(this.inlineSimCpInput?.value) || 10650) * 10000;
    const frag = Number(this.inlineSimFragInput?.value) || 5656;
    const bossHp = (Number(this.inlineSimBossHpInput?.value) || 779) * 1e12;
    const hexaRate = this.getInterpolatedHexaRate(target.job, frag);
    const rateAt40k = this.getInterpolatedHexaRate(target.job, 40000);
    const heroRateAt40k = this.getInterpolatedHexaRate('히어로', 40000);

    const stdIdx = HERO_CALIBRATED_FULL_INDEX * (target.stdDpmJo / HERO_BASELINE_DPM_JO) * (heroRateAt40k / rateAt40k);
    const myIdx = HERO_CALIBRATED_FULL_INDEX * (target.efficiencyNum / 7138);

    const stdRealDps = Math.round(cp * stdIdx * BP_EFF_TO_INDEX_DIVISOR * (hexaRate / 100) * 0.70 * 1.32);
    const myRealDps = Math.round(cp * myIdx * BP_EFF_TO_INDEX_DIVISOR * (hexaRate / 100) * 0.70 * 1.32);
    const stdSec = stdRealDps > 0 ? Math.round(bossHp / stdRealDps) : 0;

    if (this.calcHexaRateBadge) this.calcHexaRateBadge.textContent = `헥환 ${hexaRate}%`;
    if (this.calcStdRealDps) this.calcStdRealDps.textContent = `${formatKoreanNumber(stdRealDps)}/초`;
    if (this.calcMyRealDps) this.calcMyRealDps.textContent = `${formatKoreanNumber(myRealDps)}/초`;
    if (this.calcClearTimeText) this.calcClearTimeText.textContent = `약 ${Math.floor(stdSec / 60)}분 ${String(stdSec % 60).padStart(2, '0')}초`;
    if (this.calcUtilSummaryText) {
      this.calcUtilSummaryText.textContent = `권장 ${target.recHatSec > 0 ? target.recHatSec + '초뚝' : '스탯뚝'} · 무적 ${target.hasIframe ? target.iframeCoolSec + '초' : '없음'}`;
    }
  }

  renderInlineSimulator(jobsData) {
    if (!this.inlineSimRecommendList) return;

    const cp = (Number(this.inlineSimCpInput?.value) || 10650) * 10000;
    const frag = Number(this.inlineSimFragInput?.value) || 5656;
    const hatVal = this.inlineSimHatSelect?.value || 'REC';
    const iframeFilter = this.inlineSimIframeSelect?.value || 'ALL';
    const simSort = this.inlineSimSortSelect?.value || 'STD_DESC';

    const heroRateAt40k = this.getInterpolatedHexaRate('히어로', 40000);
    const trace = this.traceDecisionTreePath();

    let simItems = jobsData.map(j => {
      const activeHat = hatVal === 'REC' ? j.recHatSec : (Number(hatVal) || 0);
      const cool0 = calcMapleReducedCooldown(j.cdrBaseCool, 0);
      const coolAct = calcMapleReducedCooldown(j.cdrBaseCool, activeHat);
      const coolRec = calcMapleReducedCooldown(j.cdrBaseCool, j.recHatSec);

      const gainAct = activeHat > 0 && coolAct < cool0 ? j.cdrShare * ((cool0 / coolAct) - 1) * j.cdrEfficiencyFactor : 0;
      const gainRec = j.recHatSec > 0 && coolRec < cool0 ? j.cdrShare * ((cool0 / coolRec) - 1) * j.cdrEfficiencyFactor : 0;
      const gain4 = j.cdrShare * ((cool0 / calcMapleReducedCooldown(j.cdrBaseCool, 4)) - 1) * j.cdrEfficiencyFactor;

      const relMult = (1 + gainAct / 100) / (1 + gainRec / 100);
      const hexaRate = this.getInterpolatedHexaRate(j.job, frag);
      const rateAt40k = this.getInterpolatedHexaRate(j.job, 40000);

      const stdIdx = HERO_CALIBRATED_FULL_INDEX * (j.stdDpmJo / HERO_BASELINE_DPM_JO) * (heroRateAt40k / rateAt40k) * relMult;
      const revIdx = HERO_CALIBRATED_FULL_INDEX * (j.efficiencyNum / 7138) * relMult;

      const stdDps = Math.round(cp * stdIdx * BP_EFF_TO_INDEX_DIVISOR * (hexaRate / 100) * 0.70 * 1.32);
      const revDps = Math.round(cp * revIdx * BP_EFF_TO_INDEX_DIVISOR * (hexaRate / 100) * 0.70 * 1.32);
      const diffPct = stdDps > 0 ? Number((((revDps - stdDps) / stdDps) * 100).toFixed(2)) : 0;

      return {
        ...j,
        activeHat,
        hexaRate,
        stdDps,
        revDps,
        diffPct,
        gain4: Number(gain4.toFixed(1))
      };
    });

    // 질문 6에서 '아니오'(연계 제외)가 활성화된 상태라면 우측 미니 시뮬레이터에서도 카데나 등 8종을 즉시 숨김!
    if (trace.terminalRule === 'RESULT_NO_COMBO_SORT') {
      simItems = simItems.filter(it => !this.isComboJob(it.job));
    }

    if (iframeFilter === 'HAS_IFRAME') simItems = simItems.filter(it => it.hasIframe);
    else if (!isNaN(Number(iframeFilter)) && Number(iframeFilter) > 0) {
      const maxCool = Number(iframeFilter);
      simItems = simItems.filter(it => it.hasIframe && it.iframeCoolSec > 0 && it.iframeCoolSec <= maxCool);
    }

    if (simSort === 'REV_DESC') simItems.sort((a, b) => b.revDps - a.revDps);
    else if (simSort === 'CDR_DESC') simItems.sort((a, b) => b.gain4 - a.gain4);
    else simItems.sort((a, b) => b.stdDps - a.stdDps);

    if (this.inlineSimCountText) {
      this.inlineSimCountText.textContent = `${simItems.length}개 직업`;
    }

    this.inlineSimRecommendList.innerHTML = simItems.map((item, idx) => {
      const sign = item.diffPct >= 0 ? '+' : '';
      const hatLabel = item.activeHat > 0 ? `${item.activeHat}초뚝` : '스탯뚝';
      return `
        <article class="sim-card" data-job="${item.job}">
          <span class="sim-rank">${idx + 1}</span>
          <div class="sim-main">
            <div>
              <strong>${item.job}</strong>
              <span>${item.tag}(${item.burst}%) · 헥환 ${item.hexaRate}% · ${hatLabel} · 가용 ${item.normActions6m}회</span>
            </div>
            <div class="formula-values">
              <span style="color: var(--green); font-weight: 600;">
                <i class="standard-dot"></i>🟢 표준체급(Q3): ${formatKoreanNumber(item.stdDps)}/초
              </span>
              <span style="color: var(--blue); font-weight: 600;">
                <i class="reverse-dot"></i>🔵 내 역산공식: ${formatKoreanNumber(item.revDps)}/초
              </span>
            </div>
          </div>
          <span class="diff">${sign}${item.diffPct}%</span>
        </article>
      `;
    }).join('');

    this.inlineSimRecommendList.querySelectorAll('.sim-card').forEach(card => {
      card.addEventListener('click', () => this.selectJob(card.dataset.job));
    });
  }

  ensureJobSkillSelectionInitialized(jobName, skills) {
    if (!this.selectedBurstSkillMap[jobName]) {
      const savedProfile = this.localDb?.savedJobBurstProfiles?.[jobName];
      if (savedProfile && Array.isArray(savedProfile.selectedSkills) && savedProfile.selectedSkills.length > 0) {
        this.selectedBurstSkillMap[jobName] = new Set(savedProfile.selectedSkills);
      } else {
        const defaultSet = new Set();
        skills.forEach(sk => {
          if (sk.role === 'BURST' || sk.role === 'MAIN_660') {
            defaultSet.add(sk.name);
          }
        });
        this.selectedBurstSkillMap[jobName] = defaultSet;
      }
    }
    return this.selectedBurstSkillMap[jobName];
  }

  syncStudioFormInputs(jobName) {
    const meta = this.utilityDb[jobName] || DEFAULT_JOB_UTILITY_DB[jobName] || {};
    const savedBurst = this.localDb?.savedJobBurstProfiles?.[jobName]?.burstRate;

    if (this.studioJobSelect) this.studioJobSelect.value = jobName;
    if (this.studioJobTitle) this.studioJobTitle.textContent = `🛠️ ${jobName} 스킬·DB 직접 수정`;

    if (this.editJobBurstRate) this.editJobBurstRate.value = savedBurst ?? meta.burstRate ?? 55.0;
    if (this.editJobAttackStyle) {
      this.editJobAttackStyle.value = STRICT_COMBO_JOBS_DB[jobName] ? 'COMBO_CDR' : (meta.attackStyle === 'COMBO_CDR' ? 'HOLD_660' : (meta.attackStyle || 'HOLD_660'));
    }
    if (this.editJobStdDpmJo) this.editJobStdDpmJo.value = meta.stdDpmJo ?? 4.6;
    if (this.editJobBpEff) this.editJobBpEff.value = meta.bpEff ?? 7138;
    if (this.editJobRecHatSec) this.editJobRecHatSec.value = String(meta.recHatSec ?? 0);
    if (this.editJobCdrShare) this.editJobCdrShare.value = meta.cdrShare ?? 25;
    if (this.editJobCdrBaseCool) this.editJobCdrBaseCool.value = meta.cdrBaseCool ?? 15;
    if (this.editJobCdrEffFactor) this.editJobCdrEffFactor.value = meta.cdrEfficiencyFactor ?? 0.75;
    if (this.editJobHasIframe) this.editJobHasIframe.value = String(Boolean(meta.hasIframe));
    if (this.editJobIframeCool) this.editJobIframeCool.value = meta.iframeCoolSec ?? 0;
    if (this.editJobIframeName) this.editJobIframeName.value = meta.iframeName || '';
    if (this.editJobNormActions) this.editJobNormActions.value = meta.normActions6m ?? 620;
    if (this.editJobProcCasts) this.editJobProcCasts.value = meta.procCasts6m ?? 850;
  }

  renderCustomStudioPanel(jobsData) {
    const jobName = this.selectedJob;
    if (this.studioJobSelect && this.studioJobSelect.value !== jobName) {
      this.syncStudioFormInputs(jobName);
    }

    const allSkills = this.getJobSkillsForStudio(jobName);
    const selectedSet = this.ensureJobSkillSelectionInitialized(jobName, allSkills);

    if (this.studioSkillSourceLabel) {
      const hasReal = allSkills.some(s => s.isRealRecord);
      this.studioSkillSourceLabel.textContent = hasReal ? '실제 연무장 기록 연동됨' : '표준 스킬 템플릿 (커스텀 가능)';
    }

    const separatedSkills = allSkills.filter(sk => sk.role === 'BUFF' || sk.role === 'PROC');
    const activeCombatSkills = allSkills.filter(sk => sk.role !== 'BUFF');

    if (this.buffAndProcListBody) {
      if (separatedSkills.length === 0) {
        this.buffAndProcListBody.innerHTML = `<span style="font-size:10px; color:var(--text-3);">분리된 버프/시드링/사출기가 없습니다.</span>`;
      } else {
        this.buffAndProcListBody.innerHTML = `<div class="separated-pill-list">` +
          separatedSkills.map(sk => `
            <span class="separated-pill" data-restore-skill="${sk.name}" title="클릭하면 일반 공격 스킬(극딜기)로 복원합니다">
              ${sk.role === 'BUFF' ? '🛡️버프' : '👻사출'}: ${sk.name} (${sk.rate}%) ↩
            </span>
          `).join('') + `</div>`;

        this.buffAndProcListBody.querySelectorAll('[data-restore-skill]').forEach(pill => {
          pill.addEventListener('click', () => {
            const sName = pill.getAttribute('data-restore-skill');
            if (!this.localDb.manualSkillCategories) this.localDb.manualSkillCategories = {};
            if (!this.localDb.manualSkillCategories[jobName]) this.localDb.manualSkillCategories[jobName] = {};
            this.localDb.manualSkillCategories[jobName][sName] = 'BURST';
            selectedSet.add(sName);
            this.renderAll();
          });
        });
      }
    }

    let sumAttr30 = 0;
    let sumRaw = 0;
    const selectedNames = [];

    activeCombatSkills.forEach(sk => {
      const isSel = selectedSet.has(sk.name);
      if (isSel) {
        selectedNames.push(sk.name);
        sumRaw += Number(sk.rate) || 0;
      }
      const omega = 1.75;
      if (isSel) {
        if (sk.role === 'BURST') sumAttr30 += sk.rate;
        else if (sk.role === 'MAIN_660') sumAttr30 += sk.rate * ((30 * (omega - 1)) / (30 * omega + 90));
        else if (sk.n30 + sk.n90 > 0) sumAttr30 += sk.rate * ((sk.n30 * omega) / (sk.n30 * omega + sk.n90));
        else sumAttr30 += sk.rate * ((30 * omega) / (30 * omega + 90));
      }
    });

    sumAttr30 = Math.min(100, Number(sumAttr30.toFixed(1)));
    sumRaw = Math.min(100, Number(sumRaw.toFixed(1)));
    const activeCalcBurst = this.burstSumCalcMode === 'RAW_SUM' ? sumRaw : sumAttr30;

    if (this.selectedSkillCountText) this.selectedSkillCountText.textContent = String(selectedNames.length);
    if (this.chip30AttrVal) this.chip30AttrVal.textContent = `${sumAttr30}%`;
    if (this.chipRawSumVal) this.chipRawSumVal.textContent = `${sumRaw}%`;
    if (this.selectedBurstSumBtnText) this.selectedBurstSumBtnText.textContent = `${activeCalcBurst}%`;

    if (this.chip30AttrMode && this.chipRawSumMode) {
      this.chip30AttrMode.classList.toggle('active', this.burstSumCalcMode === 'ATTR_30');
      this.chipRawSumMode.classList.toggle('active', this.burstSumCalcMode === 'RAW_SUM');
    }

    if (this.selectedSkillNamesSummary) {
      this.selectedSkillNamesSummary.innerHTML = selectedNames.length > 0
        ? `📋 <b>선택된 극딜 귀속 스킬 (${selectedNames.length}개):</b> ${selectedNames.join(', ')}`
        : `📋 <b>선택된 스킬 없음 (0개):</b> 아래 스킬 행을 클릭해 극딜에 포함할 스킬을 선택하세요.`;
    }

    if (this.studioSkillListContainer) {
      this.studioSkillListContainer.innerHTML = activeCombatSkills.map(sk => {
        const isSel = selectedSet.has(sk.name);
        const contrib = this.calcSingleSkillBurstContribution(sk, isSel);
        return `
          <div class="studio-skill-item ${isSel ? 'selected-burst' : ''}" data-skill-name="${sk.name}">
            <div class="skill-item-left">
              <span class="skill-chk-indicator">✓</span>
              <div class="skill-name-wrap">
                <strong>${sk.name}</strong>
                <span>시전 ${sk.useCount.toLocaleString()}회 · 극딜귀속 +${contrib}%</span>
              </div>
            </div>
            <div class="skill-item-right">
              <span class="skill-rate-badge">${sk.rate}%</span>
              <select class="skill-role-select" data-role-skill="${sk.name}">
                <option value="BURST" ${sk.role === 'BURST' ? 'selected' : ''}>🔥극딜기</option>
                <option value="MAIN_660" ${sk.role === 'MAIN_660' ? 'selected' : ''}>⚡660ms주력</option>
                <option value="SUSTAIN" ${sk.role === 'SUSTAIN' ? 'selected' : ''}>🔄평딜기</option>
                <option value="PROC" ${sk.role === 'PROC' ? 'selected' : ''}>👻사출기</option>
                <option value="BUFF" ${sk.role === 'BUFF' ? 'selected' : ''}>🛡️버프분리</option>
              </select>
            </div>
          </div>
        `;
      }).join('');

      this.studioSkillListContainer.querySelectorAll('.studio-skill-item').forEach(row => {
        row.addEventListener('click', (e) => {
          if (e.target && e.target.tagName === 'SELECT') return;
          const sName = row.getAttribute('data-skill-name');
          if (selectedSet.has(sName)) selectedSet.delete(sName);
          else selectedSet.add(sName);
          this.renderCustomStudioPanel(jobsData);
        });
      });

      this.studioSkillListContainer.querySelectorAll('.skill-role-select').forEach(sel => {
        sel.addEventListener('click', e => e.stopPropagation());
        sel.addEventListener('change', () => {
          const sName = sel.getAttribute('data-role-skill');
          const newRole = sel.value;
          if (!this.localDb.manualSkillCategories) this.localDb.manualSkillCategories = {};
          if (!this.localDb.manualSkillCategories[jobName]) this.localDb.manualSkillCategories[jobName] = {};
          this.localDb.manualSkillCategories[jobName][sName] = newRole;

          if (newRole === 'BURST' || newRole === 'MAIN_660') selectedSet.add(sName);
          else if (newRole === 'PROC' || newRole === 'BUFF') selectedSet.delete(sName);

          this.renderAll();
        });
      });
    }
  }

  selectJob(jobName) {
    if (!jobName) return;
    this.selectedJob = jobName;
    this.syncStudioFormInputs(jobName);
    this.renderAll();
  }

  async handleSaveJobCustomDb() {
    const job = this.selectedJob;
    if (!this.utilityDb[job]) this.utilityDb[job] = {};

    const manualBurst = Number(this.editJobBurstRate?.value);
    const validBurst = !isNaN(manualBurst) ? Math.min(100, Math.max(5, Number(manualBurst.toFixed(1)))) : 55.0;

    this.utilityDb[job] = {
      ...this.utilityDb[job],
      burstRate: validBurst,
      attackStyle: this.editJobAttackStyle?.value || 'HOLD_660',
      stdDpmJo: Number(this.editJobStdDpmJo?.value) || 4.6,
      bpEff: Number(this.editJobBpEff?.value) || 7138,
      recHatSec: Number(this.editJobRecHatSec?.value) || 0,
      cdrShare: Number(this.editJobCdrShare?.value) || 25,
      cdrBaseCool: Number(this.editJobCdrBaseCool?.value) || 15,
      cdrEfficiencyFactor: Number(this.editJobCdrEffFactor?.value) || 0.75,
      hasIframe: this.editJobHasIframe?.value === 'true',
      iframeCoolSec: Number(this.editJobIframeCool?.value) || 0,
      iframeName: this.editJobIframeName?.value || '정보 없음',
      normActions6m: Number(this.editJobNormActions?.value) || 620,
      procCasts6m: Number(this.editJobProcCasts?.value) || 850
    };

    if (!this.localDb.savedJobBurstProfiles) this.localDb.savedJobBurstProfiles = {};
    const selSet = this.selectedBurstSkillMap[job] || new Set();
    this.localDb.savedJobBurstProfiles[job] = {
      burstRate: validBurst,
      selectedSkills: Array.from(selSet),
      updatedAt: new Date().toISOString()
    };

    await this.persistAllCustomDataToLocalDb(`💾 [${job}] 커스텀 DB(극딜 ${validBurst}%)가 로컬 DB 및 시뮬레이터에 저장되었습니다!`);
    this.renderAll();
  }

  async handleResetJobCustomDb() {
    const job = this.selectedJob;
    if (DEFAULT_JOB_UTILITY_DB[job]) {
      this.utilityDb[job] = JSON.parse(JSON.stringify(DEFAULT_JOB_UTILITY_DB[job]));
    }
    this.normalizeStrictComboAttackStyles();
    if (this.localDb?.savedJobBurstProfiles?.[job]) delete this.localDb.savedJobBurstProfiles[job];
    if (this.localDb?.manualSkillCategories?.[job]) delete this.localDb.manualSkillCategories[job];
    if (this.localDb?.customJobSkills?.[job]) delete this.localDb.customJobSkills[job];
    delete this.selectedBurstSkillMap[job];

    this.syncStudioFormInputs(job);
    await this.persistAllCustomDataToLocalDb(`🔄 [${job}] 설정이 기본값으로 초기화되었습니다.`);
    this.renderAll();
  }

  async handleLoadAccount() {
    const apiKey = (this.apiKeyInput?.value || '').trim();
    if (!apiKey) {
      if (this.apiStatusBadge) {
        this.apiStatusBadge.textContent = 'Key 필요';
        this.apiStatusBadge.style.color = 'var(--red)';
      }
      return;
    }

    localStorage.setItem('NEXON_OPEN_API_KEY', apiKey);
    if (this.apiStatusBadge) {
      this.apiStatusBadge.textContent = '조회 중...';
      this.apiStatusBadge.style.color = 'var(--orange)';
    }

    try {
      const res = await fetch('https://open.api.nexon.com/maplestory/v1/character/list', {
        headers: { 'x-nxopen-api-key': apiKey }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const worldFilter = this.worldFilterSelect?.value || 'ALL';
      const maxLv = Number(this.maxLevelInput?.value) || 300;
      const lowLimit = Number(this.recLowLevelLimitInput?.value) || 260;

      const chars = [];
      let idx = 0;
      (data.account_list || []).forEach(acc => {
        (acc.character_list || []).forEach(ch => {
          if ((worldFilter === 'ALL' || ch.world_name === worldFilter) && ch.character_level <= maxLv) {
            idx++;
            chars.push({
              id: `api_char_${idx}_${ch.character_name}`,
              nickname: ch.character_name,
              job: ch.character_class,
              level: ch.character_level,
              world: ch.world_name
            });
          }
        });
      });

      chars.sort((a, b) => a.level - b.level);
      this.accountCharacters = chars;

      this.selectedLowCharIds = new Set(
        chars.filter(c => c.level <= lowLimit).map(c => c.id)
      );

      if (this.apiStatusBadge) {
        this.apiStatusBadge.textContent = `${chars.length}명 로드됨`;
        this.apiStatusBadge.style.color = 'var(--green)';
      }
      this.renderAll();
    } catch (err) {
      if (this.apiStatusBadge) {
        this.apiStatusBadge.textContent = '조회 실패';
        this.apiStatusBadge.style.color = 'var(--red)';
      }
    }
  }

  updateWorkspaceGridClasses() {
    if (!this.mainWorkspace) return;
    this.mainWorkspace.classList.toggle('without-detail', !this.rightOpen);
    this.mainWorkspace.classList.toggle('with-studio', this.studioOpen);
    if (this.rightDetailPanel) this.rightDetailPanel.classList.toggle('hidden', !this.rightOpen);
    if (this.customDbStudioPanel) this.customDbStudioPanel.classList.toggle('hidden', !this.studioOpen);
    if (this.toggleCustomStudioBtn) {
      this.toggleCustomStudioBtn.classList.toggle('active-studio-btn', this.studioOpen);
      this.toggleCustomStudioBtn.textContent = this.studioOpen ? '🛠️ 스킬·DB 커스텀 설정 닫기' : '🛠️ 스킬·DB 커스텀 설정 열기';
    }
  }

  bindEvents() {
    if (this.toggleMainRecommendBtn) {
      this.toggleMainRecommendBtn.addEventListener('click', () => {
        const nextMode = this.mainCenterViewMode === 'recommend' ? 'analytics' : 'recommend';
        this.switchMainCenterView(nextMode);
      });
    }
    if (this.studioOpenRecommendWizardBtn) {
      this.studioOpenRecommendWizardBtn.addEventListener('click', () => {
        this.switchMainCenterView('recommend');
      });
    }
    if (this.backToAnalyticsBtn) {
      this.backToAnalyticsBtn.addEventListener('click', () => {
        this.switchMainCenterView('analytics');
      });
    }

    if (this.recLowLevelLimitInput) {
      this.recLowLevelLimitInput.addEventListener('input', () => this.renderAll());
    }
    if (this.selectAllLowCharsBtn) {
      this.selectAllLowCharsBtn.addEventListener('click', () => {
        const maxLowLv = Number(this.recLowLevelLimitInput?.value) || 260;
        const trace = this.traceDecisionTreePath();
        const excludeCombo = trace.terminalRule === 'RESULT_NO_COMBO_SORT';
        this.accountCharacters.forEach(ch => {
          if ((Number(ch.level) || 200) <= maxLowLv) {
            if (!excludeCombo || !this.isComboJob(ch.job)) {
              this.selectedLowCharIds.add(ch.id);
            }
          }
        });
        this.renderAll();
      });
    }
    if (this.clearSelectedLowCharsBtn) {
      this.clearSelectedLowCharsBtn.addEventListener('click', () => {
        this.selectedLowCharIds.clear();
        this.renderAll();
      });
    }
    if (this.loadSampleLowCharsBtn) {
      this.loadSampleLowCharsBtn.addEventListener('click', () => {
        this.accountCharacters = [
          { id: 'sample_1', nickname: '유니온아란', job: '아란', level: 200, world: '스카니아' },
          { id: 'sample_2', nickname: '링크메르', job: '메르세데스', level: 210, world: '스카니아' },
          { id: 'sample_3', nickname: '주보히어로', job: '히어로', level: 215, world: '스카니아' },
          { id: 'sample_4', nickname: '체급카데나', job: '카데나', level: 220, world: '스카니아' },
          { id: 'sample_5', nickname: '무적미하일', job: '미하일', level: 220, world: '스카니아' },
          { id: 'sample_6', nickname: '극딜카이저', job: '카이저', level: 225, world: '스카니아' },
          { id: 'sample_7', nickname: '평딜불독', job: '아크메이지(불,독)', level: 230, world: '스카니아' },
          { id: 'sample_8', nickname: '배트나워', job: '나이트워커', level: 235, world: '스카니아' },
          { id: 'sample_9', nickname: '해신스커', job: '스트라이커', level: 240, world: '스카니아' },
          { id: 'sample_10', nickname: '속사보마', job: '보우마스터', level: 245, world: '스카니아' },
          { id: 'sample_11', nickname: '도원호영', job: '호영', level: 250, world: '스카니아' },
          { id: 'sample_12', nickname: '사슬듀블', job: '듀얼블레이드', level: 255, world: '스카니아' }
        ];
        this.selectedLowCharIds = new Set(this.accountCharacters.map(c => c.id));
        this.renderAll();
      });
    }

    if (this.recTargetCpMan) this.recTargetCpMan.addEventListener('input', () => this.renderAll());
    if (this.recTargetFrags) this.recTargetFrags.addEventListener('input', () => this.renderAll());
    if (this.recPerfFormulaToggle) this.recPerfFormulaToggle.addEventListener('change', () => this.renderAll());
    if (this.recCastOrderToggle) this.recCastOrderToggle.addEventListener('change', () => this.renderAll());

    if (this.resetSurveyTreeBtn) {
      this.resetSurveyTreeBtn.addEventListener('click', () => {
        this.focusedQuestionId = 'Q1';
        this.renderAll();
      });
    }

    if (this.toggleExtensionBtn) {
      this.toggleExtensionBtn.addEventListener('click', () => {
        this.rightOpen = !this.rightOpen;
        this.updateWorkspaceGridClasses();
        this.toggleExtensionBtn.innerHTML = `${createIconSvg('bolt', 16)} ${this.rightOpen ? '분석 패널 닫기' : '분석 패널 열기'}`;
      });
    }

    if (this.toggleCustomStudioBtn) {
      this.toggleCustomStudioBtn.addEventListener('click', () => {
        this.studioOpen = !this.studioOpen;
        this.updateWorkspaceGridClasses();
      });
    }
    if (this.closeStudioPanelBtn) {
      this.closeStudioPanelBtn.addEventListener('click', () => {
        this.studioOpen = false;
        this.updateWorkspaceGridClasses();
      });
    }

    if (this.topQuickSearchBtn) {
      this.topQuickSearchBtn.addEventListener('click', () => {
        this.showAllJobs = !this.showAllJobs;
        this.topQuickSearchBtn.innerHTML = `${createIconSvg('search', 16)} ${this.showAllJobs ? '12개씩 페이지 보기' : '전체 48직업 펼치기'}`;
        this.renderAll();
      });
    }

    if (this.rankJobFilter) {
      this.rankJobFilter.addEventListener('change', () => {
        const val = this.rankJobFilter.value;
        if (val && val !== 'ALL') this.selectJob(val);
      });
    }

    if (this.studioJobSelect) {
      this.studioJobSelect.addEventListener('change', () => {
        this.selectJob(this.studioJobSelect.value);
      });
    }
    if (this.saveJobCustomDbBtn) {
      this.saveJobCustomDbBtn.addEventListener('click', () => this.handleSaveJobCustomDb());
    }
    if (this.resetJobCustomDbBtn) {
      this.resetJobCustomDbBtn.addEventListener('click', () => this.handleResetJobCustomDb());
    }

    if (this.studioSubTabs) {
      this.studioSubTabs.querySelectorAll('button[data-stab]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.studioSubTab = btn.dataset.stab;
          this.studioSubTabs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.studioSkillsTabView?.classList.toggle('hidden', this.studioSubTab !== 'skills');
          this.studioParamsTabView?.classList.toggle('hidden', this.studioSubTab !== 'params');
        });
      });
    }

    if (this.toggleBuffListAccordionBtn && this.buffAndProcListBody) {
      this.toggleBuffListAccordionBtn.addEventListener('click', () => {
        this.buffAndProcListBody.classList.toggle('hidden');
      });
    }

    if (this.chip30AttrMode) {
      this.chip30AttrMode.addEventListener('click', () => {
        this.burstSumCalcMode = 'ATTR_30';
        this.renderAll();
      });
    }
    if (this.chipRawSumMode) {
      this.chipRawSumMode.addEventListener('click', () => {
        this.burstSumCalcMode = 'RAW_SUM';
        this.renderAll();
      });
    }

    if (this.selectAllBurstSkillsBtn) {
      this.selectAllBurstSkillsBtn.addEventListener('click', () => {
        const skills = this.getJobSkillsForStudio(this.selectedJob);
        const set = new Set();
        skills.forEach(sk => {
          if (sk.role === 'BURST' || sk.role === 'MAIN_660') set.add(sk.name);
        });
        this.selectedBurstSkillMap[this.selectedJob] = set;
        this.renderAll();
      });
    }
    if (this.clearAllBurstSkillsBtn) {
      this.clearAllBurstSkillsBtn.addEventListener('click', () => {
        this.selectedBurstSkillMap[this.selectedJob] = new Set();
        this.renderAll();
      });
    }

    if (this.applySelectedBurstRateBtn) {
      this.applySelectedBurstRateBtn.addEventListener('click', async () => {
        const rawText = (this.selectedBurstSumBtnText?.textContent || '50').replace('%', '');
        const newRate = Number(rawText) || 50.0;
        if (this.editJobBurstRate) this.editJobBurstRate.value = newRate;
        await this.handleSaveJobCustomDb();
      });
    }

    if (this.addCustomSkillBtn) {
      this.addCustomSkillBtn.addEventListener('click', () => {
        const sName = (this.newCustomSkillName?.value || '').trim();
        const sRate = Number(this.newCustomSkillRate?.value) || 5.0;
        const sRole = this.newCustomSkillRole?.value || 'BURST';
        if (!sName) return;

        if (!this.localDb.customJobSkills) this.localDb.customJobSkills = {};
        if (!this.localDb.customJobSkills[this.selectedJob]) this.localDb.customJobSkills[this.selectedJob] = [];
        this.localDb.customJobSkills[this.selectedJob].push({ name: sName, rate: sRate, role: sRole });

        const set = this.ensureJobSkillSelectionInitialized(this.selectedJob, []);
        if (sRole === 'BURST' || sRole === 'MAIN_660') set.add(sName);

        if (this.newCustomSkillName) this.newCustomSkillName.value = '';
        if (this.newCustomSkillRate) this.newCustomSkillRate.value = '';
        this.renderAll();
      });
    }

    if (this.toggleApiKeyVisBtn && this.apiKeyInput) {
      this.toggleApiKeyVisBtn.addEventListener('click', () => {
        const isPw = this.apiKeyInput.type === 'password';
        this.apiKeyInput.type = isPw ? 'text' : 'password';
        this.toggleApiKeyVisBtn.textContent = isPw ? '숨김' : '보기';
      });
    }
    if (this.loadAccountBtn) {
      this.loadAccountBtn.addEventListener('click', () => this.handleLoadAccount());
    }

    if (this.nicknameSearchInput) {
      this.nicknameSearchInput.addEventListener('input', () => {
        this.searchQuery = this.nicknameSearchInput.value;
        this.currentPage = 1;
        const exactJob = MASTER_JOB_LIST.find(j => j === this.searchQuery.trim());
        if (exactJob) this.selectJob(exactJob);
        else this.renderAll();
      });
    }
    if (this.nicknameSearchBtn) {
      this.nicknameSearchBtn.addEventListener('click', () => {
        this.searchQuery = this.nicknameSearchInput?.value || '';
        this.renderAll();
      });
    }

    if (this.charViewIndivBtn && this.charViewJobBtn) {
      this.charViewIndivBtn.addEventListener('click', () => {
        this.charViewMode = 'indiv';
        this.charViewIndivBtn.classList.add('active');
        this.charViewJobBtn.classList.remove('active');
        this.renderAll();
      });
      this.charViewJobBtn.addEventListener('click', () => {
        this.charViewMode = 'job';
        this.charViewJobBtn.classList.add('active');
        this.charViewIndivBtn.classList.remove('active');
        this.renderAll();
      });
    }

    if (this.cycleThresholdBtn) {
      this.cycleThresholdBtn.addEventListener('click', () => {
        const nextMap = { 50: 55, 55: 45, 45: 50 };
        this.burstThreshold = nextMap[this.burstThreshold] || 50;
        this.renderAll();
      });
    }

    if (this.seasonFilterSelect) {
      this.seasonFilterSelect.addEventListener('change', () => this.renderAll());
    }
    if (this.mainJobFilterSelect) {
      this.mainJobFilterSelect.addEventListener('change', () => {
        const val = this.mainJobFilterSelect.value;
        if (val !== 'ALL') this.selectJob(val);
        else {
          this.currentPage = 1;
          this.renderAll();
        }
      });
    }

    if (this.mainContentTabs) {
      this.mainContentTabs.querySelectorAll('button[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.activeTab = btn.dataset.tab;
          this.mainContentTabs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.renderAll();
        });
      });
    }

    if (this.cycleSortModeBtn) {
      this.cycleSortModeBtn.addEventListener('click', () => {
        const modes = ['EFF_DESC', 'STD_DESC', 'BURST_DESC', 'ACT_ASC'];
        const nextIdx = (modes.indexOf(this.sortMode) + 1) % modes.length;
        this.sortMode = modes[nextIdx];
        this.renderAll();
      });
    }

    if (this.detailModeTabs) {
      this.detailModeTabs.querySelectorAll('button[data-dmode]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.detailMode = btn.dataset.dmode;
          this.detailModeTabs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.detailBurstView?.classList.toggle('hidden', this.detailMode !== 'burst');
          this.detailCalcView?.classList.toggle('hidden', this.detailMode !== 'calc');
        });
      });
    }

    if (this.detailRangeAccordionBtn && this.detailRangeAccordionBody) {
      this.detailRangeAccordionBtn.addEventListener('click', () => {
        this.detailRangeAccordionBody.classList.toggle('hidden');
      });
    }
    if (this.burstWindowPresetRow) {
      this.burstWindowPresetRow.querySelectorAll('button[data-window]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.burstWindowSec = Number(btn.dataset.window) || 30;
          this.burstWindowPresetRow.querySelectorAll('button').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.renderAll();
        });
      });
    }

    if (this.inlineSimTabs) {
      this.inlineSimTabs.querySelectorAll('button[data-simtab]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.simTab = btn.dataset.simtab;
          this.inlineSimTabs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.inlineSimRecommendList?.classList.toggle('hidden', this.simTab !== 'recommend');
          this.inlineSimSettingsPanel?.classList.toggle('hidden', this.simTab !== 'settings');
        });
      });
    }

    [
      this.inlineSimCpInput,
      this.inlineSimFragInput,
      this.inlineSimHatSelect,
      this.inlineSimIframeSelect,
      this.inlineSimBossHpInput,
      this.inlineSimSortSelect
    ].forEach(el => {
      if (el) {
        el.addEventListener('input', () => this.renderAll());
        el.addEventListener('change', () => this.renderAll());
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new MapleLabDashboard();
});