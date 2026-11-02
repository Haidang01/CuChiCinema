import 'dotenv/config';
import { db } from '../apps/server/src/db.js';
export const starterItems = [
  { id: 'outfit-midnight', name: 'Áo đêm xanh', slot: 'outfit', assetKey: 'midnight' },
  { id: 'outfit-rose', name: 'Áo hồng khói', slot: 'outfit', assetKey: 'rose' },
  { id: 'outfit-sage', name: 'Áo xanh lá', slot: 'outfit', assetKey: 'sage' },
  { id: 'outfit-cream', name: 'Áo kem', slot: 'outfit', assetKey: 'cream' },
  { id: 'accessory-glasses', name: 'Kính tròn', slot: 'accessory', assetKey: 'glasses' },
];
try {
  for (const item of starterItems)
    await db.item.upsert({ where: { id: item.id }, create: item, update: item });
  console.log('Đã chuẩn bị 5 vật phẩm khởi đầu.');
} finally {
  await db.$disconnect();
}
