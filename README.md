# جوّك API (Jawwak) — NestJS Backend 🧭

Backend لتطبيق **جوّك** — توصية أماكن ونشاطات في الرياض بناءً على المزاج.
مبني على **NestJS + PostgreSQL (PostGIS) + Redis + TypeORM + Firebase Admin**.

---

## ⚙️ المتطلبات
- Node.js 20+
- Docker Desktop (لـ PostgreSQL + Redis)

## 🚀 التشغيل

```bash
# 1) شغّل قاعدة البيانات و Redis
docker-compose up -d

# 2) ثبّت الحزم
npm install

# 3) هيّئ ملف البيئة (نسخة تطوير جاهزة موجودة في .env)
cp .env.example .env   # اختياري — .env جاهز مسبقاً

# 4) شغّل الهجرة (تبني الجداول + PostGIS + الفهارس)
npm run migration:run

# 5) ازرع 20 مكاناً في الرياض
npm run seed

# 6) شغّل السيرفر
npm run start:dev
```

- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/api/docs`

## 🔎 اختبار سريع

```bash
curl http://localhost:3000/api/v1/health
```

```bash
curl -X POST http://localhost:3000/api/v1/mood/recommend \
  -H "Content-Type: application/json" \
  -d '{"companion":"duo","mood":"food","budgetMin":50,"budgetMax":200,"timeSlot":"evening","userLat":24.7136,"userLng":46.6753}'
```

> في بيئة التطوير: إذا كانت متغيّرات Firebase فارغة، **يُعطّل التحقق من التوكن**
> ويُحقن "مستخدم تطوير" تلقائياً — فتعمل كل المسارات المحمية بدون auth.

## 🧠 محرك المزاج

`POST /mood/recommend` — الخطوات:
1. مفتاح كاش `mood:{mood}:{companion}:{geohash6}` في Redis.
2. عند الغياب: استعلام PostGIS `ST_DWithin` ضمن 15 كم + `ST_Distance`.
3. معادلة التسجيل:
   `S = 0.35×mood + 0.25×companion + 0.20×budget + 0.10×distance + 0.10×rating`
4. ترتيب واختيار أعلى 3، تخزين في Redis (TTL 15 دقيقة).
5. إنشاء `MoodSession` وإرجاع `{ sessionId, results }`.

## 🗄️ الجداول
`users` · `vendors` (PostGIS geography) · `mood_sessions` · `bookings` · `reviews` · `points_ledger`

## 🔐 الأمان
- `helmet` + `compression`
- Rate limiting: 100/دقيقة عام، **20/دقيقة** على `/mood/recommend`
- CORS لنطاقات محدّدة (`CORS_ORIGINS`)
- Firebase Auth Guard على كل المسارات عدا `@Public()` (`/health`, `/auth/verify-token`, قراءة المزوّدين)
- تحقّق مدخلات بـ class-validator (رسائل عربية) + استعلامات معاملية (parameterized)

## 🧪 الاختبارات

```bash
npm test
```

تغطّي: `MoodService` (التسجيل/الترتيب/الكاش) · `BookingsService` (QR/النقاط/الإلغاء) · `VendorsService`.

## 📦 أوامر مفيدة
| الأمر | الوظيفة |
|------|---------|
| `npm run start:dev` | تشغيل مع إعادة التحميل |
| `npm run migration:run` | تنفيذ الهجرات |
| `npm run migration:revert` | التراجع عن آخر هجرة |
| `npm run seed` | زرع بيانات المزوّدين |
| `npm test` | اختبارات الوحدة |
| `npm run build` | بناء للإنتاج |

## 🔥 Firebase (اختياري للإنتاج)
املأ في `.env`:
```
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```
عندها يتم تفعيل التحقق الحقيقي من Firebase ID tokens وإشعارات FCM.
