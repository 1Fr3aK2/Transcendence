import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ForumService } from './forum.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { ReviewContentDto } from './dto/review-content.dto';
import { JwtAuthGuard } from '../auth/jwt-auth-guard';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('forum')
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  getForum() {
    return {
      message: 'Forum module is working',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('posts')
  getPosts() {
    return this.forumService.findAllPosts();
  }

  @UseGuards(JwtAuthGuard)
  @Get('posts/:id')
  getPostById(@Param('id') id: string) {
    return this.forumService.findPostById(Number(id));
  }

  @UseGuards(JwtAuthGuard)
  @Post('posts')
  createPost(@Body() createPostDto: CreatePostDto, @Req() request) {
    return this.forumService.createPost(createPostDto, request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('posts/:id')
  updatePost(
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto,
    @Req() request,
  ) {
    return this.forumService.updatePost(Number(id), updatePostDto, request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('posts/:id')
  deletePost(@Param('id') id: string, @Req() request) {
    return this.forumService.deletePost(Number(id), request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('posts/:id/comments')
  createComment(
    @Param('id') id: string,
    @Body() createCommentDto: CreateCommentDto,
    @Req() request,
  ) {
    return this.forumService.createComment(Number(id), createCommentDto, request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('posts/:id/comments')
  getCommentsByPost(@Param('id') id: string) {
    return this.forumService.findCommentsByPost(Number(id));
  }

  @UseGuards(JwtAuthGuard)
  @Patch('comments/:id')
  updateComment(
    @Param('id') id: string,
    @Body() updateCommentDto: UpdateCommentDto,
    @Req() request,
  ) {
    return this.forumService.updateComment(
      Number(id),
      updateCommentDto,
      request.user.id,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('comments/:id')
  deleteComment(
    @Param('id') id: string,
    @Req() request,
  ) {
    return this.forumService.deleteComment(
      Number(id),
      request.user.id,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('reports')
  createReport(@Body() createReportDto: CreateReportDto, @Req() request) {
    return this.forumService.createReport(createReportDto, request.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODERATOR, Role.ADMIN)
  @Get('reports')
  getReports(@Query('status') status?: string) {
    return this.forumService.findAllReports(status);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODERATOR, Role.ADMIN)
  @Patch('reports/:id/resolve')
  resolveReport(
    @Param('id') id: string,
    @Body() resolveReportDto: ResolveReportDto,
    @Req() request,
  ) {
    return this.forumService.resolveReport(
      Number(id),
      resolveReportDto,
      request.user.id
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODERATOR, Role.ADMIN)
  @Get('moderation/logs')
  getModerationLogs() {
    return this.forumService.findAllModerationLogs();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODERATOR, Role.ADMIN)
  @Get('moderation/pending')
  getPendingContent() {
    return this.forumService.findPendingContent();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODERATOR, Role.ADMIN)
  @Patch('moderation/posts/:id/review')
  reviewPendingPost(
    @Param('id') id: string,
    @Body() reviewContentDto: ReviewContentDto,
    @Req() request,
  ) {
    return this.forumService.reviewPendingPost(
      Number(id),
      reviewContentDto,
      request.user.id
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODERATOR, Role.ADMIN)
  @Patch('moderation/comments/:id/review')
  reviewPendingComment(
    @Param('id') id: string,
    @Body() reviewContentDto: ReviewContentDto,
    @Req() request,
  ) {
    return this.forumService.reviewPendingComment(
      Number(id),
      reviewContentDto,
      request.user.id
    );
  }
}
