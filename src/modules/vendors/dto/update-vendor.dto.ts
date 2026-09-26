import { PartialType } from '@nestjs/swagger';
import { CreateVendorDto } from './create-vendor.dto';

/// كل الحقول اختيارية عند التحديث.
export class UpdateVendorDto extends PartialType(CreateVendorDto) {}
