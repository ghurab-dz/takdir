// Catalog templates — ready-to-use packs for Algerian finishing contractors.
// Each template is a subset of the master catalog. MVP default = "الكتالوج الشامل" (58 بند).
// Templates allow entrepreneur to start with relevant pack then edit prices freely.

export type TemplateId = "starter" | "full" | "bath_kitchen" | "paint_floor";

export interface TemplateDef {
  id: TemplateId;
  icon: string;
  title: string;
  subtitle: string;
  count: number;
  categories: string[];
  priceItemNames: string[]; // itemName keys — filters master list
}

// Master itemNames list — must match DEFAULT_PRICE_ITEMS itemName exactly
const ALL_NAMES = [
  // دهان 8
  "دهان جدران فينيل مطفي",
  "دهان جدران ساتان قابل للغسل",
  "دهان سقف أبيض مطفي مضاد للرطوبة",
  "معجون وتهيئة جدران + صنفرة",
  "دهان خارجي أكريليك مقاوم",
  "ورق جدران / بديل رخام PVC",
  "دهان باب ونجارة لاك",
  "كورنيش جبس + دهان",
  // بلاط 8
  "بلاط أرضية سيراميك 30×30",
  "بورسلان أرضية 60×60",
  "رخام أرضية 80×80 لامع",
  "فايونس مطبخ 30×60",
  "فايونس حمام مزخرف",
  "بورسلان حائط لامع",
  "عتبة رخام",
  "بانوار / بلينت سيراميك",
  // جبس 6
  "سقف بلاكو بلاتر بسيط",
  "سقف بلاكو مع إضاءة مخفية LED",
  "حائط فاصل بلاكو",
  "كورنيش جبس كلاسيك",
  "رفوف / نيچ جبس",
  "عازل صوت وحرارة للسقف",
  // كهرباء 8
  "نقطة كهرباء تمديد + علبة",
  "سبوت LED غاطس 7W",
  "ثريا سقف مودرن",
  "شريط LED مخفي",
  "لوحة كهرباء 12 خط",
  "مأخذ USB / قاطع ذكي",
  "مروحة سقف",
  "إنترفون فيديو",
  // سباكة 7
  "نقطة سباكة ماء بارد/ساخن",
  "مرحاض معلق",
  "حوض غسيل مع خلاط",
  "دش مطري مع خلاط",
  "بانيو أكريليك",
  "سخان ماء 80 لتر",
  "تصريف أرضية + سيفون",
  // نجارة وألمنيوم 7
  "باب داخلي MDF مع إطار",
  "باب ألمنيوم زجاجي",
  "خزانة حائط كولوار",
  "مطبخ MDF علوي وسفلي",
  "مطبخ ألمنيوم",
  "شباك PVC مزدوج زجاج",
  "درابزين حديد / إينوكس",
  // أرضيات 4
  "باركيه HDF خشبي",
  "باركيه PVC",
  "موكيت أرضي",
  "أرضية إيبوكسي 3D",
  // ديكور 5
  "بديل خشب WPC للجدران",
  "بديل رخام PVC لامع",
  "حجر ديكوري داخلي",
  "مرآة حائط كبيرة",
  "ستائر بلاك أوت مع سكة",
  // عام 5
  "هدم وتفكيك أرضية قديمة",
  "هدم حائط + إزالة",
  "نقل مخلفات شاحنة",
  "تنظيف نهائي شقة",
  "عزل مائي للحمام",
];

export const CATALOG_TEMPLATES: TemplateDef[] = [
  {
    id: "full",
    icon: "🏠",
    title: "الكتالوج الشامل",
    subtitle: "كل التشطيبات — 58 بند جاهز",
    count: 58,
    categories: ["دهان", "بلاط", "جبس", "كهرباء", "سباكة", "نجارة", "أرضيات", "ديكور", "عام"],
    priceItemNames: [...ALL_NAMES],
  },
  {
    id: "starter",
    icon: "🎨",
    title: "دهان وبلاط فقط",
    subtitle: "للمقاول المتخصص — 16 بند",
    count: 16,
    categories: ["دهان", "بلاط"],
    priceItemNames: ALL_NAMES.slice(0, 16),
  },
  {
    id: "paint_floor",
    icon: "🧱",
    title: "دهان + بلاط + جبس",
    subtitle: "الأكثر طلبًا — 22 بند",
    count: 22,
    categories: ["دهان", "بلاط", "جبس"],
    priceItemNames: ALL_NAMES.slice(0, 22),
  },
  {
    id: "bath_kitchen",
    icon: "🚿",
    title: "حمام ومطبخ",
    subtitle: "سباكة + فايونس + مطبخ — 15 بند",
    count: 15,
    categories: ["بلاط", "سباكة", "نجارة"],
    priceItemNames: [
      "فايونس مطبخ 30×60",
      "فايونس حمام مزخرف",
      "بورسلان حائط لامع",
      "عتبة رخام",
      "نقطة سباكة ماء بارد/ساخن",
      "مرحاض معلق",
      "حوض غسيل مع خلاط",
      "دش مطري مع خلاط",
      "بانيو أكريليك",
      "سخان ماء 80 لتر",
      "تصريف أرضية + سيفون",
      "مطبخ MDF علوي وسفلي",
      "مطبخ ألمنيوم",
      "عزل مائي للحمام",
      "مرآة حائط كبيرة",
    ],
  },
];

export function getTemplateById(id: string): TemplateDef | undefined {
  return CATALOG_TEMPLATES.find((t) => t.id === id);
}
