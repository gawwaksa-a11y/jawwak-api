import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';

import { FirebaseService } from '../../../config/firebase.config';

/// استراتيجية التحقق من توكن Firebase — غلاف رفيع حول FirebaseService
/// يفصل منطق التحقق عن الـ controller/guard.
@Injectable()
export class FirebaseStrategy {
  constructor(private readonly firebase: FirebaseService) {}

  get isEnabled(): boolean {
    return this.firebase.isEnabled;
  }

  validate(idToken: string): Promise<admin.auth.DecodedIdToken> {
    return this.firebase.verifyIdToken(idToken);
  }
}
