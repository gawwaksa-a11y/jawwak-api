/// بيانات تقييمات تجريبية — **للتطوير فقط** (SeederService عند NODE_ENV≠production).
///
/// لا تُستخدم في seed:prod أبداً: نشر تقييمات مختلقة لأماكن حقيقية في الإنتاج
/// مضلّل للمستخدمين. في الإنتاج تبدأ التقييمات من الصفر وتقييمات جوّك من زيارات فعلية.

import { REVIEW_ASPECTS, REVIEW_TAGS } from '../../modules/reviews/review.constants';

/// مولّد أرقام شبه عشوائية ثابت البذرة (mulberry32) — نفس البيانات في كل تشغيل.
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/// مستخدمون تجريبيون (أسماء عامة شائعة — ليسوا أشخاصاً حقيقيين).
export const DEMO_REVIEWERS = [
  'سارة العتيبي', 'محمد القحطاني', 'نورة الشمري', 'عبدالله الدوسري',
  'ريم الحربي', 'فهد المطيري', 'لمى الزهراني', 'خالد الغامدي',
  'هيا السبيعي', 'تركي العنزي', 'جود الشهري', 'ياسر البقمي',
  'منيرة التميمي', 'بندر السهلي',
];

/// نصوص حسب الفئة ومستوى الرضا — عامة، لا تدّعي تفاصيل عن قائمة المكان الفعلية.
const TEXTS: Record<string, { good: string[]; mid: string[]; bad: string[] }> = {
  restaurant: {
    good: [
      'الأكل لذيذ والخدمة سريعة، رجعت له أكثر من مرة.',
      'تجربة ممتازة مع العائلة، المكان نظيف والموظفون محترمون.',
      'الكميات ممتازة والطعم يستاهل، أنصح فيه للعشاء.',
      'أجواء هادئة ومناسبة للقعدات الطويلة، والخدمة راقية.',
    ],
    mid: [
      'الأكل جيد لكن الانتظار كان أطول من المتوقّع.',
      'التجربة عادية، بعض الأطباق ممتازة وبعضها أقل.',
    ],
    bad: ['الخدمة بطيئة وقت الذروة والأسعار مرتفعة مقارنة بالكمية.'],
  },
  cafe: {
    good: [
      'القهوة ممتازة والجو مريح للشغل والمذاكرة.',
      'من أفضل المقاهي اللي جربتها، الحلى رائع والخدمة لطيفة.',
      'مكان هادئ والجلسات مريحة، ينفع لقعدة مع صديق.',
      'الباريستا محترف والقهوة المختصة عندهم مضبوطة.',
    ],
    mid: [
      'القهوة حلوة بس المكان يزدحم بالمساء.',
      'جيد بشكل عام، الأسعار أعلى شوي من المتوقّع.',
    ],
    bad: ['الانتظار طويل والإزعاج عالي وقت الزحمة.'],
  },
  food_truck: {
    good: [
      'سريع ولذيذ وسعره معقول، مثالي لطلعة سريعة.',
      'التحضير سريع والطعم مميز، أنصح فيه.',
      'موقعه سهل والأكل طازج، تجربة حلوة مع الشباب.',
    ],
    mid: ['الأكل حلو لكن ما فيه جلسات مريحة.'],
    bad: ['انتظرت كثير والطلب وصل ناقص.'],
  },
  activity: {
    good: [
      'تجربة ممتعة جداً والتنظيم ممتاز، أكيد بكررها.',
      'مناسب للعائلة والأطفال استمتعوا كثير.',
      'الموظفون ودودون والمكان نظيف، يستاهل السعر.',
      'طلعة حلوة مع الأصدقاء، الحماس كان عالي.',
    ],
    mid: ['التجربة حلوة لكن الزحمة أثّرت على المتعة.'],
    bad: ['التنظيم ضعيف والانتظار طويل على الألعاب.'],
  },
};
TEXTS.event = TEXTS.activity;

export interface DemoReview {
  userIndex: number;
  overallRating: number;
  foodRating: number | null;
  serviceRating: number | null;
  ambienceRating: number | null;
  valueRating: number | null;
  experienceRating: number | null;
  reviewText: string | null;
  tags: string[];
  helpfulCount: number;
  daysAgo: number;
}

/// توزيع واقعي: معظمه 4–5 نجوم.
function pickStars(rand: () => number): number {
  const r = rand();
  if (r < 0.45) return 5;
  if (r < 0.8) return 4;
  if (r < 0.92) return 3;
  if (r < 0.97) return 2;
  return 1;
}

const pick = <T>(arr: T[], rand: () => number): T =>
  arr[Math.floor(rand() * arr.length)];

/// يولّد 5–15 تقييماً لمكان (بمستخدمين مختلفين) بتوزيع واقعي.
export function buildDemoReviews(
  category: string,
  vendorIndex: number,
): DemoReview[] {
  const rand = seededRandom(1000 + vendorIndex);
  const count = 5 + Math.floor(rand() * 11); // 5..15
  const aspects = (REVIEW_ASPECTS[category] ?? REVIEW_ASPECTS.restaurant).map(
    (a) => a.key,
  );
  const tags = REVIEW_TAGS[category] ?? REVIEW_TAGS.restaurant;
  const texts = TEXTS[category] ?? TEXTS.restaurant;

  // مستخدمون مختلفون لكل مكان (تقييم واحد لكل مستخدم لكل مكان).
  const users = [...DEMO_REVIEWERS.keys()]
    .sort(() => rand() - 0.5)
    .slice(0, Math.min(count, DEMO_REVIEWERS.length));

  return users.map((userIndex) => {
    const stars = pickStars(rand);
    const aspect = (key: string) =>
      aspects.includes(key as never)
        ? Math.min(5, Math.max(1, stars + Math.round(rand() * 2 - 1)))
        : null;
    const tone = stars >= 4 ? texts.good : stars === 3 ? texts.mid : texts.bad;
    return {
      userIndex,
      overallRating: stars,
      foodRating: aspect('food'),
      serviceRating: aspect('service'),
      ambienceRating: aspect('ambience'),
      valueRating: aspect('value'),
      experienceRating: aspect('experience'),
      // ~20% تقييمات بنجوم فقط بلا نص (واقعي).
      reviewText: rand() < 0.8 ? pick(tone, rand) : null,
      tags:
        stars >= 4
          ? [...tags].sort(() => rand() - 0.5).slice(0, Math.floor(rand() * 4))
          : [],
      helpfulCount: Math.floor(rand() * rand() * 15),
      daysAgo: 1 + Math.floor(rand() * 120),
    };
  });
}

/// تقييم جوّك الرسمي التجريبي لمكان.
export function buildDemoJawwakReview(category: string, vendorIndex: number) {
  const rand = seededRandom(5000 + vendorIndex);
  const s = () => Math.round((7 + rand() * 2.5) * 10) / 10; // 7.0..9.5
  const scores = {
    qualityScore: s(),
    serviceScore: s(),
    cleanlinessScore: s(),
    valueScore: s(),
    ambienceScore: s(),
  };
  const avg10 =
    Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length;

  const summaries: Record<string, string> = {
    restaurant: 'مطعم يقدّم تجربة متوازنة بين جودة الطعام وسرعة الخدمة.',
    cafe: 'مقهى بأجواء مريحة وقهوة مضبوطة، مناسب للقعدات والعمل.',
    food_truck: 'خيار سريع وطازج بسعر معقول لطلعة خفيفة.',
    activity: 'نشاط منظّم وممتع يناسب العائلات والأصدقاء.',
    event: 'فعالية منظّمة بأجواء حماسية.',
  };

  const badges = ['✓ موثّق جوّك'];
  if (scores.serviceScore >= 8.5) badges.push('⚡ خدمة سريعة');
  if (scores.cleanlinessScore >= 8.5) badges.push('♻ نظافة ممتازة');
  if (scores.valueScore >= 8.5) badges.push('💰 قيمة ممتازة');
  if (category === 'activity' || rand() < 0.3) badges.push('👨‍👩‍👧 مناسب للعائلات');
  if (avg10 >= 8.8) badges.push('🔥 مميّز');

  return {
    reviewerName: 'فريق جوّك',
    daysAgo: 5 + Math.floor(rand() * 60),
    overallScore: Math.round((avg10 / 2) * 10) / 10, // 0..10 → 0..5
    ...scores,
    summary: summaries[category] ?? summaries.restaurant,
    detailedReview:
      'زار فريق جوّك المكان وقيّم الجودة والخدمة والنظافة والقيمة والأجواء ' +
      'وفق معايير موحّدة. (تقييم تجريبي لبيئة التطوير)',
    prosTips: 'احجز مبكراً في عطلة نهاية الأسبوع.',
    consTips: rand() < 0.5 ? 'يزدحم وقت الذروة.' : null,
    badges,
  };
}
