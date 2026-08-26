import { Body, Controller, Delete, Get, Param, Post, Put, Patch, Query, UseGuards } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { UpdateUserRoleDto } from '../users/update-user-role.dto';
import { ForumService } from '../forum/forum.service';
import { ResolveReportDto } from '../forum/dto/resolve-report.dto';
import { AdminApiKeyGuard } from './admin-api-key.guard';
import { AdminIdentityService } from './admin-identity.service';
import { CreatePostDto } from '../forum/dto/create-post.dto';

@UseGuards(AdminApiKeyGuard)
@Controller('api/admin')
export class PublicApiController {

  constructor(
    private readonly usersService: UsersService,
    private readonly forumService: ForumService,
    private readonly adminIdentityService: AdminIdentityService,
  ) {}

  @Get('users')
  getUsers() {
    return this.usersService.findAll();
  }

  @Put('users/:id/role')
  updateUserRole(
    @Param('id') id: string,
    @Body() updateUserRoleDto: UpdateUserRoleDto,
  ) {
    return this.usersService.updateRole(
      Number(id),
      updateUserRoleDto.role,
    );
  }

  @Get('reports')
  getReports(@Query('status') status?: string) {
    return this.forumService.findAllReports(status);
  }

  @Patch('reports/:id/resolve')
  async resolveReport(
    @Param('id') id: string,
    @Body() resolveReportDto: ResolveReportDto,
  ) {
    const adminId =
      await this.adminIdentityService.getAdminId();

    return this.forumService.resolveReport(
      Number(id),
      resolveReportDto,
      adminId,
    );
  }

  @Get('moderation/pending')
  getPendingContent() {
    return this.forumService.findPendingContent();
  }

  @Get('moderation/logs')
  getModerationLogs() {
    return this.forumService.findAllModerationLogs();
  }

  @Post('posts')
  async createPost(
    @Body() createPostDto: CreatePostDto,
  ) {
    const adminId =
      await this.adminIdentityService.getAdminId();

    return this.forumService.createPost(
      createPostDto,
      adminId,
    );
  }

  @Delete('posts/:id')
  async deletePost(
    @Param('id') id: string,
  ) {
    const adminId =
      await this.adminIdentityService.getAdminId();

    return this.forumService.deletePost(
      Number(id),
      adminId,
    );
  }
}
