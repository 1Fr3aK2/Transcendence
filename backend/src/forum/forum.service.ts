import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { AutomaticModerationService } from '../moderation/automatic-moderation.service';
import { SearchPostsDto } from './dto/search-posts.dto';
import { Prisma } from '@prisma/client';
import { RateLimiterService } from '../rate-limiter/rate-limiter.service';

@Injectable()
export class ForumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly automaticModerationService: AutomaticModerationService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  async findAllPosts(query: SearchPostsDto) {

    // Validates that the start date is not later than the end date
    if (
      query.dateFrom &&                                   // query.dateFrom is provided
      query.dateTo &&                                     // query.dateTo is provided
      new Date(query.dateFrom) > new Date(query.dateTo)   // The start date is later than the end date
    ) {
      throw new BadRequestException(
        'dateFrom must be earlier than or equal to dateTo',
      );
    }

    // Sets default values when the corresponding query parameters are null or undefined (?? — Nullish Coalescing Operator)
    const sortBy = query.sortBy ?? 'createdAt';
    const order = query.order ?? 'desc';
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;    // Calculates how many records to skip for pagination

    // Builds the Prisma filter object dynamically, including only the provided filters
    const where: Prisma.PostWhereInput = {    // Prisma-generated type defining allowed filters and operators for the Post model (TypeScript compile-time checking only); Ensures properties and operators are compatible with the Prisma model
      status: 'visible',

      // Adds a search filter if query.search is provided
      ...(query.search && {
        OR: [   // Prisma logical operator: matches records if at least one condition is true (e.g., title or content contains the search term)
          {
            title: {
              contains: query.search,   // Prisma string filter operator: matches strings containing the specified value
              mode: 'insensitive',      // Case-insensitive search
            },
          },
          {
            content: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
        ],
      }),

      // Adds an author filter if query.authorId is provided
      ...(query.authorId && {      // && returns the first operand if falsy; otherwise, it evaluates and returns the second
        authorId: query.authorId,
      }),

      // Adds a date filter if at least one date is provided
      ...((query.dateFrom || query.dateTo) && {
        createdAt: {
          ...(query.dateFrom && {
            gte: new Date(query.dateFrom),    // Greater than or equal to the start date (Prisma comparison operator)
          }),
          ...(query.dateTo && {
            // getTime() returns milliseconds since the Unix epoch;
            // 86400000 ms = 24 hours, moving to the start of the next UTC day.
            // lt excludes that instant, including the entire dateTo day.
            lt: new Date(new Date(query.dateTo).getTime() + 86400000),
          }),
        },
      }),
    };

    // Promise.all() runs both queries concurrently and waits for all Promises to resolve successfully
    const [posts, total] = await Promise.all([  // Array destructuring: assigns each result to a separate variable

      this.prisma.post.findMany({
        where,                      // Applies the filters defined earlier
        orderBy: {
          [sortBy]: order,          // Dynamic property name: sorts by the field in sortBy, using asc or desc ( [] - computed property name)
        },
        skip,                       // Number of records to skip (pagination)
        take: limit,                // Maximum number of records to retrieve
      }),

      this.prisma.post.count({
        where,                      // Counts all matching posts, ignoring pagination
      }),
    ]);

    // Returns the posts and pagination metadata
    return {
      data: posts,                              // Array of posts retrieved for the current page
      meta: {
        page,                                   // Current page number
        limit,                                  // Maximum number of posts per page
        total,                                  // Total number of matching posts
        totalPages: Math.ceil(total / limit),   // Total pages, rounded up to the next integer
      },
    };
  }

  findPostById(id: number) {
    return this.prisma.post.findUnique({
      where: { id },
    });
  }

  async createPost(createPostDto: CreatePostDto, userId: number) {

    const allowed = await this.rateLimiter.checkLimit(
      `forum_post:${userId}`,   // Key used to identify the rate limit (per user)
      5,                        // Maximum number of allowed requests
      600,                      // Time window in seconds (10 minutes)
    );

    if (!allowed) {
      throw new HttpException(
        'You are posting too frequently. Please wait before creating another post.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const textToAnalyze =
      `${createPostDto.title}\n${createPostDto.content}`;     // Combines title and content into a single string; ${} inserts their values into it

    const moderation =
      this.automaticModerationService.analyzeText(textToAnalyze);

    if (moderation.decision === 'rejected') {
      throw new BadRequestException({
        message: 'Post rejected by automatic moderation',
        moderation,
      });
    }

    const status =
      moderation.decision === 'flagged'
        ? 'pending'
        : 'visible';

    return this.prisma.post.create({
      data: {
        title: createPostDto.title,
        content: createPostDto.content,
        status,
        moderationDecision: moderation.decision,
        moderationScore: moderation.score,
        moderationReasons: moderation.reasons,
        authorId: userId,
      },
    });
  }

  async updatePost(
    id: number,
    updatePostDto: UpdatePostDto,
    userId: number,
  ) {
    const post = await this.prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      throw new NotFoundException(
        `Post with id ${id} not found`,
      );
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException(
        'You can only update your own posts',
      );
    }

    if (post.status === 'removed') {
      throw new ConflictException(
        'Removed posts cannot be edited',
      );
    }

    const updatedTitle =
      updatePostDto.title ?? post.title;

    const updatedContent =
      updatePostDto.content ?? post.content;

    const textToAnalyze =
      `${updatedTitle}\n${updatedContent}`;

    const moderation =
      this.automaticModerationService.analyzeText(textToAnalyze);

    if (moderation.decision === 'rejected') {
      throw new BadRequestException({
        message: 'Post rejected by automatic moderation',
        moderation,
      });
    }

    const status =
      moderation.decision === 'flagged'
        ? 'pending'
        : 'visible';

    return this.prisma.post.update({
      where: { id },
      data: {
        ...updatePostDto,
        status,
        moderationDecision: moderation.decision,
        moderationScore: moderation.score,
        moderationReasons: moderation.reasons,
      },
    });
  }

  async deletePost(
    id: number,
    userId: number,
  ) {
    const post = await this.prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      throw new NotFoundException(
        `Post with id ${id} not found`,
      );
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException(
        'You can only delete your own posts',
      );
    }

    return this.prisma.post.delete({
      where: { id },
    });
  }

  async createComment(
    postId: number,
    createCommentDto: CreateCommentDto,
    userId: number,
  ) {

    const allowed = await this.rateLimiter.checkLimit(
      `forum_comment:${userId}`,  // Key used to identify the rate limit (per user)
      20,                         // Maximum number of allowed requests
      600,                        // Time window in seconds (10 minutes)
    );

    if (!allowed) {
      throw new HttpException(
        'You are commenting too frequently. Please wait before commenting again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException(
        `Post with id ${postId} not found`,
      );
    }

    if (post.status !== 'visible') {
      throw new ConflictException(
        'Comments cannot be added to this post',
      );
    }

    const moderation = this.automaticModerationService.analyzeText(
      createCommentDto.content,
    );

    if (moderation.decision === 'rejected') {
      throw new BadRequestException({
        message: 'Comment rejected by automatic moderation',
        moderation,
      });
    }

    const status =
      moderation.decision === 'flagged'
        ? 'pending'
        : 'visible';

    return this.prisma.comment.create({
      data: {
        content: createCommentDto.content,
        postId,
        status,
        moderationDecision: moderation.decision,
        moderationScore: moderation.score,
        moderationReasons: moderation.reasons,
        authorId: userId,
      },
    });
  }

  findCommentsByPost(postId: number) {
    return this.prisma.comment.findMany({
      where: {
        postId,
        status: 'visible',
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async updateComment(
    id: number,
    updateCommentDto: UpdateCommentDto,
    userId: number,
  ) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      throw new NotFoundException(
        `Comment with id ${id} not found`,
      );
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException(
        'You can only update your own comments',
      );
    }

    if (comment.status === 'removed') {
      throw new ConflictException(
        'Removed comments cannot be edited',
      );
    }

    const updatedContent =
      updateCommentDto.content ?? comment.content;

    const moderation =
      this.automaticModerationService.analyzeText(updatedContent);

    if (moderation.decision === 'rejected') {
      throw new BadRequestException({
        message: 'Comment rejected by automatic moderation',
        moderation,
      });
    }

    const status =
      moderation.decision === 'flagged'
        ? 'pending'
        : 'visible';

    return this.prisma.comment.update({
      where: { id },
      data: {
        ...updateCommentDto,
        status,
        moderationDecision: moderation.decision,
        moderationScore: moderation.score,
        moderationReasons: moderation.reasons,
      },
    });
  }

  async deleteComment(
    id: number,
    userId: number,
  ) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      throw new NotFoundException(
        `Comment with id ${id} not found`,
      );
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException(
        'You can only delete your own comments',
      );
    }

    return this.prisma.comment.delete({
      where: { id },
    });
  }

  async createReport(createReportDto: CreateReportDto, userId: number) {      // user action

    const allowed = await this.rateLimiter.checkLimit(
      `forum_report:${userId}`,   // Key used to identify the rate limit (per user)
      10,                         // Maximum number of allowed requests
      3600,                       // Time window in seconds (1 hour)
    );

    if (!allowed) {
      throw new HttpException(
        'You are submitting too many reports. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (createReportDto.targetType === 'post') {
      const post = await this.prisma.post.findUnique({
        where: { id: createReportDto.targetId },
      });

      if (!post) {
        throw new NotFoundException(
          `Post with id ${createReportDto.targetId} not found`,
        );
      }

      if (post.status !== 'visible') {
        throw new ConflictException(
          'This post is no longer available for reporting',
        );
      }
    }

    if (createReportDto.targetType === 'comment') {
      const comment = await this.prisma.comment.findUnique({
        where: { id: createReportDto.targetId },
      });

      if (!comment) {
        throw new NotFoundException(
          `Comment with id ${createReportDto.targetId} not found`,
        );
      }

      if (comment.status !== 'visible') {
        throw new ConflictException(
          'This comment is no longer available for reporting',
        );
      }
    }

    const existingReport = await this.prisma.report.findFirst({   // Checks for an existing duplicate pending report
      where: {
        reporterId: userId,
        targetType: createReportDto.targetType,
        targetId: createReportDto.targetId,
        status: 'pending',
      },
    });

    if (existingReport) {
      throw new ConflictException(
        'You already have a pending report for this content',
      );
    }

    return this.prisma.report.create({
      data: {
        targetType: createReportDto.targetType,
        targetId: createReportDto.targetId,
        reason: createReportDto.reason,
        reporterId: userId,
      },
    });
  }
}
