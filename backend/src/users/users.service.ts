import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './create-user.dto';
import * as bcrypt from 'bcrypt';


//@UseGuards(JwtAuthGuard)
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany();
  }

  async create(createUserDto: CreateUserDto) {
    const hash = await bcrypt.hash(createUserDto.password, 10);

    return this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hash,
      },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        wallet: true,
        wins: true,
        losses: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}