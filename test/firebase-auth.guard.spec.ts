import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

import { FirebaseAuthGuard } from '../src/common/guards/firebase-auth.guard';

describe('FirebaseAuthGuard', () => {
  const INTERNAL_ID = '11111111-1111-4111-8111-111111111111';
  const VICTIM_ID = '99999999-9999-4999-8999-999999999999';

  let firebase: { isEnabled: boolean; verifyIdToken: jest.Mock };
  let users: { findByFirebaseUid: jest.Mock; upsertFromAuth: jest.Mock };
  let env: string;
  let guard: FirebaseAuthGuard;

  const reflector = { getAllAndOverride: () => false };
  const config = { get: () => env };

  function ctx(headers: Record<string, string>) {
    const request: { headers: Record<string, string>; user?: { id: string } } = {
      headers,
    };
    const context = {
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { context, request };
  }

  beforeEach(() => {
    env = 'production';
    firebase = {
      isEnabled: true,
      verifyIdToken: jest.fn(async () => ({
        uid: 'firebase-uid-abc',
        phone_number: '+966511111111',
      })),
    };
    users = {
      findByFirebaseUid: jest.fn(async () => ({ id: INTERNAL_ID })),
      upsertFromAuth: jest.fn(async () => ({ id: INTERNAL_ID })),
    };
    guard = new FirebaseAuthGuard(
      reflector as never,
      firebase as never,
      config as never,
      users as never,
    );
  });

  it('يستخدم معرّف المستخدم الداخلي المشتق من التوكن ويتجاهل x-user-id', async () => {
    const { context, request } = ctx({
      authorization: 'Bearer valid-token',
      'x-user-id': VICTIM_ID, // محاولة انتحال مستخدم آخر
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user?.id).toBe(INTERNAL_ID);
    expect(request.user?.id).not.toBe(VICTIM_ID);
    expect(users.findByFirebaseUid).toHaveBeenCalledWith('firebase-uid-abc');
  });

  it('ينشئ سجل المستخدم عند أول طلب له', async () => {
    users.findByFirebaseUid.mockResolvedValue(null);
    const { context, request } = ctx({ authorization: 'Bearer valid-token' });

    await guard.canActivate(context);
    expect(users.upsertFromAuth).toHaveBeenCalledWith(
      expect.objectContaining({ firebaseUid: 'firebase-uid-abc' }),
    );
    expect(request.user?.id).toBe(INTERNAL_ID);
  });

  it('يرفض توكناً غير صالح بـ 401', async () => {
    firebase.verifyIdToken.mockRejectedValue(new Error('bad token'));
    const { context } = ctx({ authorization: 'Bearer forged' });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('في الإنتاج بلا Firebase: يرفض ولا يحقن مستخدم تطوير', async () => {
    firebase.isEnabled = false;
    const { context } = ctx({});
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
