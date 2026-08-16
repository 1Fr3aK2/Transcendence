import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ForumService } from './forum.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { ReviewContentDto } from './dto/review-content.dto';
import { JwtAuthGuard } from '../auth/jwt-auth-guard';

@Controller('forum')
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  @Get()
  getForum() {
    return {
      message: 'Forum module is working',
    };
  }

  @Get('posts')
  getPosts() {
    return this.forumService.findAllPosts();
  }

  @Get('posts/:id')
  getPostById(@Param('id') id: string) {
    return this.forumService.findPostById(Number(id));
  }

  @UseGuards(JwtAuthGuard)
  @Post('posts')
  createPost(@Body() createPostDto: CreatePostDto, @Req() request) {
    return this.forumService.createPost(createPostDto, request.user.id);
  }

  @Patch('posts/:id')
  updatePost(
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto,
  ) {
    return this.forumService.updatePost(Number(id), updatePostDto);
  }

  @Delete('posts/:id')
  deletePost(@Param('id') id: string) {
    return this.forumService.deletePost(Number(id));
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

  @Get('posts/:id/comments')
  getCommentsByPost(@Param('id') id: string) {
    return this.forumService.findCommentsByPost(Number(id));
  }

  @Post('reports')
  createReport(@Body() createReportDto: CreateReportDto) {
    return this.forumService.createReport(createReportDto);
  }

  @Get('reports')
  getReports(@Query('status') status?: string) {
    return this.forumService.findAllReports(status);
  }

  @Patch('reports/:id/resolve')
  resolveReport(
    @Param('id') id: string,
    @Body() resolveReportDto: ResolveReportDto,
  ) {
    return this.forumService.resolveReport(
      Number(id),
      resolveReportDto,
    );
  }

  @Get('moderation/logs')
  getModerationLogs() {
    return this.forumService.findAllModerationLogs();
  }

  @Get('moderation/pending')
  getPendingContent() {
    return this.forumService.findPendingContent();
  }

  @Patch('moderation/posts/:id/review')
  reviewPendingPost(
    @Param('id') id: string,
    @Body() reviewContentDto: ReviewContentDto,
  ) {
    return this.forumService.reviewPendingPost(
      Number(id),
      reviewContentDto,
    );
  }

  @Patch('moderation/comments/:id/review')
  reviewPendingComment(
    @Param('id') id: string,
    @Body() reviewContentDto: ReviewContentDto,
  ) {
    return this.forumService.reviewPendingComment(
      Number(id),
      reviewContentDto,
    );
  }
}
