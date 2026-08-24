import { Body, Controller, Post } from '@nestjs/common';
import { AnalyzeTextDto } from './dto/analyze-text.dto';
import { ModerationService } from './moderation.service';
import { UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('forum/moderation')
export class ModerationController {
  constructor(
    private readonly moderationService: ModerationService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODERATOR, Role.ADMIN)
  @Post('analyze')
  analyzeText(@Body() analyzeTextDto: AnalyzeTextDto) {
    return this.moderationService.analyzeText(
      analyzeTextDto.text,
    );
  }
}
