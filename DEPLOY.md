# نشر جوّك — Supabase + Railway + Vercel

الكود جاهز ومُختبَر محلياً على Postgres حقيقي (migration + تشغيل الإنتاج + seed).
هذه الخطوات اليدوية المتبقية، **بالترتيب**، مع تصحيحات لدليل النشر الأصلي.

## 0) المتطلّبات
- ارفع المشاريع إلى GitHub (ليست مستودعات git بعد): `jawwak-api` و `jawwak-vendor-portal`.
- `.gitignore` يستثني `.env` و `firebase-service-account.json` و `*.sqlite` — تحقّق قبل أول push.

## 1) Supabase (قاعدة البيانات)
1. New Project → اختر أقرب منطقة متاحة للرياض.
2. **لا حاجة لتفعيل PostGIS أو uuid-ossp**: المخطط يستخدم `lat/lng` عادية
   و `gen_random_uuid()` المدمجة في Postgres 13+.
3. من **Connect → Session pooler** انسخ الرابط (يعمل عبر IPv4):
   `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`
   > الرابط المباشر `db.<ref>.supabase.co` قد يكون IPv6 فقط وقد يفشل الاتصال من Railway.

## 2) Firebase Admin — **إلزامي للإنتاج**
بدونه ترفض كل المسارات المحمية (المزاج، الحجز، النقاط) بـ `401 خدمة المصادقة غير متاحة`.
Firebase Console → Project settings → Service accounts → Generate new private key،
ثم انسخ `project_id` و `client_email` و `private_key` إلى متغيّرات Railway.

## 3) Railway (الـ Backend)
1. New Project → **Empty project** → Add Service → **Empty service** باسم `jawwak-api`.
   (لا تربطه بالمستودع للنشر التلقائي — النشر يتم من GitHub Actions بعد نجاح الاختبارات؛
   الربط الثنائي يسبّب نشراً مزدوجاً.)
2. Add Service → Database → **Redis**.
3. Variables للخدمة `jawwak-api`:

| المتغيّر | القيمة |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | رابط Session pooler من Supabase |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` (مرجع Railway) |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | من ملف الخدمة |
| `QR_SECRET_KEY` / `QR_HMAC_KEY` | قيمتان عشوائيتان مختلفتان (انظر أدناه) |
| `CORS_ORIGINS` | رابط لوحة Vercel (مثل `https://jawwak-vendor-portal.vercel.app`) |
| `HYPERPAY_*` | اختياري |

   توليد قيمة عشوائية: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   > `JWT_SECRET` و `DB_DRIVER` من الدليل الأصلي **غير لازمين**: المصادقة عبر Firebase،
   > و `DATABASE_URL` يفرض Postgres تلقائياً. لا تضبط `PORT` (Railway يحقنه).
4. Settings → Networking → **Generate Domain** — هذا رابط الـ API.
5. Project Settings → Tokens → أنشئ **Project Token**.

## 4) GitHub Actions (jawwak-api)
في المستودع → Settings → Secrets and variables → Actions:
- Secret `RAILWAY_TOKEN` = الـ Project Token.
- Variable `RAILWAY_SERVICE` = `jawwak-api` (اختياري إن كان هذا اسمها).

كل push إلى `main`: typecheck + unit + e2e + build ← ثم النشر. طلبات الدمج تُختبر فقط.
الـ migrations تُطبَّق تلقائياً عند إقلاع الخادم.

## 5) زرع البيانات الأولية (مرة واحدة)
```bash
npm run build
railway link            # اختر المشروع وخدمة jawwak-api
railway run npm run seed:prod
```
آمن للتكرار: يزرع 20 مكاناً فقط إن كان الجدول فارغاً، ولا يحذف بيانات موجودة أبداً.

## 6) Vercel (لوحة المزوّدين)
Add New Project → `jawwak-vendor-portal` → Environment Variables:
- `NEXT_PUBLIC_API_URL` = `https://<رابط-railway>/api/v1` (**إلزامي** — البناء يفشل بدونه عمداً).
> متغيّرات `NEXT_PUBLIC_FIREBASE_*` من الدليل الأصلي غير مستخدمة في اللوحة حالياً.

بعد النشر أضف رابط Vercel إلى `CORS_ORIGINS` في Railway.

## 7) تطبيق Flutter
عدّل `productionUrl` في `lib/core/constants/api_constants.dart` لرابط Railway الفعلي، أو مرّره وقت البناء:
```bash
flutter build apk --release --dart-define=API_BASE_URL=https://<رابط-railway>/api/v1
```
بناء release لا يستخدم البيانات الوهمية عند فشل الـ API (تجنّباً لحجوزات وهمية).

## 8) التحقّق
```bash
curl https://<رابط-railway>/api/v1/health      # (ليس /health)
curl https://<رابط-railway>/api/v1/vendors
```
مسارات المزاج والحجز تتطلّب `Authorization: Bearer <Firebase ID token>` في الإنتاج.
