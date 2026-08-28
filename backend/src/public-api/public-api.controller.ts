import { Body, Controller, Delete, Get, Param, Post, Put, Patch, Query, UseGuards } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { UpdateUserRoleDto } from '../users/update-user-role.dto';
import { ForumService } from '../forum/forum.service';
import { ResolveReportDto } from '../forum/dto/resolve-report.dto';
import { AdminApiKeyGuard } from './admin-api-key.guard';
import { AdminIdentityService } from './admin-identity.service';
import { CreatePostDto } from '../forum/dto/create-post.dto';
import { AdminApiRateLimitGuard } from './admin-api-rate-limit.guard';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Public Admin API')
@ApiSecurity('admin-api-key')
@UseGuards(AdminApiKeyGuard, AdminApiRateLimitGuard)
@Controller('api/admin')
export class PublicApiController {

  constructor(
    private readonly usersService: UsersService,
    private readonly forumService: ForumService,
    private readonly adminIdentityService: AdminIdentityService,
  ) {}

  @ApiOperation({ summary: 'List all users' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @Get('users')
  getUsers() {
    return this.usersService.findAll();
  }

  @ApiOperation({ summary: 'Update a user role' })
  @ApiParam({
    name: 'id',
    type: Number,
  })
  @ApiResponse({ status: 200, description: 'User role updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid role or ADMIN role cannot be changed' })
  @ApiResponse({ status: 404, description: 'User not found' })
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

  @ApiOperation({ summary: 'List moderation reports' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter reports by status',
  })
  @ApiResponse({ status: 200, description: 'Reports retrieved successfully' })
  @Get('reports')
  getReports(@Query('status') status?: string) {
    return this.forumService.findAllReports(status);
  }

  @ApiOperation({ summary: 'Resolve a moderation report' })
  @ApiParam({
    name: 'id',
    type: Number,
  })
  @ApiResponse({ status: 200, description: 'Report resolved successfully' })
  @ApiResponse({ status: 404, description: 'Report not found' })
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

  @ApiOperation({ summary: 'List content pending moderation' })
  @ApiResponse({ status: 200, description: 'Pending content retrieved successfully' })
  @Get('moderation/pending')
  getPendingContent() {
    return this.forumService.findPendingContent();
  }

  @ApiOperation({ summary: 'List moderation logs' })
  @ApiResponse({ status: 200, description: 'Moderation logs retrieved successfully' })
  @Get('moderation/logs')
  getModerationLogs() {
    return this.forumService.findAllModerationLogs();
  }

  @ApiOperation({ summary: 'Create a post as the administrator' })
  @ApiResponse({ status: 201, description: 'Post created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or rejected post' })
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

  @ApiOperation({ summary: 'Delete an administrator-owned post' })
  @ApiParam({
    name: 'id',
    type: Number,
  })
  @ApiResponse({ status: 200, description: 'Post deleted successfully' })
  @ApiResponse({ status: 403, description: 'Post does not belong to the administrator' })
  @ApiResponse({ status: 404, description: 'Post not found' })
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
