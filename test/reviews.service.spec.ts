import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { ReviewsService } from '../src/modules/reviews/reviews.service';

/// قواعد نظام التقييم المزدوج (زيارة موثّقة، تهدئة، محاور/وسوم، "مفيد"، المتوسطات).
describe('ReviewsService', () => {
  const VENDOR = { id: 'v-1', category: 'restaurant' };
  const USED = { id: 'b-1', userId: 'u-1', vendorId: 'v-1', status: 'used' };

  let reviewRepo: Record<string, jest.Mock>;
  let jawwakRepo: Record<string, jest.Mock>;
  let voteRepo: Record<string, jest.Mock>;
  let bookingRepo: Record<string, jest.Mock>;
  let vendorRepo: Record<string, jest.Mock>;
  let userRepo: Record<string, jest.Mock>;
  let rewards: { award: jest.Mock };
  let service: ReviewsService;

  beforeEach(() => {
    reviewRepo = {
      findOne: jest.fn(async () => null),
      find: jest.fn(async () => []),
      findAndCount: jest.fn(async () => [[], 0]),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: 'r-1', ...x })),
      increment: jest.fn(),
    };
    jawwakRepo = { findOne: jest.fn(async () => null) };
    voteRepo = {
      findOne: jest.fn(async () => null),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };
    bookingRepo = {
      findOne: jest.fn(async () => USED),
      find: jest.fn(async () => [USED]),
    };
    vendorRepo = {
      findOne: jest.fn(async () => VENDOR),
      update: jest.fn(),
    };
    userRepo = { find: jest.fn(async () => []) };
    rewards = { award: jest.fn() };
    service = new ReviewsService(
      reviewRepo as never,
      jawwakRepo as never,
      voteRepo as never,
      bookingRepo as never,
      vendorRepo as never,
      userRepo as never,
      rewards as never,
    );
  });

  it('يرفض التقييم بلا زيارة موثّقة (لا حجز مُستخدم)', async () => {
    bookingRepo.find.mockResolvedValue([]);
    await expect(
      service.createUserReview({ vendorId: 'v-1', overallRating: 5 }, 'u-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(reviewRepo.save).not.toHaveBeenCalled();
    expect(rewards.award).not.toHaveBeenCalled();
  });

  it('يرفض حجزاً لم يُمسح بعد (confirmed)', async () => {
    bookingRepo.findOne.mockResolvedValue({ ...USED, status: 'confirmed' });
    await expect(
      service.createUserReview(
        { vendorId: 'v-1', bookingId: 'b-1', overallRating: 5 },
        'u-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('يقبل زيارة موثّقة: يحفظ كموثّق، يمنح 5 نقاط، ويعيد حساب المتوسطات', async () => {
    const review = await service.createUserReview(
      {
        vendorId: 'v-1',
        overallRating: 4,
        foodRating: 5,
        tags: ['خدمة سريعة'],
      },
      'u-1',
    );
    expect(review.isVerifiedVisit).toBe(true);
    expect(review.bookingId).toBe('b-1');
    expect(review.pointsAwarded).toBe(5);
    expect(rewards.award).toHaveBeenCalledWith('u-1', 'review', 'r-1', 5);
    expect(vendorRepo.update).toHaveBeenCalled();
  });

  it('يرفض تقييماً ثانياً لنفس المكان خلال 30 يوماً', async () => {
    reviewRepo.findOne.mockResolvedValue({ id: 'old' }); // تقييم حديث موجود
    await expect(
      service.createUserReview(
        { vendorId: 'v-1', bookingId: 'b-1', overallRating: 5 },
        'u-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('يرفض وسماً لا يخص فئة المكان', async () => {
    await expect(
      service.createUserReview(
        { vendorId: 'v-1', overallRating: 5, tags: ['واي فاي سريع'] }, // وسم مقاهٍ
        'u-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('يرفض محوراً لا يناسب الفئة (التجربة لمطعم)', async () => {
    await expect(
      service.createUserReview(
        { vendorId: 'v-1', overallRating: 5, experienceRating: 4 },
        'u-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('"مفيد": لا يصوّت المستخدم على تقييمه، ولا يتكرّر صوته', async () => {
    reviewRepo.findOne.mockResolvedValue({
      id: 'r-1', userId: 'u-1', status: 'approved', helpfulCount: 3,
    });
    await expect(service.markHelpful('r-1', 'u-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    voteRepo.findOne.mockResolvedValue({ id: 'vote' }); // صوّت سابقاً
    const res = await service.markHelpful('r-1', 'u-2');
    expect(res.helpfulCount).toBe(3);
    expect(reviewRepo.increment).not.toHaveBeenCalled();
  });

  it('recomputeVendor: متوسط عام + محاور تتجاهل القيم الفارغة + توزيع النجوم', async () => {
    reviewRepo.find.mockResolvedValue([
      { overallRating: '5', foodRating: '5', serviceRating: null },
      { overallRating: '4', foodRating: null, serviceRating: '3' },
      { overallRating: '4', foodRating: '4', serviceRating: '4' },
    ]);
    await service.recomputeVendor('v-1');
    const u = vendorRepo.update.mock.calls[0][1];
    expect(u.avgRating).toBeCloseTo(4.3);
    expect(u.ratingCount).toBe(3);
    expect(u.avgFoodRating).toBeCloseTo(4.5);
    expect(u.avgServiceRating).toBeCloseTo(3.5);
    expect(u.avgAmbienceRating).toBe(0);
    expect(u.ratingDistribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 2, 5: 1 });
  });
});
