import { Injectable, UnauthorizedException } from '@nestjs/common';

import { DEV_USER_ID } from '../../common/guards/firebase-auth.guard';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { VerifyTokenDto } from './dto/verify-token.dto';
import { FirebaseStrategy } from './strategies/firebase.strategy';

export interface AuthResult {
  user: User;
  // في الإنتاج نعيد نفس Firebase ID token (المصدر الموثوق للمصادقة).
  // يمكن استبداله بـ JWT خاص لاحقاً عند الحاجة.
  token: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly firebaseStrategy: FirebaseStrategy,
  ) {}

  /// يتحقق من Firebase ID token، ينشئ/يحدّث المستخدم، ويرجعه مع التوكن.
  async verifyToken(dto: VerifyTokenDto): Promise<AuthResult> {
    // بيئة التطوير بدون Firebase: نقبل التوكن كـ "هوية تطوير".
    // نستخدم نفس معرّف مستخدم التطوير الذي يحقنه FirebaseAuthGuard في بقية
    // المسارات — وإلا تُسجَّل النقاط لمستخدم ويُعرض رصيد مستخدم آخر.
    if (!this.firebaseStrategy.isEnabled) {
      const devUser = await this.usersService.findOrCreate({
        id: DEV_USER_ID,
        firebaseUid: null,
        phone: '+966500000000',
        isDev: true,
      });
      return { user: devUser, token: dto.idToken };
    }

    try {
      const decoded = await this.firebaseStrategy.validate(dto.idToken);
      const user = await this.usersService.upsertFromAuth({
        phone: decoded.phone_number ?? `+000${decoded.uid.slice(0, 9)}`,
        displayName: decoded.name ?? 'ضيف جوّك',
        firebaseUid: decoded.uid,
        deviceToken: dto.deviceToken,
      });
      return { user, token: dto.idToken };
    } catch {
      throw new UnauthorizedException('رمز مصادقة غير صالح');
    }
  }
}
