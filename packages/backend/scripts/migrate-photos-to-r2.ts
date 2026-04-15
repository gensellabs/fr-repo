/**
 * Part A: Upload all local photos to R2 (no DB connection needed).
 * Uploads every .jpg in uploads/ as photos/<filename> in R2.
 *
 * Usage:
 *   R2_ENDPOINT="https://..." R2_ACCESS_KEY_ID="..." \
 *   R2_SECRET_ACCESS_KEY="..." R2_BUCKET_NAME="firstresponders-photos" \
 *   npx ts-node --project tsconfig.json scripts/migrate-photos-to-r2.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const UPLOADS_DIR = path.resolve(__dirname, '../uploads');
const BUCKET      = process.env.R2_BUCKET_NAME!;

const required = ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
for (const key of required) {
  if (!process.env[key]) { console.error(`❌  Missing: ${key}`); process.exit(1); }
}

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function existsInR2(key: string): Promise<boolean> {
  try { await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key })); return true; }
  catch { return false; }
}

async function main() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.error(`❌  uploads/ directory not found at ${UPLOADS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(UPLOADS_DIR).filter(f => f.endsWith('.jpg'));
  console.log(`📸  Found ${files.length} local photos to upload.\n`);

  let uploaded = 0, skipped = 0, errors = 0;

  for (const filename of files) {
    const key       = `photos/${filename}`;
    const localPath = path.join(UPLOADS_DIR, filename);

    if (await existsInR2(key)) {
      console.log(`  ⏭  Already in R2: ${key}`);
      skipped++;
      continue;
    }

    try {
      const buffer = fs.readFileSync(localPath);
      await r2.send(new PutObjectCommand({
        Bucket: BUCKET, Key: key,
        Body: buffer, ContentType: 'image/jpeg',
      }));
      console.log(`  ✅  Uploaded: ${key}`);
      uploaded++;
    } catch (err) {
      console.error(`  ❌  Failed: ${filename}`, err);
      errors++;
    }
  }

  console.log(`
────────────────────────────────
Upload complete:
  ✅  Uploaded : ${uploaded}
  ⏭  Skipped  : ${skipped}
  ❌  Errors   : ${errors}
────────────────────────────────
Part B: now deploy the API migration endpoint and call it once.`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
