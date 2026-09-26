/// محاور التقييم الفرعية (تُخزَّن في أعمدة user_reviews المقابلة).
export type RatingAspect = 'food' | 'service' | 'ambience' | 'value' | 'experience';

export interface AspectDef {
  key: RatingAspect;
  labelAr: string;
}

/// المحاور حسب فئة المكان — العنوان يتغيّر حسب السياق (قهوة/سرعة/تنظيم…).
export const REVIEW_ASPECTS: Record<string, AspectDef[]> = {
  restaurant: [
    { key: 'food', labelAr: 'الطعام' },
    { key: 'service', labelAr: 'الخدمة' },
    { key: 'ambience', labelAr: 'الأجواء' },
    { key: 'value', labelAr: 'القيمة' },
  ],
  cafe: [
    { key: 'food', labelAr: 'القهوة' },
    { key: 'ambience', labelAr: 'الأجواء' },
    { key: 'service', labelAr: 'الخدمة' },
    { key: 'value', labelAr: 'القيمة' },
  ],
  food_truck: [
    { key: 'food', labelAr: 'الطعام' },
    { key: 'service', labelAr: 'السرعة' },
    { key: 'value', labelAr: 'القيمة' },
  ],
  activity: [
    { key: 'experience', labelAr: 'التجربة' },
    { key: 'service', labelAr: 'التنظيم' },
    { key: 'value', labelAr: 'القيمة' },
  ],
};
REVIEW_ASPECTS.event = REVIEW_ASPECTS.activity;

/// وسوم التجربة المسموحة حسب الفئة.
export const REVIEW_TAGS: Record<string, string[]> = {
  restaurant: [
    'وجبة ممتازة', 'كميات وفيرة', 'طازج ولذيذ',
    'خدمة سريعة', 'موظفون محترمون', 'نظافة ممتازة',
    'أجواء هادئة', 'مناسب للعائلات', 'قيمة ممتازة',
  ],
  cafe: [
    'قهوة ممتازة', 'حلويات رائعة', 'واي فاي سريع',
    'مريح للعمل', 'أجواء دافئة', 'موسيقى هادئة',
    'كراسي مريحة', 'منطقة خارجية', 'لا ضوضاء',
  ],
  food_truck: [
    'سريع التحضير', 'طازج ومميز', 'أسعار معقولة',
    'موقع سهل', 'تنوع في القائمة', 'لا انتظار طويل',
  ],
  activity: [
    'تجربة ممتعة', 'ينصح به للعائلات', 'مناسب للشباب',
    'تنظيم ممتاز', 'موظفون ودودون', 'يستحق السعر',
    'سيُكرّر', 'مثالي للأصدقاء',
  ],
};
REVIEW_TAGS.event = REVIEW_TAGS.activity;

/// شارات فريق جوّك المعتمدة.
export const JAWWAK_BADGES = [
  '✓ موثّق جوّك',
  '⚡ خدمة سريعة',
  '♻ نظافة ممتازة',
  '👨‍👩‍👧 مناسب للعائلات',
  '💰 قيمة ممتازة',
  '🔥 مميّز',
];

/// لا يُسمح بأكثر من تقييم لنفس المكان خلال هذه المدة.
export const REVIEW_COOLDOWN_DAYS = 30;

/// نقاط كتابة تقييم.
export const REVIEW_POINTS = 5;
