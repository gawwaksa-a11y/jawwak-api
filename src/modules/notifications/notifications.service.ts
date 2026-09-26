import { Injectable, Logger } from '@nestjs/common';

import { FirebaseService } from '../../config/firebase.config';
import { UsersService } from '../users/users.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly firebase: FirebaseService,
    private readonly usersService: UsersService,
  ) {}

  /// إرسال إشعار FCM لمستخدم عبر رمز جهازه المخزّن.
  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user?.deviceToken) {
      this.logger.debug(`لا يوجد رمز جهاز للمستخدم ${userId} — تخطّي الإشعار.`);
      return;
    }
    await this.firebase.sendToDevice(user.deviceToken, title, body, data);
  }
}
