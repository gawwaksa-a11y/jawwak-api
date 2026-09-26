import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/// يُعلّم المسار كعام (بدون مصادقة) — يتخطّاه FirebaseAuthGuard.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
