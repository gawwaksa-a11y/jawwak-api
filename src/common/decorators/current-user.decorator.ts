import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/// المستخدم المصادَق عليه كما يحقنه FirebaseAuthGuard في الطلب.
export interface AuthUser {
  id: string; // معرّف المستخدم الداخلي (UUID)
  firebaseUid: string | null;
  phone?: string;
  isDev: boolean; // true إذا كان مستخدم تطوير (بدون Firebase)
}

/// ديكوريتر لاستخراج المستخدم الحالي من الطلب.
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthUser | undefined = request.user;
    return data && user ? user[data] : user;
  },
);
