/**
 * 전 직업 5기 연무장 체급(헥환 11만 평균 딜량), 전투력 보정 효율, 극딜 비중,
 * 무적기 쿨타임 및 6차 조각 효율 통합 데이터베이스
 */

const HERO_CALIBRATED_FULL_INDEX = 819.5;
const HERO_BASELINE_DPM_JO = 4.6907; // 1번째 사진의 히어로(13위) 평균 딜량: 4조 6907억
const BP_EFF_TO_INDEX_DIVISOR = 12;

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
 * 1번째 사진(5기 연무장 헥환 11만 체급 순위 1~48위) 및 수집된 연무장 기본 통계 내장 DB
 * - stdDpmJo: 헥환 11만 기준 평균 연무장 딜량(조 단위, 1위 카데나 ~ 48위 렌)
 * - bpEff: 연무장 인게임 전투력 대비 효율 (DPS / 전투력)
 * - burstRate: 30초 극딜 귀속 비중 (%)
 * - avgCasts: 6분간 평균 스킬 사용 횟수 (타수/손 바쁨 지표)
 */
const DEFAULT_JOB_UTILITY_DB = {
  '카데나': { rank11: 1, stdDpmJo: 4.965, bpEff: 7401, burstRate: 27.6, avgCasts: 2450, hasIframe: true, iframeCoolSec: 60, iframeName: '체인아츠:퓨리 / 크러시', hasBind: true, difficulty: '어려움' },
  '카이저': { rank11: 2, stdDpmJo: 4.940, bpEff: 7914, burstRate: 59.6, avgCasts: 1420, hasIframe: true, iframeCoolSec: 60, iframeName: '프로미넌스 / 마제스티', hasBind: false, difficulty: '쉬움' },
  '호영': { rank11: 3, stdDpmJo: 4.930, bpEff: 7738, burstRate: 59.8, avgCasts: 1580, hasIframe: true, iframeCoolSec: 40, iframeName: '몽유도원(짧쿨 조절 무적)', hasBind: true, difficulty: '보통' },
  '아크메이지(불,독)': { rank11: 4, stdDpmJo: 4.895, bpEff: 7299, burstRate: 34.3, avgCasts: 1890, hasIframe: true, iframeCoolSec: 45, iframeName: '에테리얼 폼', hasBind: false, difficulty: '보통' },
  '스트라이커': { rank11: 5, stdDpmJo: 4.885, bpEff: 7752, burstRate: 57.9, avgCasts: 1950, hasIframe: true, iframeCoolSec: 45, iframeName: '해신강림(무적)', hasBind: false, difficulty: '보통' },
  '카인': { rank11: 6, stdDpmJo: 4.865, bpEff: 7424, burstRate: 61.2, avgCasts: 1720, hasIframe: true, iframeCoolSec: 40, iframeName: '쉐도우 스위프트 / 타나토스', hasBind: false, difficulty: '보통' },
  '듀얼블레이드': { rank11: 7, stdDpmJo: 4.845, bpEff: 7310, burstRate: 54.8, avgCasts: 1650, hasIframe: true, iframeCoolSec: 30, iframeName: '사슬지옥 / 파이널 컷', hasBind: false, difficulty: '보통' },
  '칼리': { rank11: 8, stdDpmJo: 4.810, bpEff: 7176, burstRate: 62.0, avgCasts: 1820, hasIframe: true, iframeCoolSec: 60, iframeName: '레조네이트:얼티메이텀', hasBind: true, difficulty: '보통' },
  '루미너스': { rank11: 9, stdDpmJo: 4.760, bpEff: 7350, burstRate: 63.2, avgCasts: 1380, hasIframe: true, iframeCoolSec: 45, iframeName: '에테리얼 폼 / 아마겟돈', hasBind: true, difficulty: '쉬움' },
  '다크나이트': { rank11: 10, stdDpmJo: 4.725, bpEff: 7447, burstRate: 61.1, avgCasts: 1490, hasIframe: true, iframeCoolSec: 90, iframeName: '리인카네이션(사망방지)', hasBind: false, difficulty: '쉬움' },
  '메르세데스': { rank11: 11, stdDpmJo: 4.715, bpEff: 7272, burstRate: 63.8, avgCasts: 2180, hasIframe: true, iframeCoolSec: 60, iframeName: '프리드 / 로얄 나이츠', hasBind: false, difficulty: '어려움' },
  '섀도어': { rank11: 12, stdDpmJo: 4.700, bpEff: 7190, burstRate: 50.5, avgCasts: 2120, hasIframe: true, iframeCoolSec: 20, iframeName: '절개(무적) / 연막탄', hasBind: false, difficulty: '보통' },
  '히어로': { rank11: 13, stdDpmJo: 4.6907, bpEff: 7138, burstRate: 38.2, avgCasts: 1340, hasIframe: true, iframeCoolSec: 20, iframeName: '블레이드 임팩트(짧쿨무적)', hasBind: false, difficulty: '쉬움' },
  '에반': { rank11: 14, stdDpmJo: 4.675, bpEff: 7065, burstRate: 53.3, avgCasts: 1920, hasIframe: true, iframeCoolSec: 45, iframeName: '에테리얼 폼 / 드래곤 마스터', hasBind: false, difficulty: '어려움' },
  '아란': { rank11: 15, stdDpmJo: 4.670, bpEff: 7002, burstRate: 31.2, avgCasts: 1750, hasIframe: true, iframeCoolSec: 60, iframeName: '프리드 / 아드레날린 무적', hasBind: true, difficulty: '쉬움' },
  '아델': { rank11: 16, stdDpmJo: 4.660, bpEff: 7344, burstRate: 60.8, avgCasts: 1840, hasIframe: true, iframeCoolSec: 30, iframeName: '다이크(가드 무적) / 인피니트', hasBind: true, difficulty: '보통' },
  '제로': { rank11: 17, stdDpmJo: 4.650, bpEff: 7324, burstRate: 52.0, avgCasts: 2260, hasIframe: true, iframeCoolSec: 60, iframeName: '타임 홀딩(무적+쿨초) / 조인트', hasBind: true, difficulty: '어려움' },
  '나이트로드': { rank11: 18, stdDpmJo: 4.645, bpEff: 7153, burstRate: 47.5, avgCasts: 1290, hasIframe: false, iframeCoolSec: 0, iframeName: '다크 사이트(일반무적 없음)', hasBind: false, difficulty: '쉬움' },
  '아크': { rank11: 19, stdDpmJo: 4.640, bpEff: 7125, burstRate: 55.6, avgCasts: 1790, hasIframe: true, iframeCoolSec: 45, iframeName: '근원의 기억 / 기어다니는 공포', hasBind: true, difficulty: '보통' },
  '바이퍼': { rank11: 20, stdDpmJo: 4.635, bpEff: 7155, burstRate: 59.3, avgCasts: 1320, hasIframe: true, iframeCoolSec: 60, iframeName: '원기옥(짧무적) / 방어폼', hasBind: false, difficulty: '쉬움' },
  '플레임위자드': { rank11: 21, stdDpmJo: 4.630, bpEff: 7050, burstRate: 58.0, avgCasts: 1640, hasIframe: true, iframeCoolSec: 45, iframeName: '에테리얼 폼 / 카타클리즘', hasBind: false, difficulty: '보통' },
  '일리움': { rank11: 22, stdDpmJo: 4.625, bpEff: 6999, burstRate: 53.0, avgCasts: 1880, hasIframe: true, iframeCoolSec: 60, iframeName: '롱기누스 존 / 크리스탈 무적', hasBind: false, difficulty: '보통' },
  '키네시스': { rank11: 23, stdDpmJo: 4.620, bpEff: 6911, burstRate: 62.5, avgCasts: 1760, hasIframe: true, iframeCoolSec: 45, iframeName: '에테리얼 폼 / 싸이킥 토네이도', hasBind: true, difficulty: '보통' },
  '보우마스터': { rank11: 24, stdDpmJo: 4.615, bpEff: 6948, burstRate: 49.4, avgCasts: 1180, hasIframe: false, iframeCoolSec: 60, iframeName: '실루엣 미라주(뎀감)', hasBind: false, difficulty: '쉬움' },
  '제논': { rank11: 25, stdDpmJo: 4.610, bpEff: 7086, burstRate: 52.0, avgCasts: 1460, hasIframe: true, iframeCoolSec: 60, iframeName: '메가 스매셔(차징/발사 무적)', hasBind: true, difficulty: '보통' },
  '블래스터': { rank11: 26, stdDpmJo: 4.600, bpEff: 7080, burstRate: 62.9, avgCasts: 2680, hasIframe: true, iframeCoolSec: 45, iframeName: '리볼빙 번커 / 해머 스매시', hasBind: false, difficulty: '어려움' },
  '비숍': { rank11: 27, stdDpmJo: 4.590, bpEff: 6950, burstRate: 57.5, avgCasts: 1410, hasIframe: true, iframeCoolSec: 45, iframeName: '에테리얼 폼 / 헤븐즈 도어', hasBind: false, difficulty: '쉬움' },
  '미하일': { rank11: 28, stdDpmJo: 4.580, bpEff: 6945, burstRate: 58.0, avgCasts: 1390, hasIframe: true, iframeCoolSec: 6, iframeName: '로얄 가드(상시 쿨짧은 무적)', hasBind: false, difficulty: '보통' },
  '아크메이지(썬,콜)': { rank11: 29, stdDpmJo: 4.575, bpEff: 6940, burstRate: 34.5, avgCasts: 1430, hasIframe: true, iframeCoolSec: 45, iframeName: '에테리얼 폼 / 프리징 브레스', hasBind: true, difficulty: '쉬움' },
  '패스파인더': { rank11: 30, stdDpmJo: 4.570, bpEff: 7151, burstRate: 55.4, avgCasts: 1620, hasIframe: true, iframeCoolSec: 60, iframeName: '얼티밋 블래스트 / 아스트라', hasBind: false, difficulty: '쉬움' },
  '메카닉': { rank11: 31, stdDpmJo: 4.565, bpEff: 7263, burstRate: 52.0, avgCasts: 1980, hasIframe: true, iframeCoolSec: 60, iframeName: '메탈아머 전탄발사(탑승 무적)', hasBind: false, difficulty: '보통' },
  '캐논슈터': { rank11: 32, stdDpmJo: 4.560, bpEff: 7024, burstRate: 52.7, avgCasts: 1260, hasIframe: true, iframeCoolSec: 90, iframeName: '스페셜 몽키 에스코트 / 코코볼', hasBind: false, difficulty: '쉬움' },
  '배틀메이지': { rank11: 33, stdDpmJo: 4.550, bpEff: 6930, burstRate: 58.2, avgCasts: 1690, hasIframe: true, iframeCoolSec: 45, iframeName: '에테리얼 폼 / 어비설 라이트닝', hasBind: false, difficulty: '보통' },
  '라라': { rank11: 34, stdDpmJo: 4.545, bpEff: 6973, burstRate: 55.9, avgCasts: 1510, hasIframe: true, iframeCoolSec: 45, iframeName: '에테리얼 폼 / 산 에움', hasBind: true, difficulty: '쉬움' },
  '데몬슬레이어': { rank11: 35, stdDpmJo: 4.530, bpEff: 6918, burstRate: 61.6, avgCasts: 1480, hasIframe: true, iframeCoolSec: 30, iframeName: '다크 메타모포시스 / 레이븐 스톰', hasBind: true, difficulty: '쉬움' },
  '소울마스터': { rank11: 36, stdDpmJo: 4.525, bpEff: 6977, burstRate: 55.0, avgCasts: 1310, hasIframe: true, iframeCoolSec: 45, iframeName: '트루 사이트 / 일식 무적', hasBind: true, difficulty: '쉬움' },
  '와일드헌터': { rank11: 37, stdDpmJo: 4.515, bpEff: 6910, burstRate: 54.5, avgCasts: 1670, hasIframe: true, iframeCoolSec: 60, iframeName: '재규어 맥시멈(무적)', hasBind: true, difficulty: '보통' },
  '데몬어벤져': { rank11: 38, stdDpmJo: 4.505, bpEff: 7271, burstRate: 53.7, avgCasts: 1590, hasIframe: true, iframeCoolSec: 60, iframeName: '레버넌트(사망유예)', hasBind: true, difficulty: '보통' },
  '신궁': { rank11: 39, stdDpmJo: 4.490, bpEff: 7038, burstRate: 57.0, avgCasts: 1210, hasIframe: true, iframeCoolSec: 60, iframeName: '트루 스나이핑(무적)', hasBind: false, difficulty: '쉬움' },
  '나이트워커': { rank11: 40, stdDpmJo: 4.475, bpEff: 6967, burstRate: 59.8, avgCasts: 1370, hasIframe: true, iframeCoolSec: 60, iframeName: '도미니언 / 다크니스 어센션', hasBind: true, difficulty: '쉬움' },
  '은월': { rank11: 41, stdDpmJo: 4.460, bpEff: 6905, burstRate: 60.2, avgCasts: 1440, hasIframe: true, iframeCoolSec: 60, iframeName: '소혼장막(무적) / 프리드', hasBind: true, difficulty: '쉬움' },
  '레테': { rank11: 42, stdDpmJo: 4.450, bpEff: 6900, burstRate: 55.0, avgCasts: 1520, hasIframe: true, iframeCoolSec: 60, iframeName: '고유 무적기', hasBind: true, difficulty: '보통' },
  '엔젤릭버스터': { rank11: 43, stdDpmJo: 4.440, bpEff: 6941, burstRate: 63.1, avgCasts: 1360, hasIframe: true, iframeCoolSec: 60, iframeName: '에너지 버스(무적)', hasBind: false, difficulty: '쉬움' },
  '캡틴': { rank11: 44, stdDpmJo: 4.435, bpEff: 6895, burstRate: 53.6, avgCasts: 1610, hasIframe: true, iframeCoolSec: 45, iframeName: '노틸러스 어썰트 / 백스텝샷', hasBind: false, difficulty: '보통' },
  '윈드브레이커': { rank11: 45, stdDpmJo: 4.420, bpEff: 7010, burstRate: 59.1, avgCasts: 1190, hasIframe: false, iframeCoolSec: 60, iframeName: '윈드 월(강력 보호막)', hasBind: false, difficulty: '쉬움' },
  '팬텀': { rank11: 46, stdDpmJo: 4.410, bpEff: 6958, burstRate: 59.5, avgCasts: 1540, hasIframe: true, iframeCoolSec: 30, iframeName: '스틸 무적기(새크로/절개 등) + 조커', hasBind: false, difficulty: '보통' },
  '팔라딘': { rank11: 47, stdDpmJo: 4.395, bpEff: 6880, burstRate: 64.1, avgCasts: 1280, hasIframe: true, iframeCoolSec: 120, iframeName: '새크로생티티(극딜/무적)', hasBind: true, difficulty: '쉬움' },
  '렌': { rank11: 48, stdDpmJo: 4.380, bpEff: 6870, burstRate: 60.0, avgCasts: 1490, hasIframe: true, iframeCoolSec: 60, iframeName: '고유 무적기', hasBind: true, difficulty: '보통' }
};

module.exports = {
  HERO_CALIBRATED_FULL_INDEX,
  HERO_BASELINE_DPM_JO,
  BP_EFF_TO_INDEX_DIVISOR,
  HEXA_FRAGMENT_TABLE,
  MASTER_JOB_LIST: Object.keys(DEFAULT_JOB_UTILITY_DB),
  DEFAULT_JOB_UTILITY_DB
};