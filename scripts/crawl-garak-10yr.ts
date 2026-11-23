import fs from 'node:fs';
import path from 'node:path';

const GARAK_AUTOCOMPLETE_URL = 'https://temp.garak.co.kr/price/selectAutoCompleteAjax.do';
const START_YEAR = 2017;
const END_YEAR = 2026;
const END_MONTH = 11; // Up to 2026-11

function classifyCropCategory(itemName: string): string {
  const n = itemName.replace(/^=+/, '').trim();
  if (
    /멸치|오징어|김($|\(|국산|수입)|파래김|미역|건포|고등어|갈치|명태|조기|새우|대하|게($|\(|지|국산|수입)|꽃게|칠게|낙지|문어|전복|굴($|\(|국산|수입)|각굴|봉지굴|바지락|홍합|조개|어묵|수산|황태|다시마|북어|동태|생선|연어|광어|우럭|쭈꾸미|가리비|가무락|가자미|숭어|골뱅이|금태|어류|꼬막|새고막|꼴뚜기|꼴어|꽁치|냉태|농어|능성어|다랭어|대구|도미|동자개|빠가사리|동죽|매생이|메기|물매기|미꾸라지|민어|방어|백합|병어|복($|어)|삼치|생태|소라|아귀|오만둥이|오만리|우렁|은어|임면수어|임연수어|잡어|장대|장어|재첩|전갱이|전어|중하|청어|패류|한치|해조류|호키알|홍어|미더덕|멍게|다루마|동백하|곤지|해락|맛($|국산)|백$|가제|가재|범치|재치|정어리|준치|해삼|꼬시래기|가물치|고둥|상어|서대|잉어|간재미|도다리|양태|열기|밴댕이|벤뎅어|적어|쥐치|헷데기/.test(
      n
    )
  ) {
    return '수산·건해';
  }
  if (/버섯|느타리|표고|새송이|팽이|양송이|만가닥|송이|목이|상황|노루궁뎅이/.test(n)) {
    return '버섯류';
  }
  if (
    (/수입/.test(n) && !/국산/.test(n)) ||
    (/^(바나나|파인애플|람부탄|레몬|자몽|오렌지|석류|아보카도|아보카드|용과|망고스틴|두리안|코코넛|라임)/.test(n) &&
      !/국산/.test(n))
  ) {
    return '수입품목';
  }
  if (
    /브로콜리|브로코리|브로커리|콜리플라워|칼리플라워|칼리후라워|칼라후라워|양상추|로메인|셀러리|세러리|파슬리|파세리|루꼴라|로케트|바질|바실|딜$|양채|적채|빨간양배추|아스파라거스|아스파라가스|(^|\s)고수($|\s|\()|비타민|케일|치커리|엔다이브|래디쉬|펜넬|로즈마리|민트|타임|오레가노|세이지|허브/.test(
      n
    )
  ) {
    return '양채·허브류';
  }
  if (
    /딸기|수박|참외|메론|멜론|토마토|방울토마토|오이|가지|호박|애호박|단호박|고추|꽈리고추|피망|파프리카|청초|여주|동아|수세미/.test(
      n
    )
  ) {
    return '과채류';
  }
  if (
    /옥수수|콩|강낭콩|완두|동부|팥|녹두|땅콩|두류|빈스|숙주|보리|쌀|현미|찹쌀|조$|수수|기장|율무|깨$|참깨|들깨|서리태|백태|흑태|청태/.test(
      n
    )
  ) {
    return '두류·곡류';
  }
  if (
    /사과|배$|배\(|^배\s|감귤|귤|만감|한라봉|천혜향|레드향|황금향|포도|샤인머스켓|샤인머스캣|복숭아|자두|단감|감$|감\s|대봉|곶감|떫은감|키위|다래|참다래|망고|블루베리|체리|버찌|대추|밤$|밤\(|무화과|유자|매실|살구|오디|앵두|모과|석류|산딸기|복분자|아로니아|보리수|패션푸룻|탄제린|금감|낑깡|천도|과실|과일/.test(
      n
    )
  ) {
    return '과실류';
  }
  if (/마늘|양파|대파|쪽파|파$|파\(|실파|부추|생강|양념/.test(n)) {
    return '양념채소';
  }
  if (
    /고구마(?!순)|감자|무$|무\(|^무\s|알타리|총각무|다발무|당근|연근|우엉|도라지|더덕|마$|비트|순무|콜라비|근채|인삼|수삼|토란|야콘|하수오|칡|돼지감자|초석잠/.test(
      n
    )
  ) {
    return '근채류';
  }
  if (
    /배추|양배추|상추|깻잎|시금치|미나리|쑥갓|청경채|겨자|아욱|근대|얼갈이|봄동|갓$|갓\(|돌산갓|청갓|반청갓|열무|냉이|달래|취나물|곰취|곤달비|방풍|민들레|머위|고들빼기|두릅|고사리|엽채|엽경채|나물|고구마순|고추잎|쌈채|부지갱이|쑥$|쑥\(|유채|당귀|속새|무순|다래순|엄나무|오가피|참나물|비름|명아주|원추리|돌나물|세발나물|함초|죽순|공심채|모닝글로리|호박잎|콩잎|연잎|솔잎|산마늘|삼채|방아|어린잎|새싹|베이비|춘채|신선초|기타채소/.test(
      n
    )
  ) {
    return '엽채·나물류';
  }
  return '기타 농산물';
}

function parseAutoComplete(html: string, mode: 'auction' | 'summary'): {
  items: Map<string, Set<string>>;
  rawOptions: number;
} {
  const regex = /<option[^>]*value=['"]([^'"]*)['"][^>]*>([^<]*)<\/option>/gi;
  const items = new Map<string, Set<string>>();
  let rawOptions = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const rawVal = (match[1] || '').trim();
    if (!rawVal || rawVal === '전체') continue;
    rawOptions += 1;
    if (mode === 'auction' && rawVal.includes('/')) {
      const slashIdx = rawVal.lastIndexOf('/');
      const rawName = rawVal.slice(0, slashIdx).replace(/^=+/, '').trim();
      const rawUnit = rawVal.slice(slashIdx + 1).trim();
      if (!rawName) continue;
      if (!items.has(rawName)) items.set(rawName, new Set());
      if (rawUnit) items.get(rawName)!.add(rawUnit);
    } else {
      const rawName = rawVal.replace(/^=+/, '').trim();
      if (!rawName) continue;
      if (!items.has(rawName)) items.set(rawName, new Set());
    }
  }
  return { items, rawOptions };
}

async function fetchSingleDate(dateStr: string, mode: 'auction' | 'summary') {
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

  for (let attempt = 0; attempt < 2; attempt++) {
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
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!text.trim().startsWith('{')) return { items: new Map<string, Set<string>>(), rawOptions: 0 };
      const json = JSON.parse(text) as { autocompleteList?: string };
      return parseAutoComplete(json.autocompleteList || '', mode);
    } catch {
      if (attempt === 1) return { items: new Map<string, Set<string>>(), rawOptions: 0 };
      await new Promise((r) => setTimeout(r, 350));
    }
  }
  return { items: new Map<string, Set<string>>(), rawOptions: 0 };
}

function formatDateDots(year: number, month: number, day: number): string {
  const d = new Date(Date.UTC(year, month - 1, day));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}.${mm}.${dd}`;
}

async function crawlMonth(year: number, month: number) {
  // Try mid-month weekdays avoiding Sundays & holidays
  const candidateDays = [15, 16, 17, 13, 18, 12];
  let chosenDate = formatDateDots(year, month, 15);
  let auctionRes = { items: new Map<string, Set<string>>(), rawOptions: 0 };

  for (const day of candidateDays) {
    const dt = new Date(Date.UTC(year, month - 1, day));
    if (dt.getUTCDay() === 0) continue; // skip Sunday
    const dateStr = formatDateDots(year, month, day);
    const res = await fetchSingleDate(dateStr, 'auction');
    if (res.rawOptions >= 30) {
      chosenDate = dateStr;
      auctionRes = res;
      break;
    }
  }

  const summaryRes = await fetchSingleDate(chosenDate, 'summary');
  return { year, month, dateStr: chosenDate, auctionRes, summaryRes };
}

async function main() {
  const tasks: Array<{ year: number; month: number }> = [];
  for (let y = START_YEAR; y <= END_YEAR; y++) {
    const maxM = y === END_YEAR ? END_MONTH : 12;
    for (let m = 1; m <= maxM; m++) {
      tasks.push({ year: y, month: m });
    }
  }

  console.log(`Crawling ${tasks.length} monthly Garak Market snapshots (${START_YEAR}.01 ~ ${END_YEAR}.${END_MONTH})...`);

  interface ItemAccum {
    itemName: string;
    category: string;
    units: Set<string>;
    sourceModes: Set<'auction' | 'summary'>;
    yearlyMonthSets: Map<number, Set<number>>;
    monthlyYearSets: Map<number, Set<number>>;
  }

  const itemMap = new Map<string, ItemAccum>();
  const sampledDates: Array<{ year: number; month: number; date: string; auctionItems: number; summaryItems: number }> = [];
  const yearlyStats = new Map<number, { uniqueItems: Set<string>; sampledMonths: number; totalRawOptions: number }>();

  const CONCURRENCY = 6;
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((t) => crawlMonth(t.year, t.month)));
    for (const r of results) {
      sampledDates.push({
        year: r.year,
        month: r.month,
        date: r.dateStr,
        auctionItems: r.auctionRes.items.size,
        summaryItems: r.summaryRes.items.size,
      });

      if (!yearlyStats.has(r.year)) {
        yearlyStats.set(r.year, { uniqueItems: new Set(), sampledMonths: 0, totalRawOptions: 0 });
      }
      const ys = yearlyStats.get(r.year)!;
      if (r.auctionRes.rawOptions > 0 || r.summaryRes.rawOptions > 0) {
        ys.sampledMonths += 1;
      }
      ys.totalRawOptions += r.auctionRes.rawOptions + r.summaryRes.rawOptions;

      const recordItem = (name: string, mode: 'auction' | 'summary', units?: Set<string>) => {
        ys.uniqueItems.add(name);
        let acc = itemMap.get(name);
        if (!acc) {
          acc = {
            itemName: name,
            category: classifyCropCategory(name),
            units: new Set(),
            sourceModes: new Set(),
            yearlyMonthSets: new Map(),
            monthlyYearSets: new Map(),
          };
          itemMap.set(name, acc);
        }
        acc.sourceModes.add(mode);
        if (units) {
          for (const u of units) acc.units.add(u);
        }
        if (!acc.yearlyMonthSets.has(r.year)) acc.yearlyMonthSets.set(r.year, new Set());
        acc.yearlyMonthSets.get(r.year)!.add(r.month);
        if (!acc.monthlyYearSets.has(r.month)) acc.monthlyYearSets.set(r.month, new Set());
        acc.monthlyYearSets.get(r.month)!.add(r.year);
      };

      for (const [name, units] of r.auctionRes.items.entries()) {
        recordItem(name, 'auction', units);
      }
      for (const name of r.summaryRes.items.keys()) {
        recordItem(name, 'summary');
      }
    }
    if ((i + CONCURRENCY) % 24 === 0 || i + CONCURRENCY >= tasks.length) {
      console.log(`  Progress: ${Math.min(i + CONCURRENCY, tasks.length)}/${tasks.length} months (${itemMap.size} unique items so far)`);
    }
  }

  const years = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, idx) => START_YEAR + idx);
  const items = Array.from(itemMap.values())
    .map((acc) => {
      const yearlyActiveMonths = years.map((y) => acc.yearlyMonthSets.get(y)?.size || 0);
      const monthlyPresence10Yr = Array.from({ length: 12 }, (_, idx) => acc.monthlyYearSets.get(idx + 1)?.size || 0);
      const activeYears = years.filter((y, idx) => yearlyActiveMonths[idx] > 0);
      const firstYear = activeYears[0] || START_YEAR;
      const lastYear = activeYears[activeYears.length - 1] || END_YEAR;
      const totalActiveMonthSlots = yearlyActiveMonths.reduce((a, b) => a + b, 0);

      // Compare recent 3 years (2024~2026) avg active months vs earlier 3 years (2017~2019)
      const earlyAvg = (yearlyActiveMonths[0] + yearlyActiveMonths[1] + yearlyActiveMonths[2]) / 3;
      const recentAvg =
        (yearlyActiveMonths[years.length - 3] +
          yearlyActiveMonths[years.length - 2] +
          yearlyActiveMonths[years.length - 1]) /
        3;

      const units = Array.from(acc.units).sort((a, b) => {
        const na = parseFloat(a);
        const nb = parseFloat(b);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
        return a.localeCompare(b, 'ko');
      });

      const gapMonths = monthlyPresence10Yr
        .map((cnt, idx) => ({ month: idx + 1, cnt }))
        .filter((x) => x.cnt <= 2)
        .map((x) => x.month);

      const peakMonths = monthlyPresence10Yr
        .map((cnt, idx) => ({ month: idx + 1, cnt }))
        .filter((x) => x.cnt >= 7)
        .map((x) => x.month);

      return {
        itemName: acc.itemName,
        category: acc.category,
        units,
        sourceModes: Array.from(acc.sourceModes),
        firstYear,
        lastYear,
        activeYearsCount: activeYears.length,
        totalActiveMonthSlots,
        yearlyActiveMonths,
        monthlyPresence10Yr,
        peakMonths,
        gapMonths,
        presenceTrendDelta: Math.round((recentAvg - earlyAvg) * 10) / 10,
      };
    })
    .sort((a, b) => b.totalActiveMonthSlots - a.totalActiveMonthSlots || a.itemName.localeCompare(b.itemName, 'ko'));

  const yearlySummary = years.map((y) => {
    const s = yearlyStats.get(y);
    return {
      year: y,
      uniqueItemCount: s?.uniqueItems.size || 0,
      sampledMonths: s?.sampledMonths || 0,
      totalRawOptions: s?.totalRawOptions || 0,
    };
  });

  const payload = {
    source: 'temp.garak.co.kr/price/selectAutoCompleteAjax.do',
    crawledAt: new Date().toISOString(),
    periodStart: `${START_YEAR}.01`,
    periodEnd: `${END_YEAR}.${String(END_MONTH).padStart(2, '0')}`,
    years,
    totalSampledMonths: sampledDates.filter((d) => d.auctionItems > 0 || d.summaryItems > 0).length,
    totalUniqueItems: items.length,
    yearlySummary,
    sampledDates,
    items,
  };

  const outDir = path.resolve(process.cwd(), 'public', 'data');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'garak-10yr-catalog.json');
  fs.writeFileSync(outPath, JSON.stringify(payload), 'utf8');

  console.log(`\nDONE! Saved ${outPath}`);
  console.log(`Total sampled active months: ${payload.totalSampledMonths}/${tasks.length}`);
  console.log(`Total unique items (2017~2026): ${payload.totalUniqueItems}`);
  console.log('Yearly summary:', JSON.stringify(yearlySummary));
  console.log('File size (KB):', Math.round(fs.statSync(outPath).size / 1024));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
