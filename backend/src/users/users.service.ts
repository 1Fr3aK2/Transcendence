import {
	Injectable,
	ConflictException,
	NotFoundException,
  } from '@nestjs/common';
  
  import { PrismaService } from '../prisma/prisma.service';
  import { CreateUserDto } from './create-user.dto';
  import { UpdateUserDto } from './update-user.dto';
  
  import * as bcrypt from 'bcrypt';
  import { Prisma } from '@prisma/client';
  
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
  
	async findOne(id: number) {
	  const user = await this.prisma.user.findUnique({
		where: { id },
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
  
	  if (!user) {
		throw new NotFoundException('User not found');
	  }
  
	  return user;
	}
  
	async create(createUserDto: CreateUserDto) {
		const hash = await bcrypt.hash(createUserDto.password, 10);
	  
		try {
		  return await this.prisma.user.create({
			data: {
			  username: createUserDto.username,
			  email: createUserDto.email,
			  password: hash,
			  wallet: createUserDto.wallet ?? 0,
			  avatar: createUserDto.avatar,
			  role: 'USER',
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
			throw new ConflictException(
			  'Username or email already exists',
			);
		  }
	  
		  throw error;
		}
	  }
  
	async update(id: number, dto: UpdateUserDto) {
		const data: Prisma.UserUpdateInput = {
		  username: dto.username,
		  email: dto.email,
		  avatar: dto.avatar,
		};
	  
		if (dto.password) {
		  data.password = await bcrypt.hash(dto.password, 10);
		}
	  
		try {
		  return await this.prisma.user.update({
			where: { id },
			data,
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
  
	async remove(id: number) {
	  try {
		return await this.prisma.user.delete({
		  where: { id },
		  select: {
			id: true,
			username: true,
			email: true,
			role: true,
		  },
		});
	  } catch (error) {
		if (
		  error instanceof Prisma.PrismaClientKnownRequestError &&
		  error.code === 'P2025'
		) {
		  throw new NotFoundException('User not found');
		}
  
		throw error;
	  }
	}
  }