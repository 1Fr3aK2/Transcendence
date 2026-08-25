import { Controller, UseGuards } from '@nestjs/common';
import { AdminApiKeyGuard } from './admin-api-key.guard';

@UseGuards(AdminApiKeyGuard)
@Controller('api/admin')
export class PublicApiController {}
