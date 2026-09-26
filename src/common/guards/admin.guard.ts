import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

import { AuthUser } from '../decorators/current-user.decorator';

/// حارس المشرفين (فريق جوّك).
///
/// يعمل بعد FirebaseAuthGuard: المستخدم مشرف إذا كان رقم جواله (من توكن Firebase
/// الموثّق) ضمن ADMIN_PHONES. مستخدم التطوير مسموح في بيئة التطوير فقط.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const user = request.user;
    if (!user) throw new UnauthorizedException('يلزم تسجيل الدخول');
    if (user.isDev) return true;

    const admins = (this.config.get<string>('ADMIN_PHONES') ?? '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (user.phone && admins.includes(user.phone)) return true;

    throw new ForbiddenException('هذه العملية لفريق جوّك فقط');
  }
}
