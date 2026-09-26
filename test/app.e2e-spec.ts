import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as fs from 'fs';
import request from 'supertest';

// نضبط بيئة معزولة (SQLite خاص بالـ e2e) قبل تحميل AppModule/الكيانات.
process.env.DB_DRIVER = 'sqlite';
process.env.SQLITE_PATH = 'jawwak-e2e.sqlite';
process.env.NODE_ENV = 'test';
process.env.SEED_ON_BOOT = 'true';
process.env.QR_SECRET_KEY = 'e2e-secret-key-0123456789';
process.env.QR_HMAC_KEY = 'e2e-hmac-key-0123456789';

const P = '/api/v1';

describe('Jawwak API (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  // حالة مشتركة عبر الاختبارات.
  let vendorId: string;
  let bookingId: string;
  let qrCode: string;

  beforeAll(async () => {
    try {
      fs.unlinkSync('jawwak-e2e.sqlite');
    } catch {
      /* الملف غير موجود */
    }

    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
    http = request(app.getHttpServer());
  }, 60000);

  afterAll(async () => {
    await app?.close();
  });

  const data = (res: request.Response) => res.body.data;

  // ============ Health ============
  describe('Health', () => {
    it('GET /health → 200 ok', async () => {
      const res = await http.get(`${P}/health`).expect(200);
      expect(data(res).status).toBe('ok');
    });
  });

  // ============ Vendors ============
  describe('Vendors', () => {
    it('GET /vendors → قائمة غير فارغة (seed اشتغل)', async () => {
      const res = await http.get(`${P}/vendors?limit=50`).expect(200);
      expect(data(res).total).toBeGreaterThan(0);
      expect(Array.isArray(data(res).items)).toBe(true);
      vendorId = data(res).items[0].id;
      expect(vendorId).toBeDefined();
    });

    it('GET /vendors/:id → مزوّد كامل', async () => {
      const res = await http.get(`${P}/vendors/${vendorId}`).expect(200);
      const v = data(res);
      expect(v.id).toBe(vendorId);
      expect(v.businessNameAr).toBeTruthy();
      expect(typeof v.lat).toBe('number');
    });

    it('GET /vendors/nearby → مرتّبة تصاعدياً بالمسافة', async () => {
      const res = await http
        .get(`${P}/vendors/nearby?lat=24.7136&lng=46.6753&radiusKm=10`)
        .expect(200);
      const rows = data(res);
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBeGreaterThan(0);
      for (let i = 0; i < rows.length - 1; i++) {
        expect(rows[i].distanceM).toBeLessThanOrEqual(rows[i + 1].distanceM);
      }
    });
  });

  // ============ Mood Engine ============
  describe('Mood recommend', () => {
    it('يرجع sessionId و ≤3 نتائج مرتّبة تنازلياً بالسكور', async () => {
      const res = await http
        .post(`${P}/mood/recommend`)
        .send({
          companion: 'duo',
          mood: 'food',
          budgetMin: 50,
          budgetMax: 200,
          timeSlot: 'evening',
          userLat: 24.7136,
          userLng: 46.6753,
        })
        .expect(201);
      const d = data(res);
      expect(d.sessionId).toBeDefined();
      expect(d.results.length).toBeGreaterThan(0);
      expect(d.results.length).toBeLessThanOrEqual(3);
      for (const r of d.results) {
        expect(r.id).toBeDefined();
        expect(r.businessNameAr).toBeTruthy();
        expect(typeof r.avgRating).toBe('number');
        expect(typeof r.distanceKm).toBe('number');
        expect(r.distanceKm).toBeLessThanOrEqual(15);
      }
      for (let i = 0; i < d.results.length - 1; i++) {
        expect(d.results[i].score).toBeGreaterThanOrEqual(
          d.results[i + 1].score,
        );
      }
    });

    it('حالات حدّية للميزانية والمزاج', async () => {
      await http
        .post(`${P}/mood/recommend`)
        .send({
          companion: 'solo',
          mood: 'calm',
          budgetMin: 0,
          budgetMax: 50,
          timeSlot: 'morning',
          userLat: 24.7136,
          userLng: 46.6753,
        })
        .expect(201);
      await http
        .post(`${P}/mood/recommend`)
        .send({
          companion: 'family',
          mood: 'excitement',
          budgetMin: 300,
          budgetMax: 500,
          timeSlot: 'evening',
          userLat: 24.7136,
          userLng: 46.6753,
        })
        .expect(201);
    });

    it('موقع بعيد (الدمام) → نتائج فارغة', async () => {
      const res = await http
        .post(`${P}/mood/recommend`)
        .send({
          companion: 'duo',
          mood: 'food',
          budgetMin: 50,
          budgetMax: 200,
          timeSlot: 'evening',
          userLat: 26.4207,
          userLng: 50.0888,
        })
        .expect(201);
      expect(data(res).results.length).toBe(0);
    });

    it('يرفض مزاجاً غير صالح → 400', async () => {
      await http
        .post(`${P}/mood/recommend`)
        .send({
          companion: 'duo',
          mood: 'INVALID',
          budgetMin: 50,
          budgetMax: 200,
          timeSlot: 'evening',
          userLat: 24.7136,
          userLng: 46.6753,
        })
        .expect(400);
    });
  });

  // ============ Users (ينشئ مستخدم التطوير لتتراكم النقاط) ============
  describe('Users', () => {
    it('GET /users/me → بيانات المستخدم', async () => {
      const res = await http.get(`${P}/users/me`).expect(200);
      expect(data(res).id).toBeDefined();
    });

    it('PATCH /users/me → تحديث الاسم', async () => {
      const res = await http
        .patch(`${P}/users/me`)
        .send({ displayName: 'اسم جديد' })
        .expect(200);
      expect(data(res).displayName).toBe('اسم جديد');
    });

    it('GET /users/me/data-export → تصدير كامل (PDPL)', async () => {
      const res = await http.get(`${P}/users/me/data-export`).expect(200);
      expect(data(res).profile).toBeDefined();
    });
  });

  // ============ Bookings ============
  describe('Bookings', () => {
    it('POST /bookings (mada) → pending بلا QR (بانتظار الدفع)', async () => {
      const res = await http
        .post(`${P}/bookings`)
        .send({ vendorId, paymentMethod: 'mada', amount: 85 })
        .expect(201);
      const b = data(res);
      bookingId = b.id;
      expect(bookingId).toBeDefined();
      expect(b.status).toBe('pending');
      expect(b.qrCode).toBeFalsy();
    });

    it('POST /payments/dev-confirm → confirmed + qrCode', async () => {
      const res = await http
        .post(`${P}/payments/dev-confirm`)
        .send({ bookingId })
        .expect(201);
      const b = data(res).booking;
      qrCode = b.qrCode;
      expect(b.status).toBe('confirmed');
      expect(qrCode).toBeTruthy();
      expect(b.transactionId).toBeTruthy();
    });

    it('GET /bookings/:id → تفاصيل مع QR', async () => {
      const res = await http.get(`${P}/bookings/${bookingId}`).expect(200);
      expect(data(res).qrCode).toBe(qrCode);
    });

    it('POST /bookings/:id/verify-qr → used', async () => {
      const res = await http
        .post(`${P}/bookings/${bookingId}/verify-qr`)
        .send({ qrCode })
        .expect(201);
      expect(data(res).status).toBe('used');
    });

    it('POST verify-qr مرة ثانية → 400 (مستخدم مسبقاً)', async () => {
      await http
        .post(`${P}/bookings/${bookingId}/verify-qr`)
        .send({ qrCode })
        .expect(400);
    });

    it('PATCH /bookings/:id/cancel → cancelled (على حجز جديد)', async () => {
      const created = await http
        .post(`${P}/bookings`)
        .send({ vendorId, paymentMethod: 'apple_pay', amount: 120 })
        .expect(201);
      const res = await http
        .patch(`${P}/bookings/${data(created).id}/cancel`)
        .expect(200);
      expect(data(res).status).toBe('cancelled');
    });
  });

  // ============ Reviews ============
  describe('Reviews (التقييم المزدوج)', () => {
    let reviewId: string;
    let countBefore: number;

    it('GET /reviews/meta → محاور ووسوم حسب الفئة', async () => {
      const res = await http.get(`${P}/reviews/meta?category=cafe`).expect(200);
      const m = data(res);
      expect(m.aspects.map((a: { labelAr: string }) => a.labelAr)).toContain('القهوة');
      expect(m.tags).toContain('واي فاي سريع');
    });

    it('GET /reviews/vendor/:id/summary → متوسط وتوزيع ومحاور', async () => {
      const res = await http
        .get(`${P}/reviews/vendor/${vendorId}/summary`)
        .expect(200);
      const s = data(res);
      countBefore = s.userRating.count;
      expect(s.userRating.distribution).toBeDefined();
      expect(Array.isArray(s.aspects)).toBe(true);
    });

    it('POST /reviews (زيارة موثّقة) → 201 + 5 نقاط + تحديث المتوسطات', async () => {
      const res = await http
        .post(`${P}/reviews`)
        .send({ vendorId, bookingId, overallRating: 5, reviewText: 'ممتاز' })
        .expect(201);
      const r = data(res);
      reviewId = r.id;
      expect(r.isVerifiedVisit).toBe(true);
      expect(r.pointsAwarded).toBe(5);

      const s = data(
        await http.get(`${P}/reviews/vendor/${vendorId}/summary`).expect(200),
      );
      expect(s.userRating.count).toBe(countBefore + 1);
      const v = data(await http.get(`${P}/vendors/${vendorId}`).expect(200));
      expect(v.ratingCount).toBe(countBefore + 1);
      expect(v.avgUserRating).toBeCloseTo(Number(v.avgRating), 5);
    });

    it('يرفض تقييم نفس الحجز مرتين → 409', async () => {
      await http
        .post(`${P}/reviews`)
        .send({ vendorId, bookingId, overallRating: 4 })
        .expect(409);
    });

    it('يرفض تقييم حجز غير مُستخدم → 400', async () => {
      const created = await http
        .post(`${P}/bookings`)
        .send({ vendorId, paymentMethod: 'wallet', amount: 60 })
        .expect(201);
      await http
        .post(`${P}/reviews`)
        .send({ vendorId, bookingId: data(created).id, overallRating: 4 })
        .expect(400);
    });

    it('GET /reviews/vendor/:id → تقييمات بأسماء مختصرة + حقل تقييم جوّك', async () => {
      const res = await http
        .get(`${P}/reviews/vendor/${vendorId}?sort=recent&limit=5`)
        .expect(200);
      const d = data(res);
      expect(d.userReviews.length).toBeGreaterThan(0);
      expect(d.userReviews[0].userName).toBeTruthy();
      expect('jawwakReview' in d).toBe(true);
    });

    it('"مفيد" على تقييمي → 400', async () => {
      await http.post(`${P}/reviews/${reviewId}/helpful`).expect(400);
    });

    it('المسار القديم GET /vendors/:id/reviews يبقى متوافقاً (rating/comment)', async () => {
      const res = await http.get(`${P}/vendors/${vendorId}/reviews`).expect(200);
      const first = data(res).items[0];
      expect(first.rating).toBeDefined();
      expect('comment' in first).toBe(true);
    });

    it('تقييم جوّك الرسمي: إنشاء (مشرف تطوير) ثم يظهر في الملخّص ثم تحديث', async () => {
      const list = data(await http.get(`${P}/vendors?limit=50`).expect(200)).items;
      const target = list.find((v: { hasJawwakReview: boolean }) => !v.hasJawwakReview);
      expect(target).toBeDefined();

      await http
        .post(`${P}/reviews/jawwak`)
        .send({
          vendorId: target.id,
          reviewerName: 'فريق جوّك',
          visitDate: '2026-09-20',
          overallScore: 4.5,
          qualityScore: 9,
          serviceScore: 8.5,
          cleanlinessScore: 9,
          valueScore: 8,
          ambienceScore: 8.5,
          summary: 'تجربة متوازنة',
          detailedReview: 'تفاصيل الزيارة',
          badges: ['✓ موثّق جوّك'],
        })
        .expect(201);

      const s = data(
        await http.get(`${P}/reviews/vendor/${target.id}/summary`).expect(200),
      );
      expect(s.jawwakRating.score).toBeCloseTo(4.5);
      expect(s.badges).toContain('✓ موثّق جوّك');

      await http
        .patch(`${P}/reviews/jawwak/${target.id}`)
        .send({ summary: 'ملخّص محدّث' })
        .expect(200);

      // تقييم رسمي ثانٍ لنفس المكان مرفوض.
      await http
        .post(`${P}/reviews/jawwak`)
        .send({
          vendorId: target.id, reviewerName: 'x', visitDate: '2026-09-20',
          overallScore: 4, qualityScore: 8, serviceScore: 8, cleanlinessScore: 8,
          valueScore: 8, ambienceScore: 8, summary: 's', detailedReview: 'd',
        })
        .expect(409);
    });

    it('يرفض شارة غير معتمدة → 400', async () => {
      await http
        .patch(`${P}/reviews/jawwak/${vendorId}`)
        .send({ badges: ['شارة مختلقة'] })
        .expect(400);
    });
  });

  // ============ Rewards ============
  describe('Rewards', () => {
    it('GET /rewards/me → نقاط متراكمة من الحجوزات والتقييم', async () => {
      const res = await http.get(`${P}/rewards/me`).expect(200);
      const d = data(res);
      expect(d.points).toBeGreaterThanOrEqual(15);
      const reasons = d.ledger.map((l: { reason: string }) => l.reason);
      expect(reasons).toContain('booking');
      expect(reasons).toContain('review');
    });
  });

  // ============ Offers ============
  describe('Offers', () => {
    let offerId: string;
    it('POST /offers → إنشاء', async () => {
      const res = await http
        .post(`${P}/offers`)
        .send({
          vendorId,
          title: 'خصم اختبار',
          discountPct: 20,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
        })
        .expect(201);
      offerId = data(res).id;
      expect(data(res).isActive).toBe(true);
    });

    it('PATCH /offers/:id → إيقاف، ثم DELETE', async () => {
      const upd = await http
        .patch(`${P}/offers/${offerId}`)
        .send({ isActive: false })
        .expect(200);
      expect(data(upd).isActive).toBe(false);
      await http.delete(`${P}/offers/${offerId}`).expect(200);
    });
  });

  // ============ الأمان والتحقق ============
  describe('Security & validation', () => {
    it('حقن SQL في حقل نصي رقمي → 400 validation', async () => {
      const payload = encodeURIComponent("'; DROP TABLE vendors; --");
      await http
        .get(`${P}/vendors/nearby?lat=${payload}&lng=46.6`)
        .expect(400);
    });

    it('حقن SQL في اسم المزوّد يُخزَّن بأمان والجدول سليم', async () => {
      await http
        .post(`${P}/vendors`)
        .send({
          businessNameAr: "'; DROP TABLE vendors; --",
          businessNameEn: 'Injection Test',
          category: 'cafe',
          lat: 24.7,
          lng: 46.6,
          addressText: 'الرياض',
          priceRange: 'mid',
          moodTags: ['calm'],
          companionTags: ['solo'],
        })
        .expect(201);
      // الجدول لا يزال موجوداً ويعمل.
      const res = await http.get(`${P}/vendors?limit=1`).expect(200);
      expect(data(res).total).toBeGreaterThan(0);
    });

    it('يرفض حقلاً غير معرّف (forbidNonWhitelisted) → 400', async () => {
      await http
        .post(`${P}/offers`)
        .send({
          vendorId,
          title: 'x',
          discountPct: 10,
          startDate: '2026-01-01',
          endDate: '2026-02-01',
          hackerField: 'evil',
        })
        .expect(400);
    });
  });
});
