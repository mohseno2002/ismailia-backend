# النشر عبر GitHub + Cloudflare (بدون Termux)

موبايلك ما يقدرش يشغّل `wrangler` (مكتبة workerd مش مبنية لمعمارية Android). الحل: ترفع الكود على GitHub، وCloudflare تبني وتنشر بنفسها على سيرفراتها. الموبايل بس يرفع.

## الخطوات

### 1) ارفع المشروع على GitHub
من تطبيق GitHub على الموبايل أو من المتصفح:
- اعمل repository جديد باسم `ismailia-backend` — اختَر **Public**.
- ارفع كل ملفات المشروع دي (فك الـ zip ورفعها):
  `src/`، `migrations/`، `wrangler.jsonc`، `package.json`، `README.md`، `.gitignore`، `schema/`

> أسهل طريقة من الموبايل: افتح الـ repo الجديد في المتصفح → زر **Add file → Upload files** → ارفع الملفات (تقدر تسحب المجلدات).

### 2) انشر على Cloudflare
- ادخل **dash.cloudflare.com** وسجّل دخول (أو أنشئ حساب مجاني).
- من القائمة: **Workers & Pages → Create → Workers → Import a repository** (أو الصق رابط الـ repo مباشرة).
- اختَر الـ repo `ismailia-backend`.
- Cloudflare هتقرا `wrangler.jsonc` وتلاقي إعداد قاعدة D1 — هتسألك تنشئ قاعدة باسم `ismailia-db`. **وافِق.**
- اضغط **Deploy**.

### 3) طبّق الجداول والبيانات
بعد أول نشر، القاعدة هتكون فاضية. طبّق ملف الإنشاء:
- في لوحة Cloudflare: **Workers & Pages → D1 → ismailia-db → Console**.
- افتح ملف `migrations/0001_init.sql` من الـ repo، انسخ محتواه كله، والصقه في الـ Console، واضغط **Execute**.

> الملف آمن للتشغيل أكثر من مرة (لا يكرر البيانات ولا يمسحها).

### 4) خلاص
هيطلع لك رابط شكله:
`https://ismailia-backend.<حسابك>.workers.dev`

افتحه — النموذج شغّال. أي تعديل تدفعه (push) للـ repo، Cloudflare تعيد النشر تلقائيًا.

---

## ملاحظة عن النسخة المحلية
لو في المستقبل عايز تشغّله محليًا على كمبيوتر (مش موبايل): `npm install` ثم `npx wrangler dev`. ده يحتاج جهاز x86/Mac عادي — مش Termux.
