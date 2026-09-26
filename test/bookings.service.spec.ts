import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { QrUtil } from '../src/common/utils/qr.util';
import { BookingsService } from '../src/modules/bookings/bookings.service';

describe('BookingsService', () => {
  const SECRET = 'unit-test-secret-key';
  const HMAC = 'unit-test-hmac-key';

  let service: BookingsService;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
  };
  let rewards: { award: jest.Mock };
  let vendors: { findOne: jest.Mock; assertOwner: jest.Mock };
  const owner = { id: 'owner-1', firebaseUid: null, isDev: false };
  let notifications: { sendToUser: jest.Mock };

  const config = {
    get: (key: string, def?: unknown) =>
      key === 'QR_SECRET_KEY' ? SECRET : key === 'QR_HMAC_KEY' ? HMAC : def,
  };

  beforeEach(() => {
    let idCounter = 0;
    repo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: x.id ?? `b-${++idCounter}`, ...x })),
      findOne: jest.fn(),
      update: jest.fn(),
    };
    rewards = { award: jest.fn() };
    vendors = {
      findOne: jest.fn(async () => ({
        businessNameAr: 'مطعم النخيل',
        ownerUserId: 'owner-1',
      })),
      assertOwner: jest.fn(async () => ({ id: 'v-1', ownerUserId: 'owner-1' })),
    };
    notifications = { sendToUser: jest.fn() };
    service = new BookingsService(
      repo as never,
      config as never,
      rewards as never,
      vendors as never,
      notifications as never,
    );
  });

  it('حجز بطاقة يبقى pending بلا QR ولا نقاط حتى الدفع', async () => {
    const booking = await service.create(
      { vendorId: 'vendor-1', paymentMethod: 'mada', amount: 150 },
      'user-1',
    );

    expect(booking.status).toBe('pending');
    expect(booking.qrCode).toBeFalsy();
    expect(rewards.award).not.toHaveBeenCalled();
  });

  it('حجز المحفظة يُؤكَّد فوراً بـ QR و10 نقاط', async () => {
    const booking = await service.create(
      { vendorId: 'vendor-1', paymentMethod: 'wallet', amount: 150 },
      'user-1',
    );

    expect(booking.status).toBe('confirmed');
    expect(booking.qrCode).toBeDefined();
    expect(rewards.award).toHaveBeenCalledWith(
      'user-1',
      'booking',
      expect.any(String),
      10,
    );
  });

  it('confirmAfterPayment يؤكّد الحجز ويولّد QR ويمنح النقاط', async () => {
    repo.findOne.mockResolvedValue({
      id: 'b-9',
      userId: 'user-1',
      vendorId: 'vendor-1',
      status: 'pending',
      expiresAt: new Date(Date.now() + 3600_000),
    });

    const booking = await service.confirmAfterPayment('b-9', {
      transactionId: 'txn-123',
      paymentBrand: 'MADA',
      resultCode: '000.100.110',
    });

    expect(booking.status).toBe('confirmed');
    expect(booking.transactionId).toBe('txn-123');
    expect(booking.qrCode).toBeDefined();
    expect(rewards.award).toHaveBeenCalledWith(
      'user-1',
      'booking',
      'b-9',
      10,
    );
  });

  it('يتحقق من QR صالح ويحوّل الحالة إلى used', async () => {
    const expiresAt = new Date(Date.now() + 3600_000);
    const qr = QrUtil.generate(
      { bookingId: 'b-1', vendorId: 'v-1', userId: 'u-1', exp: expiresAt.getTime() },
      SECRET,
      HMAC,
    );
    repo.findOne.mockResolvedValue({
      id: 'b-1',
      status: 'confirmed',
      vendorId: 'v-1',
      userId: 'u-1',
      expiresAt,
    });

    const result = await service.verifyQr('b-1', qr, owner);
    expect(result.status).toBe('used');
    expect(result.qrScannedAt).toBeInstanceOf(Date);
  });

  it('يرفض QR لا يطابق معرّف الحجز', async () => {
    const qr = QrUtil.generate(
      { bookingId: 'OTHER', vendorId: 'v', userId: 'u', exp: Date.now() + 10000 },
      SECRET,
      HMAC,
    );
    await expect(service.verifyQr('b-1', qr, owner)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('يرفض QR تالفاً/غير صالح', async () => {
    await expect(service.verifyQr('b-1', 'garbage.qr', owner)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('يرفض مسح QR من غير مالك المزوّد', async () => {
    const expiresAt = new Date(Date.now() + 3600_000);
    const qr = QrUtil.generate(
      { bookingId: 'b-1', vendorId: 'v-1', userId: 'u-1', exp: expiresAt.getTime() },
      SECRET,
      HMAC,
    );
    repo.findOne.mockResolvedValue({
      id: 'b-1', status: 'confirmed', vendorId: 'v-1', userId: 'u-1', expiresAt,
    });
    vendors.assertOwner.mockRejectedValue(new ForbiddenException());
    const stranger = { id: 'someone-else', firebaseUid: null, isDev: false };

    await expect(service.verifyQr('b-1', qr, stranger)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('لا يسمح بإلغاء حجز مُستخدم', async () => {
    repo.findOne.mockResolvedValue({
      id: 'b-1',
      userId: 'user-1',
      status: 'used',
    });
    await expect(service.cancel('b-1', 'user-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
