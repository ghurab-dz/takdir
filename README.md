# تقدير (Takdir)

تطبيق ويب لمقاولي التشطيبات في الجزائر — صوّر الغرفة، احكِ وش حاب تدير (صوت/نص)، واحصل على **تصميم واحد مُلهم + سعر واحد** خلال دقائق، مع عرض سعر قابل للطباعة والإرسال عبر واتساب. الأسعار من **قائمتك الخاصة فقط** — الذكاء الاصطناعي لا يخترع أسعارًا.

## كيف يعمل

```
صور 1-4 (معرض + كاميرا) + وصف صوتي/نصي "احكي وش حاب تدير..."
     ↓  (الكتالوج مُحمّل مسبقاً — لا نماذج قبل البدء)
extract + generate 1 option (full catalog pool — أي مادة متاحة) + matchTiered
     ↓
تصميم hero واحد (بورسلان/دهان/جبس/إنارة — تغيير جذري واضح 15-30ث) + جدول سعر + طباعة + واتساب
```

* الكتالوج: **58 بند × 3 درجات = 174 خامة** جاهزة (دهان/بلاط/جبس/كهرباء/سباكة/نجارة/أرضيات/ديكور/عام) — 4 قوالب سريعة (شامل/دهان وبلاط/دهان+بلاط+جبس/حمام ومطبخ) + تعديل حر في **/prices** و **/materials**.
* السعر يُحسب من كتالوجك فقط — الذكاء يختار المواد التي تطابق صورك + وصفك.
* الصورة تُولّد بعد تثبيت العرض لضمان الصورة = السعر المدقق؛ عند تعديل البنود يُكشف التعارض عبر `proofHash`.

## المكدس التقني

- **Next.js 16 (App Router)** + React 19 + TypeScript + Tailwind 4 — واجهة عربية RTL
- **PostgreSQL (Neon)** + **Prisma 6** — اتصال مجمّع `DATABASE_URL` و مباشر `DATABASE_URL_UNPOOLED`
- **AI عبر OpenRouter فقط** `src/lib/ai/` (لا وضع محاكاة):
  - التقدير (صور+نص → JSON): **minimax/minimax-m3:free** مجاني (رؤية+JSON، عربي) — قابل للتبديل عبر `OPENROUTER_MODEL`
  - الصور (تحويل جذري للغرفة): **google/gemini-2.5-flash-image** عبر `OPENROUTER_IMAGE_MODEL` — نفس مفتاح OpenRouter، temp 0.9 + توجيه لوني صريح
  - يتطلب `OPENROUTER_API_KEY=sk-or-v1-...`
- عرض السعر: صفحة طباعة + `wa.me`

## التشغيل محليًا

1. Neon على [neon.tech](https://neon.tech) → رابطي Pooled + Direct.
2. مفتاح OpenRouter من [openrouter.ai/keys](https://openrouter.ai/keys).
3. انسخ `.env.example` إلى `.env` وعبّئ:

   ```
   DATABASE_URL=postgresql://...?sslmode=require
   DATABASE_URL_UNPOOLED=postgresql://...?sslmode=require
   OPENROUTER_API_KEY=sk-or-v1-...
   # OPENROUTER_MODEL=minimax/minimax-m3:free
   # OPENROUTER_IMAGE_MODEL=google/gemini-2.5-flash-image
   ```

4. ثبّت وشغّل:

```bash
npm install
npm run db:push
npm run dev
```

افتح http://localhost:3000 — يُنشأ مقاول افتراضي مع **58 بند (174 خامة)** عند أول تشغيل. اختر قالبًا من **قائمة الأسعار** أو عدّل الأسعار مباشرة قبل أول تصميم.

## أوامر مفيدة

| الأمر | الوظيفة |
|---|---|
| `npm run dev` | خادم التطوير |
| `npm run build` | بناء الإنتاج |
| `npm run lint` | ESLint |
| `npm run typecheck` | فحص TypeScript |
| `npm test` | Vitest |
| `npm run db:generate` | توليد Prisma Client |
| `npm run db:push` | مزامنة المخطط |

## بنية الكود

```
src/
├── app/
│   ├── page.tsx                 # لوحة الاستشارات
│   ├── prices/page.tsx          # قائمة الأسعار + قوالب
│   ├── materials/page.tsx       # كتالوج المواد ×3 درجات
│   └── estimates/
│       ├── new/page.tsx         # صور + وصف صوتي → تصميم وسعر
│       └── [id]/...             # مراجعة + توليد صورة hero + عرض سعر
├── actions/  estimates, renders, prices, materials, catalog
├── components/  consultation-wizard, option-compare, catalog-templates, ...
└── lib/
    ├── ai/  openrouter (minimax free + gemini image), render-prompt, options-prompt
    ├── catalog-templates.ts  4 قوالب جاهزة
    ├── seed.ts               58 بند × 174 خامة — ترقية تلقائية للكتالوج القديم
    └── matching / format / whatsapp
prisma/schema.prisma
```
