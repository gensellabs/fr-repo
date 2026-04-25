import { prisma } from './prisma';

/**
 * Build the 8-character alpha base for a username.
 *
 * Rule: take up to 6 alpha chars from the surname, then fill to 8 total
 * from the firstName (alpha only, all lowercase).
 *
 * Examples:
 *   Engels  + Theo   → "engelsth"  (6 + 2)
 *   Maske   + Kurt   → "maskekur"  (5 + 3)
 *   Edwards + Hugh   → "edwardhu"  (6 + 2, 's' truncated)
 */
export function buildAlphaBase(
  firstName: string | null | undefined,
  surname:   string | null | undefined,
): string | null {
  const alphaOnly = (s: string) => s.replace(/[^a-zA-Z]/g, '').toLowerCase();
  const surnameAlpha = alphaOnly(surname   ?? '');
  const nameAlpha    = alphaOnly(firstName ?? '');

  const surnameChars = surnameAlpha.slice(0, 6);         // up to 6 from surname
  const remaining    = 8 - surnameChars.length;          // how many more needed
  const nameChars    = nameAlpha.slice(0, remaining);    // fill from firstName

  const base = surnameChars + nameChars;
  return base.length > 0 ? base : null;
}

/**
 * Find the next available 2-digit counter (01–99, wrapping) for a country.
 * Scans all existing responder usernames in the same country and picks the
 * first unused slot after the current maximum.
 */
async function nextCountryCounter(
  countryId: number,
  excludeId?: number,
): Promise<string> {
  const responders = await prisma.lovResponder.findMany({
    where: {
      organisation: { countryId },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { username: true },
  });

  const usedCounters = new Set<number>();
  for (const r of responders) {
    if (r.username) {
      const match = r.username.match(/(\d{2})$/);
      if (match) usedCounters.add(parseInt(match[1], 10));
    }
  }

  // Start searching from (maxUsed + 1), cycling 01–99
  const maxUsed = usedCounters.size > 0 ? Math.max(...usedCounters) : 0;
  for (let i = 1; i <= 99; i++) {
    const candidate = ((maxUsed - 1 + i) % 99) + 1;
    if (!usedCounters.has(candidate)) {
      return String(candidate).padStart(2, '0');
    }
  }

  // All 99 slots used — wrap to 01 (extremely unlikely)
  return '01';
}

/**
 * Generate a unique username for a responder.
 *
 * Formula: buildAlphaBase(firstName, surname) + 2-digit country counter (01–99)
 * The counter is per-country and wraps after 99.
 *
 * Pass excludeId when regenerating for an existing responder so their own
 * current counter is not counted as "used".
 *
 * Returns null if both firstName and surname are empty.
 */
export async function generateUsername(
  firstName:  string | null | undefined,
  surname:    string | null | undefined,
  countryId:  number,
  excludeId?: number,
): Promise<string | null> {
  const base = buildAlphaBase(firstName, surname);
  if (!base) return null;

  const counter = await nextCountryCounter(countryId, excludeId);
  return `${base}${counter}`;
}
