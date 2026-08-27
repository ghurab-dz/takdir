# تقدير (Takdir)

تطبيق ويب لمقاولي التشطيبات في الجزائر: ارفع صور الغرفة + وصف قصير، فيستخرج الذكاء الاصطناعي بنود العمل وكمياتها ويطابقها مع **قائمة أسعارك الخاصة** — عرض سعر جاهز خلال دقائق، قابل للطباعة والإرسال عبر واتساب.

> المنتج الكامل موصوف في [PRD.md](./PRD.md).

## المكدس التقني

- **Next.js (App Router)** + TypeScript + Tailwind CSS — واجهة عربية RTL
- **PostgreSQL** (Neon مجاني) + **Prisma ORM**
- **Google Gemini API** (مجاني) عبر طبقة adapter في `src/lib/ai/` — بدون مفتاح، يعمل التطبيق بوضع محاكاة للتجربة
- عرض السعر: صفحة طباعة + مشاركة واتساب (wa.me)

## التشغيل محليًا

1. أنشئ قاعدة بيانات PostgreSQL مجانية على [neon.tech](https://neon.tech) وانسخ رابط الاتصال.
2. انسخ `.env.example` إلى `.env` وعبّئ:
   - `DATABASE_URL` — رابط Neon
   - `GEMINI_API_KEY` — مجاني من [aistudio.google.com](https://aistudio.google.com) (اختياري للتجربة)
3. ثبّت الحزم وجهّز القاعدة:

```bash
npm install
npm run db:push      # ينشئ الجداول في قاعدة البيانات
npm run dev
```

افتح http://localhost:3000 — سيُنشأ حساب مقاول افتراضي مع قائمة أسعار أولية عند أول تشغيل. عدّلها من صفحة «قائمة الأسعار» قبل أي تقدير حقيقي.

## أوامر مفيدة

| الأمر | الوظيفة |
|---|---|
| `npm run dev` | خادم التطوير |
| `npm run build` | بناء الإنتاج |
| `npm test` | اختبارات الوحدة (محرك المطابقة، التنسيق، واتساب، البرومبت) |
| `npm run typecheck` | فحص TypeScript |
| `npm run db:push` | مزامنة مخطط Prisma مع القاعدة |

## بنية الكود

```
src/
├── app/                  # الصفحات (RTL)
│   ├── page.tsx          # لوحة التقديرات
│   ├── prices/           # إدارة قائمة الأسعار + معلومات المقاول
│   └── estimates/
│       ├── new/          # رفع الصور + الوصف
│       └── [id]/         # شاشة المراجعة
│           └── quote/    # عرض السعر القابل للطباعة + واتساب
├── actions/              # Server Actions (CRUD + خط أنابيب الاستخراج)
├── components/           # مكونات الواجهة
└── lib/
    ├── ai/               # طبقة المزوّد: types + prompt + gemini + mock
    ├── matching.ts       # محرك مطابقة البنود مع قائمة الأسعار
    ├── seed.ts           # قائمة الأسعار الافتراضية + المقاول الافتراضي
    ├── format.ts         # تنسيق المبالغ بالدينار
    └── whatsapp.ts       # نص العرض ورابط wa.me
```

## النشر (Render — مجاني)

1. ارفع المستودع إلى GitHub.
2. في Render: **New → Web Service** من المستودع، بيئة Node.
   - Build: `npm install && npm run db:generate && npm run build`
   - Start: `npm start`
3. أضف متغيري البيئة `DATABASE_URL` (نفس قاعدة Neon) و`GEMINI_API_KEY`.
4. نفّذ `npm run db:push` محليًا مرة واحدة لإنشاء الجداول (أو من Render Shell).
