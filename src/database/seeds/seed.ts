import 'dotenv/config';

import { resolveDbDriver } from '../../config/db-driver';

/// سكربت زرع البيانات: 20 مكاناً في الرياض. يعمل على Postgres و SQLite.
///
/// - npm run seed        (تطوير، مع --force): يفرّغ الجدول ويعيد الزرع.
/// - npm run seed:prod   (إنتاج، بلا --force): يطبّق الـ migrations ثم يزرع
///   فقط إن كان جدول المزوّدين فارغاً — لا يحذف بيانات حقيقية أبداً.
async function run(): Promise<void> {
  const force = process.argv.includes('--force');
  // نحسم السائق قبل استيراد مصدر البيانات (الذي يستورد الكيانات).
  const driver = await resolveDbDriver();
  // eslint-disable-next-line no-console
  console.log(`🌱 بدء الزرع (السائق: ${driver})...`);

  const { AppDataSource } = await import('../data-source');
  const { Vendor } = await import('../../modules/vendors/entities/vendor.entity');
  const { SEED_OWNER_ID, VENDOR_SEEDS } = await import('./vendors.seed');

  const ds = await AppDataSource.initialize();
  // Postgres: المخطط تبنيه الـ migrations (SQLite ينشئه synchronize).
  if (driver === 'postgres') await ds.runMigrations();
  const repo = ds.getRepository(Vendor);

  const existing = await repo.count();
  if (existing > 0 && !force) {
    // eslint-disable-next-line no-console
    console.log(
      `ℹ️  يوجد ${existing} مزوّد بالفعل — تخطّي الزرع (استخدم --force لإعادة الزرع).`,
    );
    await ds.destroy();
    return;
  }

  // إفراغ الجدول لجعل الزرع قابلاً للتكرار (مع --force فقط إن لم يكن فارغاً).
  if (existing > 0) await repo.clear();

  for (const v of VENDOR_SEEDS) {
    await repo.save(
      repo.create({
        ownerUserId: SEED_OWNER_ID,
        businessNameAr: v.businessNameAr,
        businessNameEn: v.businessNameEn,
        category: v.category,
        lat: v.lat,
        lng: v.lng,
        addressText: v.addressText,
        priceRange: v.priceRange,
        moodTags: v.moodTags,
        companionTags: v.companionTags,
        verified: v.verified,
        operatingHours: v.operatingHours,
        images: v.images,
        isActive: true,
      }),
    );
  }

  // eslint-disable-next-line no-console
  console.log(`✅ تم زرع ${VENDOR_SEEDS.length} مزوّداً بنجاح.`);
  await ds.destroy();
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('❌ فشل الزرع:', err);
  process.exit(1);
});
