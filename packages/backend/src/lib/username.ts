import { prisma } from './prisma';

/**
 * Build the base username from name parts, ISO code, and mobile.
 *
 * Formula:
 *   last3chars(firstName, fill forward from surname if <3 chars)
 *   + isoCode.toLowerCase()
 *   + last3digits(mobile)
 *
 * Returns null if mobile is absent or has fewer than 3 digits.
 */
export function buildUsernameBase(
  firstName: string | null | undefined,
  surname:   string | null | undefined,
  isoCode:   string,
  mobile:    string | null | undefined,
): string | null {
  if (!mobile) return null;

  // Strip non-digits; need at least 3
  const digits = mobile.replace(/\D/g, '');
  if (digits.length < 3) return null;
  const last3mobile = digits.slice(-3);

  // Build name chars: concatenate firstName + surname (no spaces), take last 3
  const first    = (firstName ?? '').trim();
  const last     = (surname   ?? '').trim();
  const combined = (first + last).replace(/\s+/g, '');

  if (!combined) return null;

  let nameChars: string;
  if (combined.length >= 3) {
    nameChars = combined.slice(-3).toLowerCase();
  } else {
    // Pad to 3 by repeating the last character
    nameChars = combined.toLowerCase().padEnd(3, combined[combined.length - 1]).toLowerCase();
  }

  return `${nameChars}${isoCode.toLowerCase()}${last3mobile}`;
}

/**
 * Generate a unique username.
 * On collision appends _2, _3, etc. (up to _99).
 * Pass excludeId to ignore the responder being edited.
 * Returns null if mobile is missing or too short.
 */
export async function generateUsername(
  firstName:  string | null | undefined,
  surname:    string | null | undefined,
  isoCode:    string,
  mobile:     string | null | undefined,
  excludeId?: number,
): Promise<string | null> {
  const base = buildUsernameBase(firstName, surname, isoCode, mobile);
  if (!base) return null;

  const whereNot = excludeId ? { id: { not: excludeId } } : {};

  // Try base first
  const clash = await prisma.lovResponder.findFirst({ where: { username: base, ...whereNot } });
  if (!clash) return base;

  // Try _2, _3, ...
  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}_${i}`;
    const conflict  = await prisma.lovResponder.findFirst({ where: { username: candidate, ...whereNot } });
    if (!conflict) return candidate;
  }

  return null; // astronomically unlikely
}
