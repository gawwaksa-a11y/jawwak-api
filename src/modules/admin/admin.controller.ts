import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
// مؤشّرات الأعمال لفريق جوّك فقط (ADMIN_PHONES).
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'مؤشّرات النجاح للمؤسّس (KPIs)' })
  kpis() {
    return this.adminService.kpis();
  }

  @Get('kpis/timeseries')
  @ApiQuery({ name: 'days', required: false, type: Number })
  @ApiOperation({ summary: 'سلسلة زمنية يومية (حجوزات + جلسات مزاج)' })
  timeseries(@Query('days') days?: string) {
    const n = Math.min(60, Math.max(7, Number(days) || 14));
    return this.adminService.timeseries(n);
  }
}
