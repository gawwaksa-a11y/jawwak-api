import { ValidationPipe } from '@nestjs/common';

/// أنبوب تحقّق موحّد يُطبّق على كل الطلبات.
/// - whitelist: يزيل الحقول غير المعرّفة في الـ DTO.
/// - transform: يحوّل الحمولة إلى نسخة من صنف الـ DTO.
/// - رسائل الخطأ تأتي من class-validator (بالعربية داخل الـ DTOs).
export const globalValidationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});
