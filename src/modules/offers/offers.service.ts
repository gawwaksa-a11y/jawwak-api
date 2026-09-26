import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuthUser } from '../../common/decorators/current-user.decorator';
import { VendorsService } from '../vendors/vendors.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { Offer } from './entities/offer.entity';

@Injectable()
export class OffersService {
  constructor(
    @InjectRepository(Offer)
    private readonly repo: Repository<Offer>,
    private readonly vendorsService: VendorsService,
  ) {}

  /// إنشاء/تعديل/حذف العروض لمالك المزوّد فقط.
  async create(dto: CreateOfferDto, user: AuthUser): Promise<Offer> {
    await this.vendorsService.assertOwner(dto.vendorId, user);
    const offer = this.repo.create({
      vendorId: dto.vendorId,
      title: dto.title,
      discountPct: dto.discountPct,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      isActive: true,
    });
    return this.repo.save(offer);
  }

  findByVendor(vendorId: string): Promise<Offer[]> {
    return this.repo.find({
      where: { vendorId },
      order: { createdAt: 'DESC' },
    });
  }

  async update(
    id: string,
    dto: UpdateOfferDto,
    user: AuthUser,
  ): Promise<Offer> {
    const offer = await this.repo.findOne({ where: { id } });
    if (!offer) throw new NotFoundException('العرض غير موجود');
    await this.vendorsService.assertOwner(offer.vendorId, user);
    if (dto.title !== undefined) offer.title = dto.title;
    if (dto.discountPct !== undefined) offer.discountPct = dto.discountPct;
    if (dto.startDate !== undefined) offer.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) offer.endDate = new Date(dto.endDate);
    if (dto.isActive !== undefined) offer.isActive = dto.isActive;
    return this.repo.save(offer);
  }

  async remove(id: string, user: AuthUser): Promise<{ deleted: boolean }> {
    const offer = await this.repo.findOne({ where: { id } });
    if (!offer) throw new NotFoundException('العرض غير موجود');
    await this.vendorsService.assertOwner(offer.vendorId, user);
    await this.repo.delete(id);
    return { deleted: true };
  }
}
