import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

const MOCK_PATH = path.join(process.cwd(), 'data', 'mock-db.json');
const raw = fs.readFileSync(MOCK_PATH, 'utf-8');
const mock = JSON.parse(raw);

const prisma = new PrismaClient();

async function main() {
  console.log('Mock file:', MOCK_PATH);
  console.log(`Mock: ${mock.contractors.length} contractors, ${mock.priceItems.length} priceItems, ${mock.estimates.length} estimates, ${mock.estimateItems.length} items`);

  // Get Neon contractor (oldest)
  let contractor = await prisma.contractor.findFirst({ orderBy: { createdAt: 'asc' }});
  if (!contractor) {
    console.log('No contractor in Neon, creating from mock contractor...');
    const mC = mock.contractors[0];
    contractor = await prisma.contractor.create({ data: { name: mC.name, phone: mC.phone }});
    console.log('Created contractor', contractor.id);
  } else {
    console.log('Neon contractor:', contractor.id, contractor.name, contractor.phone);
    // Update name/phone to enriched demo if different? Keep existing name but ensure phone
    // We'll update to match mock if mock is more complete? Let's keep existing but ensure phone exists
    // Optionally update to "مؤسسة النور" if user wants demo branding - we will upsert items regardless
  }

  // Ensure all mock priceItems exist in Neon (by itemName)
  const neonItems = await prisma.priceItem.findMany({ where: { contractorId: contractor.id }});
  const neonByName = new Map(neonItems.map(p => [p.itemName, p]));
  console.log(`Neon has ${neonItems.length} priceItems currently`);

  // Build map from mock priceItem id -> neon id (by name)
  const mockIdToNeonId = new Map();

  for (const mPi of mock.priceItems) {
    const existing = neonByName.get(mPi.itemName);
    if (existing) {
      // update unitPrice/category/unit if different to match enriched
      if (Number(existing.unitPrice) !== Number(mPi.unitPrice) || existing.category !== mPi.category || existing.unit !== mPi.unit) {
        await prisma.priceItem.update({
          where: { id: existing.id },
          data: { category: mPi.category, unit: mPi.unit, unitPrice: mPi.unitPrice }
        });
        console.log(`Updated priceItem "${mPi.itemName}"`);
      }
      mockIdToNeonId.set(mPi.id, existing.id);
    } else {
      const created = await prisma.priceItem.create({
        data: {
          contractorId: contractor.id,
          category: mPi.category,
          itemName: mPi.itemName,
          unit: mPi.unit,
          unitPrice: mPi.unitPrice,
          isActive: mPi.isActive
        }
      });
      console.log(`Created priceItem "${mPi.itemName}" -> ${created.id}`);
      mockIdToNeonId.set(mPi.id, created.id);
      neonByName.set(mPi.itemName, created);
    }
  }

  console.log(`Mapped ${mockIdToNeonId.size} priceItems`);

  // Migrate estimates
  const existingEstimates = await prisma.estimate.findMany({ where: { contractorId: contractor.id }});
  console.log(`Neon estimates before: ${existingEstimates.length}`);
  // We will insert mock estimates that don't already exist (by clientName+roomType+rawDescription unique)
  // Simpler: insert all mock estimates with new IDs but check for duplicate by rawDescription
  const existingDescs = new Set(existingEstimates.map(e => e.rawDescription));

  let inserted = 0;
  for (const mEst of mock.estimates) {
    if (existingDescs.has(mEst.rawDescription)) {
      console.log(`Skipping existing estimate "${mEst.clientName} ${mEst.roomType}" already in Neon`);
      continue;
    }
    const mItems = mock.estimateItems.filter(it => it.estimateId === mEst.id);
    // Map priceItemIds
    const itemsToCreate = mItems.map(it => ({
      priceItemId: it.priceItemId ? (mockIdToNeonId.get(it.priceItemId) ?? null) : null,
      itemName: it.itemName,
      quantity: it.quantity,
      unit: it.unit,
      unitPrice: it.unitPrice,
      lineTotal: it.lineTotal,
      matched: it.matched,
      source: it.source
    }));

    // Need to backdate createdAt? Prisma will set now. We can try to set createdAt explicitly if schema allows; but createdAt has default now, we can provide value.
    const created = await prisma.estimate.create({
      data: {
        // let DB generate id if we want new, but we could preserve mock id; use mock id for traceability if not exists
        id: mEst.id,
        contractorId: contractor.id,
        clientName: mEst.clientName,
        roomType: mEst.roomType,
        areaM2: mEst.areaM2,
        rawDescription: mEst.rawDescription,
        photoPaths: mEst.photoPaths,
        aiNotes: mEst.aiNotes,
        status: mEst.status,
        createdAt: new Date(mEst.createdAt),
        items: { create: itemsToCreate }
      }
    });
    console.log(`Inserted estimate "${mEst.clientName} ${mEst.roomType}" ${mEst.status} id=${created.id} items=${itemsToCreate.length}`);
    inserted++;
  }

  console.log(`Done. Inserted ${inserted} new estimates.`);

  const finalCounts = await Promise.all([
    prisma.contractor.count(),
    prisma.priceItem.count({ where: { contractorId: contractor.id }}),
    prisma.estimate.count({ where: { contractorId: contractor.id }})
  ]);
  console.log(`Final Neon: contractors=${finalCounts[0]} priceItems=${finalCounts[1]} estimates=${finalCounts[2]}`);

  // Ensure contractor has correct demo name/phone if user wants?
  // We'll keep existing contractor name, but if it's old placeholder, update to enriched
  const mockContractor = mock.contractors[0];
  if (contractor.name !== mockContractor.name) {
    console.log(`Contractor name differs: Neon "${contractor.name}" vs Mock "${mockContractor.name}"`);
    console.log(`Keeping Neon name (if you want to update to mock, uncomment code)`);
    // Uncomment to update:
    // await prisma.contractor.update({ where:{id: contractor.id}, data:{ name: mockContractor.name, phone: mockContractor.phone }});
  }
}

main().catch(e=>{ console.error(e); process.exit(1)}).finally(()=> prisma.$disconnect());
