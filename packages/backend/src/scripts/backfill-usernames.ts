/**
 * One-off script: generate usernames for all existing LovResponder records
 * that have a mobile number but no username yet.
 *
 * Run with:
 *   cd packages/backend
 *   ts-node src/scripts/backfill-usernames.ts
 */

import { prisma } from '../lib/prisma';
import { generateUsername } from '../lib/username';

async function main() {
  // Load all responders without a username, with their org's country isoCode
  const responders = await prisma.lovResponder.findMany({
    where: { username: null, mobile: { not: null } },
    select: {
      id: true,
      firstName: true,
      surname: true,
      mobile: true,
      organisation: {
        select: {
          country: { select: { isoCode: true } },
        },
      },
    },
  });

  console.log(`Found ${responders.length} responders to backfill.`);

  let updated = 0;
  let skipped = 0;

  for (const r of responders) {
    const isoCode = r.organisation?.country?.isoCode;
    if (!isoCode) {
      console.log(`  Skipping id=${r.id} — no country ISO code (no org or country)`);
      skipped++;
      continue;
    }

    const username = await generateUsername(r.firstName, r.surname, isoCode, r.mobile, r.id);
    if (!username) {
      console.log(`  Skipping id=${r.id} — could not generate username`);
      skipped++;
      continue;
    }

    await prisma.lovResponder.update({ where: { id: r.id }, data: { username } });
    console.log(`  id=${r.id} → ${username}`);
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
