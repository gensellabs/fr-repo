/**
 * Backfill script: re-generate all usernames using the new formula and
 * set the default password + mustChangePassword = true for every responder.
 *
 * New username formula:
 *   first 6 alpha chars of surname
 *   + fill to 8 alpha chars from firstName
 *   + 2-digit counter scoped per country (01–99, wrapping)
 *
 * Run with:
 *   cd packages/backend
 *   ts-node src/scripts/backfill-usernames.ts
 */

import { prisma } from '../lib/prisma';
import { buildAlphaBase } from '../lib/username';
import bcrypt from 'bcryptjs';

const DEFAULT_PASSWORD = 'Password!12@';

async function main() {
  console.log('Hashing default password…');
  const defaultHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  // Load ALL responders with their country (via org chain)
  const responders = await prisma.lovResponder.findMany({
    select: {
      id: true,
      firstName: true,
      surname: true,
      organisation: {
        select: {
          country: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { id: 'asc' }, // stable order within each country
  });

  console.log(`Found ${responders.length} responders to process.`);

  // Group by countryId
  const byCountry = new Map<number, typeof responders>();
  const noCountry: typeof responders = [];

  for (const r of responders) {
    const cid = r.organisation?.country?.id;
    if (!cid) {
      noCountry.push(r);
    } else {
      if (!byCountry.has(cid)) byCountry.set(cid, []);
      byCountry.get(cid)!.push(r);
    }
  }

  let updated = 0;
  let skipped = 0;

  for (const [countryId, group] of byCountry) {
    const countryName = group[0].organisation?.country?.name ?? String(countryId);
    console.log(`\nCountry: ${countryName} (${group.length} responders)`);

    let counter = 0;

    for (const r of group) {
      counter++;
      if (counter > 99) counter = 1; // wrap at 99 → 01

      const base = buildAlphaBase(r.firstName, r.surname);
      if (!base) {
        console.log(`  Skipping id=${r.id} — no name to build base from`);
        skipped++;
        continue;
      }

      const username = `${base}${String(counter).padStart(2, '0')}`;

      await prisma.lovResponder.update({
        where: { id: r.id },
        data: {
          username,
          passwordHash: defaultHash,
          mustChangePassword: true,
        },
      });

      const name = [r.firstName, r.surname].filter(Boolean).join(' ');
      console.log(`  id=${r.id}  ${name.padEnd(30)} → ${username}`);
      updated++;
    }
  }

  if (noCountry.length > 0) {
    console.log(`\nSkipped (no country link): ${noCountry.length}`);
    for (const r of noCountry) {
      console.log(`  id=${r.id}  ${[r.firstName, r.surname].filter(Boolean).join(' ')}`);
      skipped++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
