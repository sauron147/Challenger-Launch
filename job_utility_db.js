/**
 * 전 직업 5기 연무장 체급, 660ms 표준 액션 딜레이 정규화 타수,
 * 사출기 비중, 쿨뚝(2초/4초 등) 유효율 및 무적기 통합 데이터베이스
 */

const HERO_CALIBRATED_FULL_INDEX = 819.5;
const HERO_BASELINE_DPM_JO = 4.6907;
const BP_EFF_TO_INDEX_DIVISOR = 12;

// 메이플 표준 풀공속 액션 딜레이 (660ms) 및 6분(360,000ms) 이론상 연속 주력기 상한 타수(약 545회)
const STANDARD_ACTION_DELAY_MS = 660;
const MAX_CONTINUOUS_STD_ACTIONS_6M = Math.round(360000 / STANDARD_ACTION_DELAY_MS); // 545회

// 사출기 / 파이널 어택 / 자동 발동 패시브 판별 키워드 (660ms 액션 딜레이 미소모)
const PASSIVE_PROC_SKILL_KEYWORDS = [
  '파이널 어택', '어드밴스드 파이널 어택', '트라이플링 윔', '스톰 브링어', '쉐도우 배트', '래비드 배트',
  '메소 익스플로전', '블리자드', '이그니션', '여우령', '불여우령', '오르골', '자유로운 영혼', '살랑이는 바람',
  '호밍 미사일', '마력장', '블레이드 퓨리(추가타)', '에테르 소드', '크리에이션', '오더', '와일드 발칸(사출)',
  '일루전 스텝', '키네틱 자운트', '매직 서킷', '로얄 가드(반격)', '빛의 창', '잔영의 시(패시브)', '가이디드 애로우'
];

// 키다운(Keydown) 극딜기 및 속사기 판별 키워드 (틱 간격 약 120~150ms -> 660ms 표준 액션으로 정규화 대상)
const KEYDOWN_SKILL_KEYWORDS = [
  '폭풍의 시', '이슈타르의 링', '래피드 파이어', '와일드 발칸', '조커', '메가 스매셔', '퓨리 오브 이프리트',
  '소닉 블로우', '아스트라', '에인션트 아스트라', '근원의 기억', '이터니티', '프레이', '림보', '싸이킥 드레인',
  '불스아이', '페어리 턴', '브레스 오브 어스', '다이브 오브 어스', '드라코 슬래셔(키다운)', '뇌신창격'
];

// 메이플 인게임 쿨타임 감소 모자(쿨뚝) 공식 계산 함수
function calcMapleReducedCooldown(baseCoolSec, hatReduceSec, mercedesUnionPct = 5) {
  if (!baseCoolSec || baseCoolSec < 5 || hatReduceSec <= 0) return baseCoolSec;
  // 1. 메르세데스 유니온 선적용
  let cool = baseCoolSec * (1 - mercedesUnionPct / 100);
  if (cool <= 5) return 5;

  let remReduce = Number(hatReduceSec) || 0;

  // 2. 10초 초과 구간: 초 단위 정량 감소
  if (cool > 10) {
    const aboveTen = cool - 10;
    if (remReduce <= aboveTen) {
      return Number((cool - remReduce).toFixed(2));
    } else {
      cool = 10;
      remReduce -= aboveTen;
    }
  }

  // 3. 5초 ~ 10초 이하 구간: 남은 쿨감 1초당 5%씩 감소 (하한선 5초)
  if (remReduce > 0 && cool > 5) {
    const pctReduce = Math.min(0.5, remReduce * 0.05);
    cool = cool * (1 - pctReduce);
  }

  return Number(Math.max(5.0, cool).toFixed(2));
}

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
  '아델': [[62.30, 2010], [71.06, 5019], [79.03, 10163], [88.72, 19933], [98.38, 39954]],
  '메르세데스': [[62.25, 2009], [69.94, 4966], [77.31, 9959], [87.59, 20284], [98.28, 40069]],
  '캐논슈터': [[61.46, 2019], [70.05, 4798], [78.45, 9961], [88.85, 20186], [98.16, 39865]],
  '라라': [[61.29, 1957], [70.61, 5072], [78.19, 9809], [87.95, 19857], [97.89, 39518]],
  '바이퍼': [[61.01, 2019], [68.61, 4779], [76.86, 9997], [87.49, 20354], [98.31, 39442]],
  '미하일': [[60.72, 1988], [69.15, 5031], [77.18, 10296], [87.42, 19907], [98.07, 39550]],
  '카데나': [[60.11, 1782], [70.73, 4996], [79.58, 9879], [88.79, 19483], [98.48, 39996]],
  '스트라이커': [[59.67, 1977], [68.60, 5004], [76.89, 10115], [87.42, 19714], [98.67, 41462]],
  '비숍': [[59.42, 1989], [69.57, 5149], [77.33, 10038], [87.79, 20269], [97.97, 39935]]
};

/**
 * 48개 전 직업 통합 메타데이터
 * - stdDpmJo: 5기 연무장(헥환 11만, 48개 직업 기본 장착 쿨뚝 포함) 평균 딜량(조)
 * - recHatSec: 연무장 표본 기준 표준 장착 모자(0=스탯뚝, 2=2초뚝, 4=4초뚝)
 * - cdrShare: 쿨뚝 영향을 받는 유효 스킬 딜 비중 합계(%)
 * - cdrBaseCool: 쿨뚝 주력 스킬의 가중 평균 쿨타임(초)
 * - cdrEfficiencyFactor: 실전 쿨감 회전율 계수 (0.5 ~ 0.92)
 * - normActions6m: 사출기/파이널어택 제거 및 키다운을 660ms로 정규화한 6분간 실제 조작 액션 수
 * - procCasts6m: 6분간 자동 발동된 사출기/파이널어택/소환수 타수 (분리 표기용)
 * - attackStyle: 'HOLD_660'(660ms 주력기 유지형), 'KEYDOWN_BURST'(키다운 극딜 포함형), 'COMBO_CDR'(쿨감 연계형)
 */
const DEFAULT_JOB_UTILITY_DB = {
  '카데나': { rank11: 1, stdDpmJo: 4.965, bpEff: 7401, burstRate: 27.6, normActions6m: 920, procCasts6m: 1530, recHatSec: 4, cdrShare: 58.0, cdrBaseCool: 11.5, cdrEfficiencyFactor: 0.88, attackStyle: 'COMBO_CDR', hasIframe: true, iframeCoolSec: 60, iframeName: '체인아츠:퓨리 / 크러시', hasBind: true, difficulty: '어려움' },
  '카이저': { rank11: 2, stdDpmJo: 4.940, bpEff: 7914, burstRate: 59.6, normActions6m: 610, procCasts6m: 810, recHatSec: 4, cdrShare: 52.0, cdrBaseCool: 10.0, cdrEfficiencyFactor: 0.86, attackStyle: 'KEYDOWN_BURST', hasIframe: true, iframeCoolSec: 60, iframeName: '프로미넌스 / 마제스티', hasBind: false, difficulty: '쉬움' },
  '호영': { rank11: 3, stdDpmJo: 4.930, bpEff: 7738, burstRate: 59.8, normActions6m: 640, procCasts6m: 940, recHatSec: 2, cdrShare: 26.0, cdrBaseCool: 25.0, cdrEfficiencyFactor: 0.72, attackStyle: 'HOLD_660', hasIframe: true, iframeCoolSec: 40, iframeName: '몽유도원(짧쿨 조절 무적)', hasBind: true, difficulty: '보통' },
  '아크메이지(불,독)': { rank11: 4, stdDpmJo: 4.895, bpEff: 7299, burstRate: 34.3, normActions6m: 780, procCasts6m: 1110, recHatSec: 4, cdrShare: 64.0, cdrBaseCool: 16.0, cdrEfficiencyFactor: 0.90, attackStyle: 'KEYDOWN_BURST', hasIframe: true, iframeCoolSec: 45, iframeName: '에테리얼 폼', hasBind: false, difficulty: '보통' },
  '스트라이커': { rank11: 5, stdDpmJo: 4.885, bpEff: 7752, burstRate: 57.9, normActions6m: 740, procCasts6m: 1210, recHatSec: 2, cdrShare: 32.0, cdrBaseCool: 14.0, cdrEfficiencyFactor: 0.75, attackStyle: 'COMBO_CDR', hasIframe: true, iframeCoolSec: 45, iframeName: '해신강림(무적)', hasBind: false, difficulty: '보통' },
  '카인': { rank11: 6, stdDpmJo: 4.865, bpEff: 7424, burstRate: 61.2, normActions6m: 710, procCasts6m: 1010, recHatSec: 2, cdrShare: 35.0, cdrBaseCool: 18.0, cdrEfficiencyFactor: 0.76, attackStyle: 'KEYDOWN_BURST', hasIframe: true, iframeCoolSec: 40, iframeName: '쉐도우 스위프트 / 타나토스', hasBind: false, difficulty: '보통' },
  '듀얼블레이드': { rank11: 7, stdDpmJo: 4.845, bpEff: 7310, burstRate: 54.8, normActions6m: 690, procCasts6m: 960, recHatSec: 4, cdrShare: 54.0, cdrBaseCool: 13.0, cdrEfficiencyFactor: 0.85, attackStyle: 'KEYDOWN_BURST', hasIframe: true, iframeCoolSec: 30, iframeName: '사슬지옥 / 파이널 컷', hasBind: false, difficulty: '보통' },
  '칼리': { rank11: 8, stdDpmJo: 4.810, bpEff: 7176, burstRate: 62.0, normActions6m: 760, procCasts6m: 1060, recHatSec: 4, cdrShare: 55.0, cdrBaseCool: 12.0, cdrEfficiencyFactor: 0.86, attackStyle: 'COMBO_CDR', hasIframe: true, iframeCoolSec: 60, iframeName: '레조네이트:얼티메이텀', hasBind: true, difficulty: '보통' },
  '루미너스': { rank11: 9, stdDpmJo: 4.760, bpEff: 7350, burstRate: 63.2, normActions6m: 580, procCasts6m: 800, recHatSec: 2, cdrShare: 28.0, cdrBaseCool: 20.0, cdrEfficiencyFactor: 0.70, attackStyle: 'HOLD_660', hasIframe: true, iframeCoolSec: 45, iframeName: '에테리얼 폼 / 아마겟돈', hasBind: true, difficulty: '쉬움' },
  '다크나이트': { rank11: 10, stdDpmJo: 4.725, bpEff: 7447, burstRate: 61.1, normActions6m: 630, procCasts6m: 860, recHatSec: 4, cdrShare: 51.0, cdrBaseCool: 12.5, cdrEfficiencyFactor: 0.85, attackStyle: 'HOLD_660', hasIframe: true, iframeCoolSec: 90, iframeName: '리인카네이션(사망방지)', hasBind: false, difficulty: '쉬움' },
  '메르세데스': { rank11: 11, stdDpmJo: 4.715, bpEff: 7272, burstRate: 63.8, normActions6m: 790, procCasts6m: 1390, recHatSec: 2, cdrShare: 30.0, cdrBaseCool: 16.0, cdrEfficiencyFactor: 0.74, attackStyle: 'KEYDOWN_BURST', hasIframe: true, iframeCoolSec: 60, iframeName: '프리드 / 로얄 나이츠', hasBind: false, difficulty: '어려움' },
  '섀도어': { rank11: 12, stdDpmJo: 4.700, bpEff: 7190, burstRate: 50.5, normActions6m: 770, procCasts6m: 1350, recHatSec: 4, cdrShare: 49.0, cdrBaseCool: 14.0, cdrEfficiencyFactor: 0.84, attackStyle: 'KEYDOWN_BURST', hasIframe: true, iframeCoolSec: 20, iframeName: '절개(무적) / 연막탄', hasBind: false, difficulty: '보통' },
  '히어로': { rank11: 13, stdDpmJo: 4.6907, bpEff: 7138, burstRate: 38.2, normActions6m: 560, procCasts6m: 780, recHatSec: 0, cdrShare: 14.0, cdrBaseCool: 20.0, cdrEfficiencyFactor: 0.60, attackStyle: 'HOLD_660', hasIframe: true, iframeCoolSec: 20, iframeName: '블레이드 임팩트(짧쿨무적)', hasBind: false, difficulty: '쉬움' },
  '에반': { rank11: 14, stdDpmJo: 4.675, bpEff: 7065, burstRate: 53.3, normActions6m: 750, procCasts6m: 1170, recHatSec: 4, cdrShare: 56.0, cdrBaseCool: 13.5, cdrEfficiencyFactor: 0.86, attackStyle: 'COMBO_CDR', hasIframe: true, iframeCoolSec: 45, iframeName: '에테리얼 폼 / 드래곤 마스터', hasBind: false, difficulty: '어려움' },
  '아란': { rank11: 15, stdDpmJo: 4.670, bpEff: 7002, burstRate: 31.2, normActions6m: 660, procCasts6m: 1090, recHatSec: 0, cdrShare: 18.0, cdrBaseCool: 22.0, cdrEfficiencyFactor: 0.65, attackStyle: 'HOLD_660', hasIframe: true, iframeCoolSec: 60, iframeName: '프리드 / 아드레날린 무적', hasBind: true, difficulty: '쉬움' },
  '아델': { rank11: 16, stdDpmJo: 4.660, bpEff: 7344, burstRate: 60.8, normActions6m: 720, procCasts6m: 1120, recHatSec: 2, cdrShare: 38.0, cdrBaseCool: 15.0, cdrEfficiencyFactor: 0.78, attackStyle: 'COMBO_CDR', hasIframe: true, iframeCoolSec: 30, iframeName: '다이크(가드 무적) / 인피니트', hasBind: true, difficulty: '보통' },
  '제로': { rank11: 17, stdDpmJo: 4.650, bpEff: 7324, burstRate: 52.0, normActions6m: 840, procCasts6m: 1420, recHatSec: 4, cdrShare: 52.0, cdrBaseCool: 14.0, cdrEfficiencyFactor: 0.85, attackStyle: 'COMBO_CDR', hasIframe: true, iframeCoolSec: 60, iframeName: '타임 홀딩(무적+쿨초) / 조인트', hasBind: true, difficulty: '어려움' },
  '나이트로드': { rank11: 18, stdDpmJo: 4.645, bpEff: 7153, burstRate: 47.5, normActions6m: 550, procCasts6m: 740, recHatSec: 0, cdrShare: 12.0, cdrBaseCool: 25.0, cdrEfficiencyFactor: 0.55, attackStyle: 'HOLD_660', hasIframe: false, iframeCoolSec: 0, iframeName: '다크 사이트(일반무적 없음)', hasBind: false, difficulty: '쉬움' },
  '아크': { rank11: 19, stdDpmJo: 4.640, bpEff: 7125, burstRate: 55.6, normActions6m: 730, procCasts6m: 1060, recHatSec: 4, cdrShare: 48.0, cdrBaseCool: 14.0, cdrEfficiencyFactor: 0.83, attackStyle: 'KEYDOWN_BURST', hasIframe: true, iframeCoolSec: 45, iframeName: '근원의 기억 / 기어다니는 공포', hasBind: true, difficulty: '보통' },
  '바이퍼': { rank11: 20, stdDpmJo: 4.635, bpEff: 7155, burstRate: 59.3, normActions6m: 560, procCasts6m: 760, recHatSec: 0, cdrShare: 16.0, cdrBaseCool: 20.0, cdrEfficiencyFactor: 0.62, attackStyle: 'HOLD_660', hasIframe: true, iframeCoolSec: 60, iframeName: '원기옥(짧무적) / 방어폼', hasBind: false, difficulty: '쉬움' },
  '플레임위자드': { rank11: 21, stdDpmJo: 4.630, bpEff: 7050, burstRate: 58.0, normActions6m: 670, procCasts6m: 970, recHatSec: 4, cdrShare: 47.0, cdrBaseCool: 15.0, cdrEfficiencyFactor: 0.82, attackStyle: 'KEYDOWN_BURST', hasIframe: true, iframeCoolSec: 45, iframeName: '에테리얼 폼 / 카타클리즘', hasBind: false, difficulty: '보통' },
  '일리움': { rank11: 22, stdDpmJo: 4.625, bpEff: 6999, burstRate: 53.0, normActions6m: 710, procCasts6m: 1170, recHatSec: 2, cdrShare: 33.0, cdrBaseCool: 15.0, cdrEfficiencyFactor: 0.75, attackStyle: 'COMBO_CDR', hasIframe: true, iframeCoolSec: 60, iframeName: '롱기누스 존 / 크리스탈 무적', hasBind: false, difficulty: '보통' },
  '키네시스': { rank11: 23, stdDpmJo: 4.620, bpEff: 6911, burstRate: 62.5, normActions6m: 690, procCasts6m: 1070, recHatSec: 0, cdrShare: 15.0, cdrBaseCool: 24.0, cdrEfficiencyFactor: 0.60, attackStyle: 'HOLD_660', hasIframe: true, iframeCoolSec: 45, iframeName: '에테리얼 폼 / 싸이킥 토네이도', hasBind: true, difficulty: '보통' },
  '보우마스터': { rank11: 24, stdDpmJo: 4.615, bpEff: 6948, burstRate: 49.4, normActions6m: 540, procCasts6m: 640, recHatSec: 0, cdrShare: 14.0, cdrBaseCool: 25.0, cdrEfficiencyFactor: 0.58, attackStyle: 'KEYDOWN_BURST', hasIframe: false, iframeCoolSec: 60, iframeName: '실루엣 미라주(뎀감)', hasBind: false, difficulty: '쉬움' },
  '제논': { rank11: 25, stdDpmJo: 4.610, bpEff: 7086, burstRate: 52.0, normActions6m: 600, procCasts6m: 860, recHatSec: 2, cdrShare: 31.0, cdrBaseCool: 18.0, cdrEfficiencyFactor: 0.72, attackStyle: 'KEYDOWN_BURST', hasIframe: true, iframeCoolSec: 60, iframeName: '메가 스매셔(차징/발사 무적)', hasBind: true, difficulty: '보통' },
  '블래스터': { rank11: 26, stdDpmJo: 4.600, bpEff: 7080, burstRate: 62.9, normActions6m: 960, procCasts6m: 1720, recHatSec: 0, cdrShare: 16.0, cdrBaseCool: 22.0, cdrEfficiencyFactor: 0.62, attackStyle: 'COMBO_CDR', hasIframe: true, iframeCoolSec: 45, iframeName: '리볼빙 번커 / 해머 스매시', hasBind: false, difficulty: '어려움' },
  '비숍': { rank11: 27, stdDpmJo: 4.590, bpEff: 6950, burstRate: 57.5, normActions6m: 590, procCasts6m: 820, recHatSec: 2, cdrShare: 34.0, cdrBaseCool: 16.0, cdrEfficiencyFactor: 0.75, attackStyle: 'HOLD_660', hasIframe: true, iframeCoolSec: 45, iframeName: '에테리얼 폼 / 헤븐즈 도어', hasBind: false, difficulty: '쉬움' },
  '미하일': { rank11: 28, stdDpmJo: 4.580, bpEff: 6945, burstRate: 58.0, normActions6m: 620, procCasts6m: 770, recHatSec: 2, cdrShare: 36.0, cdrBaseCool: 12.0, cdrEfficiencyFactor: 0.78, attackStyle: 'HOLD_660', hasIframe: true, iframeCoolSec: 6, iframeName: '로얄 가드(상시 쿨짧은 무적)', hasBind: false, difficulty: '보통' },
  '아크메이지(썬,콜)': { rank11: 29, stdDpmJo: 4.575, bpEff: 6940, burstRate: 34.5, normActions6m: 600, procCasts6m: 830, recHatSec: 2, cdrShare: 35.0, cdrBaseCool: 16.0, cdrEfficiencyFactor: 0.75, attackStyle: 'HOLD_660', hasIframe: true, iframeCoolSec: 45, iframeName: '에테리얼 폼 / 프리징 브레스', hasBind: true, difficulty: '쉬움' },
  '패스파인더': { rank11: 30, stdDpmJo: 4.570, bpEff: 7151, burstRate: 55.4, normActions6m: 640, procCasts6m: 980, recHatSec: 2, cdrShare: 34.0, cdrBaseCool: 15.0, cdrEfficiencyFactor: 0.76, attackStyle: 'KEYDOWN_BURST', hasIframe: true, iframeCoolSec: 60, iframeName: '얼티밋 블래스트 / 아스트라', hasBind: false, difficulty: '쉬움' },
  '메카닉': { rank11: 31, stdDpmJo: 4.565, bpEff: 7263, burstRate: 52.0, normActions6m: 650, procCasts6m: 1330, recHatSec: 4, cdrShare: 48.0, cdrBaseCool: 14.0, cdrEfficiencyFactor: 0.84, attackStyle: 'KEYDOWN_BURST', hasIframe: true, iframeCoolSec: 60, iframeName: '메탈아머 전탄발사(탑승 무적)', hasBind: false, difficulty: '보통' },
  '캐논슈터': { rank11: 32, stdDpmJo: 4.560, bpEff: 7024, burstRate: 52.7, normActions6m: 570, procCasts6m: 690, recHatSec: 2, cdrShare: 30.0, cdrBaseCool: 18.0, cdrEfficiencyFactor: 0.72, attackStyle: 'HOLD_660', hasIframe: true, iframeCoolSec: 90, iframeName: '스페셜 몽키 에스코트 / 코코볼', hasBind: false, difficulty: '쉬움' },
  '배틀메이지': { rank11: 33, stdDpmJo: 4.550, bpEff: 6930, burstRate: 58.2, normActions6m: 680, procCasts6m: 1010, recHatSec: 2, cdrShare: 32.0, cdrBaseCool: 16.0, cdrEfficiencyFactor: 0.74, attackStyle: 'HOLD_660', hasIframe: true, iframeCoolSec: 45, iframeName: '에테리얼 폼 / 어비설 라이트닝', hasBind: false, difficulty: '보통' },
  '라라': { rank11: 34, stdDpmJo: 4.545, bpEff: 6973, burstRate: 55.9, normActions6m: 640, procCasts6m: 870, recHatSec: 2, cdrShare: 36.0, cdrBaseCool: 15.0, cdrEfficiencyFactor: 0.76, attackStyle: 'COMBO_CDR', hasIframe: true, iframeCoolSec: 45, iframeName: '에테리얼 폼 / 산 에움', hasBind: true, difficulty: '쉬움' },
  '데몬슬레이어': { rank11: 35, stdDpmJo: 4.530, bpEff: 6918, burstRate: 61.6, normActions6m: 590, procCasts6m: 890, recHatSec: 0, cdrShare: 18.0, cdrBaseCool: 20.0, cdrEfficiencyFactor: 0.62, attackStyle: 'HOLD_660', hasIframe: true, iframeCoolSec: 30, iframeName: '다크 메타모포시스 / 레이븐 스톰', hasBind: true, difficulty: '쉬움' },
  '소울마스터': { rank11: 36, stdDpmJo: 4.525, bpEff: 6977, burstRate: 55.0, normActions6m: 560, procCasts6m: 750, recHatSec: 0, cdrShare: 15.0, cdrBaseCool: 22.0, cdrEfficiencyFactor: 0.60, attackStyle: 'HOLD_660', hasIframe: true, iframeCoolSec: 45, iframeName: '트루 사이트 / 일식 무적', hasBind: true, difficulty: '쉬움' },
  '와일드헌터': { rank11: 37, stdDpmJo: 4.515, bpEff: 6910, burstRate: 54.5, normActions6m: 630, procCasts6m: 1040, recHatSec: 4, cdrShare: 46.0, cdrBaseCool: 13.0, cdrEfficiencyFactor: 0.82, attackStyle: 'KEYDOWN_BURST', hasIframe: true, iframeCoolSec: 60, iframeName: '재규어 맥시멈(무적)', hasBind: true, difficulty: '보통' },
  '데몬어벤져': { rank11: 38, stdDpmJo: 4.505, bpEff: 7271, burstRate: 53.7, normActions6m: 640, procCasts6m: 950, recHatSec: 4, cdrShare: 55.0, cdrBaseCool: 11.0, cdrEfficiencyFactor: 0.87, attackStyle: 'COMBO_CDR', hasIframe: true, iframeCoolSec: 60, iframeName: '레버넌트(사망유예)', hasBind: true, difficulty: '보통' },
  '신궁': { rank11: 39, stdDpmJo: 4.490, bpEff: 7038, burstRate: 57.0, normActions6m: 550, procCasts6m: 660, recHatSec: 0, cdrShare: 14.0, cdrBaseCool: 24.0, cdrEfficiencyFactor: 0.58, attackStyle: 'HOLD_660', hasIframe: true, iframeCoolSec: 60, iframeName: '트루 스나이핑(무적)', hasBind: false, difficulty: '쉬움' },
  '나이트워커': { rank11: 40, stdDpmJo: 4.475, bpEff: 6967, burstRate: 59.8, normActions6m: 570, procCasts6m: 800, recHatSec: 2, cdrShare: 29.0, cdrBaseCool: 18.0, cdrEfficiencyFactor: 0.70, attackStyle: 'KEYDOWN_BURST', hasIframe: true, iframeCoolSec: 60, iframeName: '도미니언 / 다크니스 어센션', hasBind: true, difficulty: '쉬움' },
  '은월': { rank11: 41, stdDpmJo: 4.460, bpEff: 6905, burstRate: 60.2, normActions6m: 610, procCasts6m: 830, recHatSec: 4, cdrShare: 47.0, cdrBaseCool: 14.0, cdrEfficiencyFactor: 0.83, attackStyle: 'COMBO_CDR', hasIframe: true, iframeCoolSec: 60, iframeName: '소혼장막(무적) / 프리드', hasBind: true, difficulty: '쉬움' },
  '레테': { rank11: 42, stdDpmJo: 4.450, bpEff: 6900, burstRate: 55.0, normActions6m: 630, procCasts6m: 890, recHatSec: 2, cdrShare: 34.0, cdrBaseCool: 15.0, cdrEfficiencyFactor: 0.75, attackStyle: 'COMBO_CDR', hasIframe: true, iframeCoolSec: 60, iframeName: '고유 무적기', hasBind: true, difficulty: '보통' },
  '엔젤릭버스터': { rank11: 43, stdDpmJo: 4.440, bpEff: 6941, burstRate: 63.1, normActions6m: 580, procCasts6m: 780, recHatSec: 2, cdrShare: 31.0, cdrBaseCool: 16.0, cdrEfficiencyFactor: 0.72, attackStyle: 'KEYDOWN_BURST', hasIframe: true, iframeCoolSec: 60, iframeName: '에너지 버스(무적)', hasBind: false, difficulty: '쉬움' },
  '캡틴': { rank11: 44, stdDpmJo: 4.435, bpEff: 6895, burstRate: 53.6, normActions6m: 620, procCasts6m: 990, recHatSec: 4, cdrShare: 46.0, cdrBaseCool: 14.0, cdrEfficiencyFactor: 0.82, attackStyle: 'KEYDOWN_BURST', hasIframe: true, iframeCoolSec: 45, iframeName: '노틸러스 어썰트 / 백스텝샷', hasBind: false, difficulty: '보통' },
  '윈드브레이커': { rank11: 45, stdDpmJo: 4.420, bpEff: 7010, burstRate: 59.1, normActions6m: 545, procCasts6m: 645, recHatSec: 2, cdrShare: 33.0, cdrBaseCool: 15.0, cdrEfficiencyFactor: 0.75, attackStyle: 'KEYDOWN_BURST', hasIframe: false, iframeCoolSec: 60, iframeName: '윈드 월(강력 보호막)', hasBind: false, difficulty: '쉬움' },
  '팬텀': { rank11: 46, stdDpmJo: 4.410, bpEff: 6958, burstRate: 59.5, normActions6m: 630, procCasts6m: 910, recHatSec: 4, cdrShare: 50.0, cdrBaseCool: 13.5, cdrEfficiencyFactor: 0.84, attackStyle: 'KEYDOWN_BURST', hasIframe: true, iframeCoolSec: 30, iframeName: '스틸 무적기(새크로/절개 등) + 조커', hasBind: false, difficulty: '보통' },
  '팔라딘': { rank11: 47, stdDpmJo: 4.395, bpEff: 6880, burstRate: 64.1, normActions6m: 560, procCasts6m: 720, recHatSec: 0, cdrShare: 18.0, cdrBaseCool: 20.0, cdrEfficiencyFactor: 0.62, attackStyle: 'KEYDOWN_BURST', hasIframe: true, iframeCoolSec: 120, iframeName: '새크로생티티(극딜/무적)', hasBind: true, difficulty: '쉬움' },
  '렌': { rank11: 48, stdDpmJo: 4.380, bpEff: 6870, burstRate: 60.0, normActions6m: 620, procCasts6m: 870, recHatSec: 2, cdrShare: 33.0, cdrBaseCool: 15.0, cdrEfficiencyFactor: 0.75, attackStyle: 'KEYDOWN_BURST', hasIframe: true, iframeCoolSec: 60, iframeName: '고유 무적기', hasBind: true, difficulty: '보통' }
};

module.exports = {
  HERO_CALIBRATED_FULL_INDEX,
  HERO_BASELINE_DPM_JO,
  BP_EFF_TO_INDEX_DIVISOR,
  STANDARD_ACTION_DELAY_MS,
  MAX_CONTINUOUS_STD_ACTIONS_6M,
  PASSIVE_PROC_SKILL_KEYWORDS,
  KEYDOWN_SKILL_KEYWORDS,
  calcMapleReducedCooldown,
  HEXA_FRAGMENT_TABLE,
  MASTER_JOB_LIST: Object.keys(DEFAULT_JOB_UTILITY_DB),
  DEFAULT_JOB_UTILITY_DB
};