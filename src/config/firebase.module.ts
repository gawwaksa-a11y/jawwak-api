import { Global, Module } from '@nestjs/common';

import { FirebaseService } from './firebase.config';

/// وحدة عامة تتيح FirebaseService في كل مكان (الحارس، الاستراتيجية، الإشعارات).
@Global()
@Module({
  providers: [FirebaseService],
  exports: [FirebaseService],
})
export class FirebaseModule {}
