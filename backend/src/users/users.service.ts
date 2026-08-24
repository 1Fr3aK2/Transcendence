import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './create-user.dto';
import * as bcrypt from 'bcrypt';
import { Prisma, Role } from '@prisma/client';


//@UseGuards(JwtAuthGuard)
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
  return this.prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
	  role: true,
      avatar: true,
      wallet: true,
      wins: true,
      losses: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

  async create(createUserDto: CreateUserDto) {
    const hash = await bcrypt.hash(createUserDto.password, 10);

	try {
		return await this.prisma.user.create({
		  data: {
			...createUserDto,
			password: hash,
		  },
		  select: {
			id: true,
			username: true,
			email: true,
			role: true,
			avatar: true,
			wallet: true,
			wins: true,
			losses: true,
			createdAt: true,
			updatedAt: true,
		  },
		});
	  } catch (error) {
		if (
		  error instanceof Prisma.PrismaClientKnownRequestError &&
		  error.code === 'P2002'
		) {
		  throw new ConflictException('Username or email already exists');
		}
  
		throw error;
	  }
	}

  async updateRole(
    userId: number,
    role: Role,
  ) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException(
        `User with id ${userId} not found`,
      );
    }

    if (user.role === Role.ADMIN) {
      throw new BadRequestException(
        'Admin role cannot be changed through this endpoint',
      );
    }

    if (role !== Role.USER && role !== Role.MODERATOR) {
      throw new BadRequestException(
        'Role must be USER or MODERATOR',
      );
    }

    return this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        role,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
      },
    });
  }
}