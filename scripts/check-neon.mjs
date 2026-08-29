import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

const prisma = new PrismaClient();
try {
  const c = await prisma.contractor.findMany();
  console.log('contractors', c.length, c.map(x=>x.name));
  const p = await prisma.priceItem.findMany();
  console.log('priceItems', p.length);
  const e = await prisma.estimate.findMany({include:{items:true}});
  console.log('estimates', e.length);
  e.forEach(est=> console.log(`- ${est.clientName} ${est.roomType} ${est.status} items=${est.items.length}`));
} catch (e) {
  console.error('ERROR', e);
} finally {
  await prisma.$disconnect();
}
