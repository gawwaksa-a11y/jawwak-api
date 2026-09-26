import * as CryptoJS from 'crypto-js';

/// حمولة رمز QR للتذكرة.
export interface QrPayload {
  bookingId: string;
  vendorId: string;
  userId: string;
  exp: number; // ملّي ثانية انتهاء الصلاحية
}

/// أداة توليد/التحقق من رموز QR: تشفير AES + توقيع HMAC-SHA256.
///
/// الصيغة النهائية: base64( iv-cipher ).base64( hmac )
export class QrUtil {
  /// يولّد رمز QR مشفّراً وموقّعاً من الحمولة.
  static generate(payload: QrPayload, secretKey: string, hmacKey: string): string {
    const plaintext = JSON.stringify(payload);
    const cipher = CryptoJS.AES.encrypt(plaintext, secretKey).toString();
    const sig = CryptoJS.HmacSHA256(cipher, hmacKey).toString(CryptoJS.enc.Hex);
    // نرمّز النص المشفّر بـ base64url لتفادي المحارف الخاصة داخل QR.
    const encoded = Buffer.from(cipher, 'utf8').toString('base64url');
    return `${encoded}.${sig}`;
  }

  /// يفكّ التشفير ويتحقق من التوقيع والصلاحية. يرجع null إذا كان غير صالح.
  static verify(
    qr: string,
    secretKey: string,
    hmacKey: string,
  ): QrPayload | null {
    try {
      const [encoded, sig] = qr.split('.');
      if (!encoded || !sig) return null;

      const cipher = Buffer.from(encoded, 'base64url').toString('utf8');

      // التحقق من التوقيع أولاً (يمنع التلاعب).
      const expectedSig = CryptoJS.HmacSHA256(cipher, hmacKey).toString(
        CryptoJS.enc.Hex,
      );
      if (expectedSig !== sig) return null;

      const bytes = CryptoJS.AES.decrypt(cipher, secretKey);
      const plaintext = bytes.toString(CryptoJS.enc.Utf8);
      if (!plaintext) return null;

      const payload = JSON.parse(plaintext) as QrPayload;
      if (Date.now() > payload.exp) return null; // منتهي الصلاحية

      return payload;
    } catch {
      return null;
    }
  }
}
