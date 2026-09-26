import { NotFoundException } from '@nestjs/common';

import { PaginationDto } from '../src/common/dto/pagination.dto';
import { Vendor } from '../src/modules/vendors/entities/vendor.entity';
import { VendorsService } from '../src/modules/vendors/vendors.service';

describe('VendorsService', () => {
  let service: VendorsService;
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    findAndCount: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let bookingRepo: { count: jest.Mock };
  let sessionRepo: { find: jest.Mock };

  function vendor(over: Partial<Vendor>): Vendor {
    return {
      id: over.id ?? 'v-1',
      ownerUserId: 'o-1',
      businessNameAr: 'مقهى نبت',
      businessNameEn: 'Nabt',
      category: 'cafe',
      lat: over.lat ?? 24.7136,
      lng: over.lng ?? 46.6753,
      addressText: 'الرياض',
      priceRange: 'mid',
      moodTags: ['calm'],
      companionTags: ['solo'],
      verified: true,
      avgRating: 4.6,
      ratingCount: 100,
      operatingHours: {},
      images: [],
      crNumber: null,
      contractSignedAt: null,
      isActive: true,
      createdAt: new Date(),
      ...over,
    } as Vendor;
  }

  beforeEach(() => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ ...x, id: 'v-1' })),
      update: jest.fn(),
    };
    bookingRepo = { count: jest.fn() };
    sessionRepo = { find: jest.fn() };
    service = new VendorsService(
      repo as never,
      bookingRepo as never,
      sessionRepo as never,
    );
  });

  it('findOne يرجع المزوّد', async () => {
    repo.findOne.mockResolvedValue(vendor({ id: 'v-1' }));
    const v = await service.findOne('v-1');
    expect(v.id).toBe('v-1');
    expect(v.lat).toBeCloseTo(24.7136);
  });

  it('findOne يرمي NotFound عند عدم الوجود', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findOne('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('queryNearby يفلتر بالمسافة ويرتّب بالأقرب', async () => {
    repo.find.mockResolvedValue([
      vendor({ id: 'near', lat: 24.7136, lng: 46.6753 }),
      vendor({ id: 'far', lat: 25.2, lng: 46.6753 }), // ~54 كم
    ]);
    const rows = await service.queryNearby(24.7136, 46.6753, 15000);
    expect(rows.map((r) => r.id)).toEqual(['near']);
    expect(rows[0].distanceM).toBeLessThan(100);
  });

  it('queryNearby يرتّب عدة نتائج تصاعدياً بالمسافة', async () => {
    repo.find.mockResolvedValue([
      vendor({ id: 'b', lat: 24.75, lng: 46.6753 }),
      vendor({ id: 'a', lat: 24.72, lng: 46.6753 }),
    ]);
    const rows = await service.queryNearby(24.7136, 46.6753, 50000);
    expect(rows.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('create يمرّر lat/lng و ownerUserId ثم يعيد الصف', async () => {
    repo.findOne.mockResolvedValue(vendor({ id: 'v-1' }));
    await service.create(
      {
        businessNameAr: 'مقهى',
        businessNameEn: 'Cafe',
        category: 'cafe',
        lat: 24.8,
        lng: 46.6,
        addressText: 'الرياض',
        priceRange: 'mid',
        moodTags: ['calm'],
        companionTags: ['solo'],
      },
      'owner-1',
    );
    const created = repo.create.mock.calls[0][0];
    expect(created.lat).toBe(24.8);
    expect(created.lng).toBe(46.6);
    expect(created.ownerUserId).toBe('owner-1');
  });

  it('findAll يعيد شكل استجابة مُرقّم', async () => {
    repo.findAndCount.mockResolvedValue([[vendor({ id: 'v-1' })], 1]);
    const res = await service.findAll(new PaginationDto(), {});
    expect(res.total).toBe(1);
    expect(res.items).toHaveLength(1);
    expect(res.totalPages).toBe(1);
  });

});
