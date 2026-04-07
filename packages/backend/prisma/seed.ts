import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ─── Geography: South Africa ─────────────────────────────────────────────────
  const southAfrica = await prisma.country.upsert({
    where: { isoCode: 'ZAF' },
    update: { name: 'South Africa', dialCode: '+27' },
    create: { name: 'South Africa', isoCode: 'ZAF', dialCode: '+27' },
  });
  console.log(`  ✓ Country: ${southAfrica.name}`);

  // Provinces
  const provinceNames = [
    'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal',
    'Limpopo', 'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape',
  ];
  const provinceMap: Record<string, number> = {};
  for (let i = 0; i < provinceNames.length; i++) {
    const p = await prisma.province.upsert({
      where: { name_countryId: { name: provinceNames[i], countryId: southAfrica.id } },
      update: {},
      create: { name: provinceNames[i], countryId: southAfrica.id, sortOrder: i },
    });
    provinceMap[p.name] = p.id;
  }
  console.log(`  ✓ ${provinceNames.length} provinces`);

  // Districts (Western Cape focus — others can be added via admin panel)
  const wcId = provinceMap['Western Cape'];
  const districtNames = [
    { name: 'Cape Winelands', provinceId: wcId },
    { name: 'City of Cape Town', provinceId: wcId },
    { name: 'Eden', provinceId: wcId },
    { name: 'Overberg', provinceId: wcId },
    { name: 'West Coast', provinceId: wcId },
  ];
  const districtMap: Record<string, number> = {};
  for (let i = 0; i < districtNames.length; i++) {
    const d = await prisma.district.upsert({
      where: { name_provinceId: { name: districtNames[i].name, provinceId: districtNames[i].provinceId } },
      update: {},
      create: { name: districtNames[i].name, provinceId: districtNames[i].provinceId, sortOrder: i },
    });
    districtMap[d.name] = d.id;
  }
  console.log(`  ✓ ${districtNames.length} districts (Western Cape)`);

  // ─── Default Organisation ────────────────────────────────────────────────────
  const defaultOrg = await prisma.organisation.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Franschhoek First Responders',
      countryId: southAfrica.id,
      provinceId: wcId,
      districtId: districtMap['Cape Winelands'],
      isActive: true,
      approvedAt: new Date(),
    },
  });
  console.log(`  ✓ Organisation: ${defaultOrg.name}`);

  // ─── Admin Users ─────────────────────────────────────────────────────────────
  const superAdminHash = await bcrypt.hash('SuperAdmin@2025!', 12);
  const countrySysAdminHash = await bcrypt.hash('CountryAdmin@2025!', 12);

  await prisma.adminUser.upsert({
    where: { email: 'superadmin@firstresponders.app' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'superadmin@firstresponders.app',
      passwordHash: superAdminHash,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  await prisma.adminUser.upsert({
    where: { email: 'sysadmin.za@firstresponders.app' },
    update: {},
    create: {
      name: 'SA Country Admin',
      email: 'sysadmin.za@firstresponders.app',
      passwordHash: countrySysAdminHash,
      role: 'COUNTRY_SYSADMIN',
      countryId: southAfrica.id,
      isActive: true,
    },
  });
  console.log('  ✓ Admin users (SuperAdmin + CountrySysAdmin)');

  // ─── Call Types (country-level) ───────────────────────────────────────────────
  const callTypes = [
    '? Appendicitis', '?MI', 'Assault', 'Asthmatic', 'Baby', 'Baby Unresponsive',
    'Baby Unwell', 'Bee Sting', 'Birth', 'Bleeding', 'Broken Arm', 'Broken Finger',
    'Burn', 'Collapse', 'Cyclist', 'Cyclist Knocked', 'Distress', 'Drowning',
    'Electrocution', 'Explosion', 'Fainted', 'Fallen', 'Fallen from Bike',
    'Food Poisoning', 'Gas Explosion', 'Hanging', 'Heatstroke', 'Hysterics',
    'MBA', 'MVA', 'Needle through foot', 'OD', 'PVA', 'Seizure/s',
    'Severe Vomitting', 'SOB', 'Stabbing', 'Tractor on someone', 'UNK',
    'Unresponsive', 'Unwell', 'Vomitting',
  ];
  for (let i = 0; i < callTypes.length; i++) {
    await prisma.lovCallType.upsert({
      where: { value: callTypes[i] },
      update: { countryId: southAfrica.id },
      create: { value: callTypes[i], countryId: southAfrica.id, sortOrder: i },
    });
  }
  console.log(`  ✓ ${callTypes.length} call types`);

  // ─── Reasons / Diagnoses (country-level) ──────────────────────────────────────
  const reasons = [
    '? Appendicitis', '?MI', 'Assault', 'Baby Unresponsive', 'Baby Unwell',
    'Bee Sting', 'Birth', 'Bleeding', 'Broken Arm', 'Collapse', 'Cyclist',
    'Distress', 'Drowning', 'Explosion', 'Fainted', 'Fallen', 'Fallen from Bike',
    'Food Poisoning', 'Gas Explosion', 'Hanging', 'Heatstroke', 'MBA', 'MVA',
    'Needle through foot', 'OD', 'PVA', 'Seizure/s', 'Severe Vomitting', 'SOB',
    'Stabbing', 'Tractor on someone', 'UNK', 'Unresponsive', 'Unwell', 'Vomitting',
  ];
  for (let i = 0; i < reasons.length; i++) {
    await prisma.lovReason.upsert({
      where: { value: reasons[i] },
      update: { countryId: southAfrica.id },
      create: { value: reasons[i], countryId: southAfrica.id, sortOrder: i },
    });
  }
  console.log(`  ✓ ${reasons.length} diagnoses`);

  // ─── Responders (org-scoped) ─────────────────────────────────────────────────
  const responders: Array<{ name: string; email?: string; mobile?: string; role?: 'GROUP_SYSADMIN' | 'GROUP_ADMIN' | 'RESPONDER'; isAdmin?: boolean; isSysAdmin?: boolean }> = [
    { name: 'Anine' },
    { name: 'Bella' },
    { name: 'Bianca', role: 'GROUP_SYSADMIN', isAdmin: true, isSysAdmin: true },
    { name: 'Coleen' },
    { name: 'Debbie' },
    { name: 'Euston', role: 'GROUP_ADMIN', isAdmin: true },
    { name: 'Hugh' },
    { name: 'Jamie' },
    { name: 'Kean' },
    { name: 'Kurt', role: 'GROUP_ADMIN', isAdmin: true },
    { name: 'Kyle' },
    { name: 'Lods' },
    { name: 'Ricardo' },
    { name: 'TheoE', role: 'GROUP_SYSADMIN', isAdmin: true, isSysAdmin: true },
  ];
  for (let i = 0; i < responders.length; i++) {
    const r = responders[i];
    // Use findFirst + upsert pattern since unique is now [value, organisationId]
    const existing = await prisma.lovResponder.findFirst({
      where: { value: r.name, organisationId: defaultOrg.id },
    });
    if (existing) {
      await prisma.lovResponder.update({
        where: { id: existing.id },
        data: {
          role: r.role ?? 'RESPONDER',
          isAdmin: r.isAdmin ?? false,
          isSysAdmin: r.isSysAdmin ?? false,
          organisationId: defaultOrg.id,
        },
      });
    } else {
      await prisma.lovResponder.create({
        data: {
          value: r.name,
          email: r.email,
          mobile: r.mobile,
          role: r.role ?? 'RESPONDER',
          isAdmin: r.isAdmin ?? false,
          isSysAdmin: r.isSysAdmin ?? false,
          organisationId: defaultOrg.id,
          sortOrder: i,
        },
      });
    }
  }
  // Migrate legacy responders (null org) — re-point their incident references to the new org-scoped records
  const legacyResponders = await prisma.lovResponder.findMany({ where: { organisationId: null } });
  for (const legacy of legacyResponders) {
    const newResponder = await prisma.lovResponder.findFirst({
      where: { value: legacy.value, organisationId: defaultOrg.id },
    });
    if (newResponder) {
      await prisma.incidentResponder.updateMany({
        where: { responderId: legacy.id },
        data: { responderId: newResponder.id },
      });
      await prisma.incidentPhoto.updateMany({
        where: { capturedBy: legacy.id },
        data: { capturedBy: newResponder.id },
      });
    }
    await prisma.lovResponder.delete({ where: { id: legacy.id } });
  }
  console.log(`  ✓ ${responders.length} responders`);

  // ─── Hospitals (district-level) ───────────────────────────────────────────────
  const cwDistrictId = districtMap['Cape Winelands'];
  const hospitals = [
    "Christian Barnard", "Didn't go", "Paarl", "Paarl Medi Cli", "Paarl Prov",
    "Panorama", "Stellies Medi Cli", "Stellies Prov", "UNK",
  ];
  for (let i = 0; i < hospitals.length; i++) {
    await prisma.lovHospital.upsert({
      where: { value: hospitals[i] },
      update: { districtId: cwDistrictId },
      create: { value: hospitals[i], districtId: cwDistrictId, sortOrder: i },
    });
  }
  console.log(`  ✓ ${hospitals.length} hospitals`);

  // ─── Transports (district-level) ─────────────────────────────────────────────
  const transports = [
    'AMBO', 'CBMH NETCARE 8', 'ER 24', 'ER 24 - M161', 'ER 24 - M82',
    'ER 24 - M82 & Metro', 'ER 24 - M82 & Metro 122', 'ER 24 - M95', 'ER 24 - M83',
    'ER M41', 'Metro', 'Metro M15', 'Metro 121', 'Metro 128', 'Metro 130',
    'Metro 131', 'Metro 164', 'Metro 166', 'Metro A131', 'Titanium', 'UNK',
  ];
  for (let i = 0; i < transports.length; i++) {
    await prisma.lovTransport.upsert({
      where: { value: transports[i] },
      update: { districtId: cwDistrictId },
      create: { value: transports[i], districtId: cwDistrictId, sortOrder: i },
    });
  }
  console.log(`  ✓ ${transports.length} transports`);

  // ─── Medical History Presets (country-level) ──────────────────────────────────
  const medHistoryPresets = [
    'Anti-depressant', 'BP Meds', 'BP Meds / Cholestrol Meds / Water Pill',
    'Cholestrol / Depression / Heart Condition',
    'Depression / Dopaquale / Viovon / Sobadex', 'Diabetic',
    'Heart Condition / Thyroid problem', 'High BP', 'High BP / Anti-depressant',
    'HPT', 'Tik addiction / HIV / Epilepsy / TB', 'UNK', 'NKA',
  ];
  for (let i = 0; i < medHistoryPresets.length; i++) {
    await prisma.lovMedicalHistoryPreset.upsert({
      where: { value: medHistoryPresets[i] },
      update: { countryId: southAfrica.id },
      create: { value: medHistoryPresets[i], countryId: southAfrica.id, sortOrder: i },
    });
  }
  console.log(`  ✓ ${medHistoryPresets.length} medical history presets`);

  // ─── Drugs (country-level) ────────────────────────────────────────────────────
  const drugs: Array<{ name: string; defaultUom: string | null }> = [
    { name: 'Adrenaline',      defaultUom: 'mg' },
    { name: 'Aspirin',         defaultUom: 'mg' },
    { name: 'IV Fluids',       defaultUom: 'ml' },
    { name: 'GTN',             defaultUom: 'mg' },
    { name: 'Imodium',         defaultUom: 'tab' },
    { name: 'Ketamine',        defaultUom: 'mg' },
    { name: 'Lignacain',       defaultUom: 'ml' },
    { name: 'Medaz',           defaultUom: 'mg' },
    { name: 'Metoclopramide',  defaultUom: 'mg' },
    { name: 'Morphine',        defaultUom: 'mg' },
    { name: 'Ondansetron',     defaultUom: 'mg' },
    { name: 'Perfalgan',       defaultUom: 'mg' },
    { name: 'TXA',             defaultUom: 'g' },
  ];
  for (let i = 0; i < drugs.length; i++) {
    await prisma.lovDrug.upsert({
      where: { name: drugs[i].name },
      update: { countryId: southAfrica.id },
      create: { name: drugs[i].name, defaultUom: drugs[i].defaultUom, countryId: southAfrica.id, sortOrder: i },
    });
  }
  console.log(`  ✓ ${drugs.length} drugs`);

  // ─── Areas (org-scoped, district-linked) ──────────────────────────────────────
  const areaNames = ['FHK', 'GDL', 'Klapmuts', 'Paarl', 'Simondium', 'WHK'];
  const areaMap: Record<string, number> = {};
  for (let i = 0; i < areaNames.length; i++) {
    const area = await prisma.lovArea.upsert({
      where: { value: areaNames[i] },
      update: { organisationId: defaultOrg.id, districtId: cwDistrictId },
      create: { value: areaNames[i], organisationId: defaultOrg.id, districtId: cwDistrictId, sortOrder: i },
    });
    areaMap[areaNames[i]] = area.id;
  }
  console.log(`  ✓ ${areaNames.length} areas`);

  // ─── Locations ────────────────────────────────────────────────────────────────
  type LocationSeed = { value: string; area?: string };
  const locations: LocationSeed[] = [
    { value: '103 Bell Street',              area: 'Klapmuts' },
    { value: '13 Forelle Rd',               area: 'GDL' },
    { value: '2 Eldorado St',               area: 'GDL' },
    { value: '23 Keerom Str',               area: 'GDL' },
    { value: '7 La Provance',               area: 'GDL' },
    { value: '8 Lower Lea',                 area: 'GDL' },
    { value: 'Jan Phillips Berg',           area: 'Paarl' },
    { value: 'Jan Van Riebeeck',            area: 'Paarl' },
    { value: 'Keerboom Street',             area: 'GDL' },
    { value: 'La Provance 37, Mooiwater',   area: 'GDL' },
    { value: 'Langrug',                     area: 'GDL' },
    { value: 'Leeubekkie Str',              area: 'WHK' },
    { value: 'Lower & Upper',               area: 'GDL' },
    { value: 'Monument',                    area: 'FHK' },
    { value: 'Oakstreet 22',               area: 'GDL' },
    { value: 'Packham Street',             area: 'GDL' },
    { value: 'R45 Agrimark',               area: 'Simondium' },
    { value: 'R45 Pass',                   area: 'FHK' },
    { value: 'SAPS',                        area: 'FHK' },
    { value: 'Skool Str',                  area: 'GDL' },
    { value: 'Swawelstert Road',           area: 'Paarl' },
    { value: "Taki's",                     area: 'FHK' },
    { value: 'Terbadore',                  area: 'FHK' },
    { value: 'Upper Lea Street',           area: 'GDL' },
    { value: 'USAVE',                      area: 'GDL' },
    { value: 'WHK',                        area: 'WHK' },
    { value: 'WHK Intersection',           area: 'WHK' },
    { value: 'Pass',                       area: 'FHK' },
    { value: 'Franschhoek Hotel',          area: 'FHK' },
    { value: 'Franschhoek HS',             area: 'FHK' },
    { value: 'Beyers Str',                 area: 'Klapmuts' },
    { value: 'R44' }, { value: '1 Lillie St' }, { value: '23 La Cotte St' },
    { value: '25 Dirkie Uys Street' }, { value: '3 Wilhelmina Str' },
    { value: '61 Reservoir Street' }, { value: "9 L'Afrique Verte Estate" },
    { value: 'Across Court' }, { value: 'Angelier Street' },
    { value: 'Boschenmeer' }, { value: 'Café Du Vine' },
    { value: 'Dirkie Uys & Reservoir Street' }, { value: 'Dirkie Uys Street' },
    { value: 'Drakenstein Club' }, { value: 'Farm' },
    { value: 'French Connection' }, { value: 'Grande Provance' },
    { value: 'GYM' }, { value: 'Indian Summer' }, { value: 'La Chatainge Farm' },
    { value: 'La Cotte Farm' }, { value: 'La Motte' },
    { value: 'La Motte Restaurant' }, { value: 'La Petite Ferme' },
    { value: 'Lanqedoc' }, { value: 'Le Franschhoek Hotel @ Hey Joe' },
    { value: 'Maasdorp Entrance' }, { value: 'Mad Hatters' },
    { value: 'Mad Hatters Parking' }, { value: 'Market @ Church' },
    { value: 'N1 Paarl' }, { value: 'Perchant Jewellery Shop' },
    { value: 'Police Station' }, { value: 'R101 Klapmuts' },
    { value: 'R304 Pink Geranium' }, { value: 'Rickety Bridge' },
    { value: 'Robertson' }, { value: 'Uitkyk Str & Main Road' },
    { value: 'UNK' }, { value: 'Val de Vie' }, { value: 'Warwick' },
    { value: 'Windmeul Kelder' },
  ];

  let locationCount = 0;
  for (let i = 0; i < locations.length; i++) {
    const { value, area } = locations[i];
    const areaId = area ? (areaMap[area] ?? null) : null;
    try {
      await prisma.lovLocation.upsert({
        where: { value_areaId: { value, areaId: areaId ?? 0 } },
        update: {},
        create: { value, areaId, sortOrder: i },
      });
    } catch {
      const existing = await prisma.lovLocation.findFirst({ where: { value, areaId: null } });
      if (!existing) {
        await prisma.lovLocation.create({ data: { value, areaId: null, sortOrder: i } });
      }
    }
    locationCount++;
  }
  console.log(`  ✓ ${locationCount} locations`);

  // ─── Migrate existing incidents to default org ────────────────────────────────
  await prisma.incident.updateMany({
    where: { organisationId: null },
    data: { organisationId: defaultOrg.id },
  });
  console.log('  ✓ Existing incidents assigned to default org');

  console.log('\nSeed complete ✓');
  console.log('\n─── Admin Credentials ───────────────────────────────');
  console.log('  SuperAdmin:       superadmin@firstresponders.app  /  SuperAdmin@2025!');
  console.log('  CountrySysAdmin:  sysadmin.za@firstresponders.app /  CountryAdmin@2025!');
  console.log('────────────────────────────────────────────────────');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
