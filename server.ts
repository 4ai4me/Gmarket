import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const GARAK_AUTOCOMPLETE_URL = 'https://temp.garak.co.kr/price/selectAutoCompleteAjax.do';

interface CachedGarakResponse {
  expiresAt: number;
  payload: unknown;
}

const garakCache = new Map<string, CachedGarakResponse>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function readAppVersion(): string {
  try {
    const versionPath = path.resolve(__dirname, 'VERSION');
    return fs.readFileSync(versionPath, 'utf8').trim() || 'v0.0.1';
  } catch {
    return 'v0.0.1';
  }
}

function normalizeGarakDate(input: unknown): string | null {
  if (typeof input !== 'string' || !input.trim()) {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const y = kst.getUTCFullYear();
    const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const d = String(kst.getUTCDate()).padStart(2, '0');
    return `${y}.${m}.${d}`;
  }
  const cleaned = input.trim().replace(/-/g, '.');
  if (!/^\d{4}\.\d{2}\.\d{2}$/.test(cleaned)) {
    return null;
  }
  const [y, m, d] = cleaned.split('.').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2015 || y > 2035) {
    return null;
  }
  return cleaned;
}

const ALL_YEAR_CACHE_TTL_MS = 60 * 60 * 1000;

function classifyCropCategory(itemName: string): string {
  const n = itemName.replace(/^=+/, '').trim();
  // 1. Seafood & dried marine products first (even when suffixed with 국산)
  if (
    /멸치|오징어|김($|\(|국산|수입)|파래김|미역|건포|고등어|갈치|명태|조기|새우|대하|게($|\(|지|국산|수입)|꽃게|칠게|낙지|문어|전복|굴($|\(|국산|수입)|각굴|봉지굴|바지락|홍합|조개|어묵|수산|황태|다시마|북어|동태|생선|연어|광어|우럭|쭈꾸미|가리비|가무락|가자미|숭어|골뱅이|금태|어류|꼬막|새고막|꼴뚜기|꼴어|꽁치|냉태|농어|능성어|다랭어|대구|도미|동자개|빠가사리|동죽|매생이|메기|물매기|미꾸라지|민어|방어|백합|병어|복($|어)|삼치|생태|소라|아귀|오만둥이|오만리|우렁|은어|임면수어|임연수어|잡어|장대|장어|재첩|전갱이|전어|중하|청어|패류|한치|해조류|호키알|홍어|미더덕|멍게|다루마|동백하|곤지|해락|맛($|국산)|백$|가제|가재|범치|재치|정어리|준치|해삼|꼬시래기|가물치|고둥|상어|서대|잉어|간재미|도다리|양태|열기|밴댕이|벤뎅어|적어|쥐치|헷데기/.test(
      n
    )
  ) {
    return '수산·건해';
  }
  // 2. Mushrooms
  if (/버섯|느타리|표고|새송이|팽이|양송이|만가닥|송이|목이|상황|노루궁뎅이/.test(n)) {
    return '버섯류';
  }
  // 3. Imported items & tropical imported fruits (unless explicitly domestic)
  if (
    (/수입/.test(n) && !/국산/.test(n)) ||
    (/^(바나나|파인애플|람부탄|레몬|자몽|오렌지|석류|아보카도|아보카드|용과|망고스틴|두리안|코코넛|라임)/.test(n) &&
      !/국산/.test(n))
  ) {
    return '수입품목';
  }
  // 4. Western vegetables & herbs
  if (
    /브로콜리|브로코리|브로커리|콜리플라워|칼리플라워|칼리후라워|칼라후라워|양상추|로메인|셀러리|세러리|파슬리|파세리|루꼴라|로케트|바질|바실|딜$|양채|적채|빨간양배추|아스파라거스|아스파라가스|(^|\s)고수($|\s|\()|비타민|케일|치커리|엔다이브|래디쉬|펜넬|로즈마리|민트|타임|오레가노|세이지|허브/.test(
      n
    )
  ) {
    return '양채·허브류';
  }
  // 5. Fruiting vegetables (과채류)
  if (
    /딸기|수박|참외|메론|멜론|토마토|방울토마토|오이|가지|호박|애호박|단호박|고추|꽈리고추|피망|파프리카|청초|여주|동아|수세미/.test(
      n
    )
  ) {
    return '과채류';
  }
  // 6. Beans, sprouts & grains (두류·곡류)
  if (
    /옥수수|콩|강낭콩|완두|동부|팥|녹두|땅콩|두류|빈스|숙주|보리|쌀|현미|찹쌀|조$|수수|기장|율무|깨$|참깨|들깨|서리태|백태|흑태|청태/.test(
      n
    )
  ) {
    return '두류·곡류';
  }
  // 7. Orchard fruits (과실류)
  if (
    /사과|배$|배\(|^배\s|감귤|귤|만감|한라봉|천혜향|레드향|황금향|포도|샤인머스켓|샤인머스캣|복숭아|자두|단감|감$|감\s|대봉|곶감|떫은감|키위|다래|참다래|망고|블루베리|체리|버찌|대추|밤$|밤\(|무화과|유자|매실|살구|오디|앵두|모과|석류|산딸기|복분자|아로니아|보리수|패션푸룻|탄제린|금감|낑깡|천도|과실|과일/.test(
      n
    )
  ) {
    return '과실류';
  }
  // 8. Seasoning vegetables (양념채소)
  if (/마늘|양파|대파|쪽파|파$|파\(|실파|부추|생강|양념/.test(n)) {
    return '양념채소';
  }
  // 9. Root vegetables (근채류)
  if (
    /고구마(?!순)|감자|무$|무\(|^무\s|알타리|총각무|다발무|당근|연근|우엉|도라지|더덕|마$|비트|순무|콜라비|근채|인삼|수삼|토란|야콘|하수오|칡|돼지감자|초석잠/.test(
      n
    )
  ) {
    return '근채류';
  }
  // 10. Leafy & wild greens (엽채·나물류)
  if (
    /배추|양배추|상추|깻잎|시금치|미나리|쑥갓|청경채|겨자|아욱|근대|얼갈이|봄동|갓$|갓\(|돌산갓|청갓|반청갓|열무|냉이|달래|취나물|곰취|곤달비|방풍|민들레|머위|고들빼기|두릅|고사리|엽채|엽경채|나물|고구마순|고추잎|쌈채|부지갱이|쑥$|쑥\(|유채|당귀|속새|무순|다래순|엄나무|오가피|참나물|비름|명아주|원추리|돌나물|세발나물|함초|죽순|공심채|모닝글로리|호박잎|콩잎|연잎|솔잎|산마늘|삼채|방아|어린잎|새싹|베이비|춘채|신선초|기타채소/.test(
      n
    )
  ) {
    return '엽채·나물류';
  }
  return '기타 농산물';
}

interface GarakCatalogItem {
  itemName: string;
  category: string;
  units: string[];
  hasWeightUnit: boolean;
  hasNonWeightUnit: boolean;
  sourceModes?: ('auction' | 'summary')[];
}

function parseAutoCompleteToMap(html: string, mode: 'auction' | 'summary'): {
  itemMap: Map<string, Set<string>>;
  rawOptionCount: number;
} {
  const regex = /<option[^>]*value=['"]([^'"]*)['"][^>]*>([^<]*)<\/option>/gi;
  const itemMap = new Map<string, Set<string>>();
  let rawOptionCount = 0;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const rawVal = (match[1] || '').trim();
    if (!rawVal || rawVal === '전체') continue;
    rawOptionCount += 1;

    if (mode === 'auction' && rawVal.includes('/')) {
      const slashIdx = rawVal.lastIndexOf('/');
      const rawName = rawVal.slice(0, slashIdx).replace(/^=+/, '').trim();
      const rawUnit = rawVal.slice(slashIdx + 1).trim();
      if (!rawName) continue;
      if (!itemMap.has(rawName)) {
        itemMap.set(rawName, new Set());
      }
      if (rawUnit) {
        itemMap.get(rawName)!.add(rawUnit);
      }
    } else {
      const rawName = rawVal.replace(/^=+/, '').trim();
      if (!rawName) continue;
      if (!itemMap.has(rawName)) {
        itemMap.set(rawName, new Set());
      }
    }
  }

  return { itemMap, rawOptionCount };
}

function finalizeCatalogItems(
  itemMap: Map<string, Set<string>>,
  sourceModesMap?: Map<string, Set<'auction' | 'summary'>>
): GarakCatalogItem[] {
  const items: GarakCatalogItem[] = [];
  for (const [itemName, unitSet] of itemMap.entries()) {
    const units = Array.from(unitSet).sort((a, b) => {
      const na = parseFloat(a);
      const nb = parseFloat(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return a.localeCompare(b, 'ko');
    });
    const hasWeightUnit = units.some((u) => /(kg|g)$/i.test(u.replace(/\s+/g, '')));
    const hasNonWeightUnit = units.some((u) => !/(kg|g)$/i.test(u.replace(/\s+/g, '')));
    const modes = sourceModesMap?.get(itemName);
    items.push({
      itemName,
      category: classifyCropCategory(itemName),
      units,
      hasWeightUnit,
      hasNonWeightUnit,
      ...(modes ? { sourceModes: Array.from(modes) } : {}),
    });
  }
  items.sort((a, b) => a.itemName.localeCompare(b.itemName, 'ko'));
  return items;
}

async function fetchSingleGarakAutoComplete(
  dateStr: string,
  mode: 'auction' | 'summary'
): Promise<{ itemMap: Map<string, Set<string>>; rawOptionCount: number }> {
  const body = new URLSearchParams(
    mode === 'auction'
      ? {
          s_date: dateStr,
          e_date: dateStr,
          s_bubin: '',
          s_deal_cd: '',
          total_search: '',
          sangi_yn: 'true',
          sangi_val: '',
          R010680: '10',
          R010690: '10',
          R010700: '10',
          R010710: '',
        }
      : {
          s_date: dateStr,
          e_date: dateStr,
          s_bubin: '',
          s_deal_cd: '2',
          total_search: '',
          sangi_yn: 'false',
          sangi_val: '',
          R010680: '10',
          R010690: '30',
          R010700: '10',
          R010710: '00',
        }
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const res = await fetch(GARAK_AUTOCOMPLETE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: 'https://temp.garak.co.kr/price/OZViewer.do?R010680=10&R010690=10&R010700=10',
        'User-Agent': 'Mozilla/5.0 (compatible; GarakAgroAnalyzer/1.0)',
      },
      body: body.toString(),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`가락시장 응답 오류 (HTTP ${res.status})`);
    }

    const text = await res.text();
    if (!text.trim().startsWith('{')) {
      return { itemMap: new Map(), rawOptionCount: 0 };
    }

    const json = JSON.parse(text) as {
      resultStats?: { resultCode?: string; resultMsg?: string };
      autocompleteList?: string;
    };

    if (json.resultStats?.resultCode === 'error') {
      throw new Error(json.resultStats.resultMsg || '가락시장 조회 오류가 발생했습니다.');
    }

    return parseAutoCompleteToMap(json.autocompleteList || '', mode);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Generates 12 weekday sample dates (one per month over the trailing 12 months)
 * avoiding Sundays (when Garak Market is closed).
 */
function buildTrailing12MonthSampleDates(anchorDateStr: string): string[] {
  const [y, m] = anchorDateStr.split('.').map(Number);
  const dates: string[] = [];
  for (let offset = 11; offset >= 1; offset--) {
    const d = new Date(Date.UTC(y, m - 1 - offset, 15));
    // Avoid Sunday (0) -> move to Monday (16th)
    if (d.getUTCDay() === 0) {
      d.setUTCDate(d.getUTCDate() + 1);
    }
    const yy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    dates.push(`${yy}.${mm}.${dd}`);
  }
  dates.push(anchorDateStr);
  return dates;
}

async function fetchGarakCatalog(dateStr: string, mode: 'all_year' | 'auction' | 'summary') {
  const cacheKey = mode === 'all_year' ? `all_year:${dateStr.slice(0, 7)}` : `${dateStr}:${mode}`;
  const cached = garakCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...(cached.payload as Record<string, unknown>), cached: true };
  }

  if (mode === 'all_year') {
    const sampleDates = buildTrailing12MonthSampleDates(dateStr);
    const mergedUnits = new Map<string, Set<string>>();
    const sourceModesMap = new Map<string, Set<'auction' | 'summary'>>();
    let totalRawOptions = 0;

    // Fetch all 12 months in parallel across both auction (parent + units) and summary (cultivars like 고수)
    const results = await Promise.all(
      sampleDates.map(async (d) => {
        const [auctionRes, summaryRes] = await Promise.allSettled([
          fetchSingleGarakAutoComplete(d, 'auction'),
          fetchSingleGarakAutoComplete(d, 'summary'),
        ]);
        return {
          auction: auctionRes.status === 'fulfilled' ? auctionRes.value : null,
          summary: summaryRes.status === 'fulfilled' ? summaryRes.value : null,
        };
      })
    );

    for (const { auction, summary } of results) {
      if (auction) {
        totalRawOptions += auction.rawOptionCount;
        for (const [name, units] of auction.itemMap.entries()) {
          if (!mergedUnits.has(name)) mergedUnits.set(name, new Set());
          for (const u of units) mergedUnits.get(name)!.add(u);
          if (!sourceModesMap.has(name)) sourceModesMap.set(name, new Set());
          sourceModesMap.get(name)!.add('auction');
        }
      }
      if (summary) {
        totalRawOptions += summary.rawOptionCount;
        for (const name of summary.itemMap.keys()) {
          if (!mergedUnits.has(name)) mergedUnits.set(name, new Set());
          if (!sourceModesMap.has(name)) sourceModesMap.set(name, new Set());
          sourceModesMap.get(name)!.add('summary');
        }
      }
    }

    const items = finalizeCatalogItems(mergedUnits, sourceModesMap);
    const payload = {
      source: 'live',
      date: `${sampleDates[0]} ~ ${sampleDates[sampleDates.length - 1]}`,
      mode: 'all_year',
      fetchedAt: new Date().toISOString(),
      itemCount: items.length,
      rawOptionCount: totalRawOptions,
      sampledDatesCount: sampleDates.length,
      items,
    };

    if (items.length > 0) {
      garakCache.set(cacheKey, {
        expiresAt: Date.now() + ALL_YEAR_CACHE_TTL_MS,
        payload,
      });
    }

    return { ...payload, cached: false };
  }

  const { itemMap, rawOptionCount } = await fetchSingleGarakAutoComplete(dateStr, mode);
  const sourceModesMap = new Map<string, Set<'auction' | 'summary'>>();
  for (const name of itemMap.keys()) {
    sourceModesMap.set(name, new Set([mode]));
  }
  const items = finalizeCatalogItems(itemMap, sourceModesMap);
  const payload = {
    source: 'live',
    date: dateStr,
    mode,
    fetchedAt: new Date().toISOString(),
    itemCount: items.length,
    rawOptionCount,
    items,
  };

  if (items.length > 0) {
    garakCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    });
  }

  return { ...payload, cached: false };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: readAppVersion(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/version', (_req, res) => {
    res.json({ version: readAppVersion() });
  });

  app.get('/api/garak/items', async (req, res) => {
    const normalizedDate = normalizeGarakDate(req.query.date);
    if (!normalizedDate) {
      res.status(400).json({
        error: '유효하지 않은 날짜 형식입니다. YYYY-MM-DD 또는 YYYY.MM.DD 형식으로 입력해 주세요.',
      });
      return;
    }

    const mode =
      req.query.mode === 'summary'
        ? 'summary'
        : req.query.mode === 'all_year'
          ? 'all_year'
          : 'auction';

    try {
      const data = await fetchGarakCatalog(normalizedDate, mode);
      res.json(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : '가락시장 서버 연결에 실패했습니다.';
      res.status(502).json({
        error: `가락시장 실시간 품목 조회 실패: ${message}`,
        date: normalizedDate,
        mode,
      });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[GarakAgroROI ${readAppVersion()}] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
