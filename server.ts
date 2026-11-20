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

function classifyCropCategory(itemName: string): string {
  const n = itemName.replace(/^=/, '').trim();
  if (/멸치|오징어|김|미역|건포|고등어|갈치|명태|조기|새우|게|낙지|문어|전복|굴|바지락|홍합|조개|어묵|수산|황태|다시마|북어|멸치|동태|생선|연어|광어|우럭|쭈꾸미/.test(n)) {
    return '수산·건해';
  }
  if (/버섯|느타리|표고|새송이|팽이|양송이|만가닥|송이|목이|상황|노루궁뎅이/.test(n)) {
    return '버섯류';
  }
  if (/딸기|사과|배$|배\(|감귤|귤|만감|한라봉|천혜향|레드향|포도|샤인머스켓|복숭아|자두|수박|참외|메론|멜론|단감|감$|대봉|곶감|떫은감|키위|다래|바나나|망고|오렌지|레몬|자몽|파인애플|블루베리|체리|대추|밤$|무화과|석류|유자|람부탄|과실|과일|토마토|방울토마토/.test(n)) {
    return /토마토|딸기|수박|참외|메론|멜론/.test(n) ? '과채류' : '과실류';
  }
  if (/오이|가지|호박|애호박|단호박|고추|꽈리고추|피망|파프리카|옥수수|콩|강낭콩|완두|동부|팥|녹두|땅콩|브로콜리|콜리플라워|아스파라거스/.test(n)) {
    return '과채·두류';
  }
  if (/고구마|감자|무$|무\(|알타리|총각무|열무|당근|연근|우엉|도라지|더덕|마$|생강|비트|순무|콜라비|근채|인삼|수삼|토란|야콘/.test(n)) {
    return '근채류';
  }
  if (/마늘|양파|대파|쪽파|파$|실파|부추|고춧가루|생강|양념/.test(n)) {
    return '양념채소';
  }
  if (/배추|양배추|상추|깻잎|시금치|미나리|쑥갓|청경채|치커리|케일|겨자|아욱|근대|얼갈이|봄동|갓$|냉이|달래|취나물|곰취|방풍|민들레|머위|고들빼기|두릅|고사리|고수|셀러리|파슬리|루꼴라|로메인|양상추|엽채|나물|고구마순|고추잎/.test(n)) {
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
}

function parseAutoCompleteHtml(html: string, mode: 'auction' | 'summary'): {
  items: GarakCatalogItem[];
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
    items.push({
      itemName,
      category: classifyCropCategory(itemName),
      units,
      hasWeightUnit,
      hasNonWeightUnit,
    });
  }

  items.sort((a, b) => a.itemName.localeCompare(b.itemName, 'ko'));
  return { items, rawOptionCount };
}

async function fetchGarakCatalog(dateStr: string, mode: 'auction' | 'summary') {
  const cacheKey = `${dateStr}:${mode}`;
  const cached = garakCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...(cached.payload as Record<string, unknown>), cached: true };
  }

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

    const json = (await res.json()) as {
      resultStats?: { resultCode?: string; resultMsg?: string };
      autocompleteList?: string;
    };

    if (json.resultStats?.resultCode === 'error') {
      throw new Error(json.resultStats.resultMsg || '가락시장 조회 오류가 발생했습니다.');
    }

    const { items, rawOptionCount } = parseAutoCompleteHtml(json.autocompleteList || '', mode);
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
  } finally {
    clearTimeout(timeout);
  }
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

    const mode = req.query.mode === 'summary' ? 'summary' : 'auction';

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
