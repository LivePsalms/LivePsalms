/** 'YYYY-MM-DD' strings. Pure; no Date.now coupling — caller passes today's date. */

export function appendStudyDate(dates: string[], todayYMD: string): string[] {
  const set = new Set(dates);
  set.add(todayYMD);
  return [...set].sort();
}

/** True if the distinct dates contain any run of three consecutive calendar days. */
export function hasThreeConsecutiveDays(dates: string[]): boolean {
  const distinct = [...new Set(dates)].sort();
  if (distinct.length < 3) return false;
  for (let i = 0; i + 2 < distinct.length; i++) {
    if (isNextDay(distinct[i], distinct[i + 1]) && isNextDay(distinct[i + 1], distinct[i + 2])) {
      return true;
    }
  }
  return false;
}

function isNextDay(a: string, b: string): boolean {
  const da = Date.parse(a + 'T00:00:00Z');
  const db = Date.parse(b + 'T00:00:00Z');
  return db - da === 86_400_000;
}
