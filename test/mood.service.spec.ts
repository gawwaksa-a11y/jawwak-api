import { MoodRequestDto } from '../src/modules/mood/dto/mood-request.dto';
import { MoodService } from '../src/modules/mood/mood.service';
import { VendorRow } from '../src/modules/vendors/vendors.service';

/// اختبارات وحدة لمحرك المزاج على الخادم (منطق التسجيل والترتيب).
describe('MoodService', () => {
  const baseDto: MoodRequestDto = {
    companion: 'duo',
    mood: 'food',
    budgetMin: 50,
    budgetMax: 200,
    timeSlot: 'evening',
    userLat: 24.7136,
    userLng: 46.6753,
  };

  const vendorRow = (over: Partial<VendorRow>): VendorRow => ({
    id: over.id ?? 'v',
    ownerUserId: 'o',
    businessNameAr: 'مكان',
    businessNameEn: 'Place',
    category: 'restaurant',
    lat: 24.7136,
    lng: 46.6753,
    addressText: 'الرياض',
    priceRange: 'mid',
    moodTags: ['food'],
    companionTags: ['duo'],
    verified: true,
    avgRating: 4.5,
    ratingCount: 100,
    avgUserRating: 4.5,
    userReviewCount: 100,
    jawwakScore: null,
    hasJawwakReview: false,
    jawwakBadges: [],
    operatingHours: {},
    images: [],
    isActive: true,
    distanceM: 0,
    ...over,
  });

  let service: MoodService;
  let sessionRepo: { create: jest.Mock; save: jest.Mock; find: jest.Mock };
  let vendorsService: { queryNearby: jest.Mock };
  let cache: { get: jest.Mock; set: jest.Mock };

  beforeEach(() => {
    sessionRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ ...x, id: 'session-1' })),
      find: jest.fn(),
    };
    vendorsService = { queryNearby: jest.fn() };
    cache = { get: jest.fn().mockResolvedValue(undefined), set: jest.fn() };

    service = new MoodService(
      sessionRepo as never,
      vendorsService as never,
      cache as never,
    );
  });

  it('يرتّب النتائج تنازلياً ويعيد 3 كحد أقصى', async () => {
    vendorsService.queryNearby.mockResolvedValue([
      vendorRow({ id: 'a', avgRating: 3.0, distanceM: 0 }),
      vendorRow({ id: 'b', avgRating: 5.0, distanceM: 0 }),
      vendorRow({ id: 'c', avgRating: 4.0, distanceM: 0 }),
      vendorRow({ id: 'd', avgRating: 2.0, distanceM: 0 }),
    ]);

    const res = await service.recommend(baseDto, 'user-1');

    expect(res.results.length).toBe(3);
    expect(res.results[0].id).toBe('b'); // أعلى تقييم يتصدّر عند تساوي الباقي
    for (let i = 0; i < res.results.length - 1; i++) {
      expect(res.results[i].score).toBeGreaterThanOrEqual(
        res.results[i + 1].score,
      );
    }
  });

  it('تطابق المزاج يرفع الدرجة', async () => {
    vendorsService.queryNearby.mockResolvedValue([
      vendorRow({ id: 'match', moodTags: ['food'] }),
      vendorRow({ id: 'nomatch', moodTags: ['calm'] }),
    ]);

    const res = await service.recommend(baseDto, 'user-1');
    expect(res.results[0].id).toBe('match');
    const match = res.results.find((r) => r.id === 'match')!;
    const no = res.results.find((r) => r.id === 'nomatch')!;
    expect(match.score).toBeGreaterThan(no.score);
  });

  it('يعيد sessionId وينشئ جلسة مزاج', async () => {
    vendorsService.queryNearby.mockResolvedValue([vendorRow({ id: 'a' })]);

    const res = await service.recommend(baseDto, 'user-1');

    expect(res.sessionId).toBe('session-1');
    expect(sessionRepo.save).toHaveBeenCalledTimes(1);
  });

  it('يستخدم الكاش عند وجوده ولا يستعلم قاعدة البيانات', async () => {
    cache.get.mockResolvedValue([
      { ...vendorRow({ id: 'cached' }), score: 0.9, matchPercent: 90, distanceKm: 0 },
    ]);

    const res = await service.recommend(baseDto, 'user-1');

    expect(vendorsService.queryNearby).not.toHaveBeenCalled();
    expect(res.results[0].id).toBe('cached');
  });

  it('نسبة التطابق ضمن [0,100] والدرجة ضمن [0,1]', async () => {
    vendorsService.queryNearby.mockResolvedValue([
      vendorRow({ id: 'a', moodTags: ['food'], companionTags: ['duo'], avgRating: 5 }),
    ]);
    const res = await service.recommend(baseDto, 'user-1');
    expect(res.results[0].score).toBeGreaterThanOrEqual(0);
    expect(res.results[0].score).toBeLessThanOrEqual(1);
    expect(res.results[0].matchPercent).toBeGreaterThanOrEqual(0);
    expect(res.results[0].matchPercent).toBeLessThanOrEqual(100);
  });
});
