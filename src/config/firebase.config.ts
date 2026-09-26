import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as admin from 'firebase-admin';

/// خدمة تهيئة Firebase Admin SDK.
///
/// تُهيَّأ بأول مصدر متاح:
///   1) متغيّرات البيئة (FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY)
///   2) ملف firebase-service-account.json في جذر المشروع
/// وإن لم يتوفّر أيٌّ منهما تبقى معطّلة (يعتمد الـ Guard على مستخدم تطوير).
@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private _app: admin.app.App | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const cert = this.resolveCredential();
    if (!cert) {
      this.logger.warn(
        'Firebase غير مُهيّأ (لا متغيّرات بيئة ولا ملف service-account) — ' +
          'التحقق من التوكن معطّل في هذه البيئة.',
      );
      return;
    }

    this._app = admin.initializeApp({ credential: admin.credential.cert(cert) });
    this.logger.log('تم تهيئة Firebase Admin SDK بنجاح.');
  }

  /// يبني بيانات الاعتماد من البيئة أولاً، ثم من ملف service-account.
  private resolveCredential(): admin.ServiceAccount | null {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');

    if (projectId && clientEmail && privateKey) {
      return {
        projectId,
        clientEmail,
        // المفاتيح تُخزَّن غالباً مع \n مهرّبة.
        privateKey: privateKey.replace(/\\n/g, '\n'),
      };
    }

    // بديل: ملف firebase-service-account.json في جذر المشروع.
    const filePath = path.resolve(process.cwd(), 'firebase-service-account.json');
    try {
      if (fs.existsSync(filePath)) {
        const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        this.logger.log('تحميل بيانات اعتماد Firebase من firebase-service-account.json');
        return {
          projectId: json.project_id,
          clientEmail: json.client_email,
          privateKey: json.private_key,
        };
      }
    } catch (err) {
      this.logger.error(
        `فشل قراءة firebase-service-account.json: ${(err as Error).message}`,
      );
    }
    return null;
  }

  get isEnabled(): boolean {
    return this._app !== null;
  }

  /// التحقق من Firebase ID token وإرجاع الـ decoded token.
  async verifyIdToken(token: string): Promise<admin.auth.DecodedIdToken> {
    if (!this._app) {
      throw new Error('Firebase غير مُهيّأ');
    }
    return admin.auth(this._app).verifyIdToken(token);
  }

  /// إرسال إشعار FCM لجهاز واحد.
  async sendToDevice(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this._app) {
      this.logger.debug(`[FCM معطّل] "${title}" → ${token}`);
      return;
    }
    await admin.messaging(this._app).send({
      token,
      notification: { title, body },
      data,
    });
  }
}
