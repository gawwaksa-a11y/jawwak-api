import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { FirebaseService } from '../../config/firebase.config';
import { UsersService } from '../../modules/users/users.service';
import { AuthUser } from '../decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/// معرّف مستخدم التطوير الثابت (يُستخدم عند تعطيل Firebase في بيئة التطوير).
export const DEV_USER_ID = '00000000-0000-4000-8000-000000000001';

/// حارس المصادقة عبر Firebase.
/// - يتخطّى المسارات المعلّمة بـ @Public().
/// - يتحقق من Bearer token عبر Firebase Admin.
/// - في التطوير (Firebase معطّل) يحقن مستخدم تطوير بدل رفض الطلب.
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly firebase: FirebaseService,
    private readonly config: ConfigService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    const isDevEnv = this.config.get<string>('NODE_ENV') !== 'production';

    // بيئة تطوير + Firebase معطّل → مستخدم تطوير.
    if (!this.firebase.isEnabled) {
      if (!isDevEnv) {
        throw new UnauthorizedException('خدمة المصادقة غير متاحة');
      }
      (request as Request & { user: AuthUser }).user = {
        id: DEV_USER_ID,
        firebaseUid: null,
        phone: '+966500000000',
        isDev: true,
      };
      return true;
    }

    if (!token) {
      throw new UnauthorizedException('رمز المصادقة مفقود');
    }

    let decoded: Awaited<ReturnType<FirebaseService['verifyIdToken']>>;
    try {
      decoded = await this.firebase.verifyIdToken(token);
    } catch (err) {
      this.logger.warn(`فشل التحقق من التوكن: ${(err as Error).message}`);
      throw new UnauthorizedException('رمز مصادقة غير صالح');
    }

    // الهوية تُشتق من التوكن الموثّق فقط (لا من ترويسات العميل):
    // firebaseUid ← معرّف المستخدم الداخلي (UUID)، مع إنشاء السجل لأول مرة.
    const user =
      (await this.users.findByFirebaseUid(decoded.uid)) ??
      (await this.users.upsertFromAuth({
        phone: decoded.phone_number ?? `+000${decoded.uid.slice(0, 9)}`,
        displayName: decoded.name ?? 'ضيف جوّك',
        firebaseUid: decoded.uid,
      }));

    (request as Request & { user: AuthUser }).user = {
      id: user.id,
      firebaseUid: decoded.uid,
      phone: decoded.phone_number,
      isDev: false,
    };
    return true;
  }

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header) return null;
    const [type, value] = header.split(' ');
    return type === 'Bearer' && value ? value : null;
  }
}
