import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminIdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminId(): Promise<number> {
    const adminEmail = process.env.ADMIN_EMAIL;

    if (!adminEmail) {
      throw new InternalServerErrorException(
        'Admin email is not configured',
      );
    }

    const admin = await this.prisma.user.findUnique({
      where: {
        email: adminEmail,
      },
    });

    if (!admin || admin.role !== Role.ADMIN) {
      throw new InternalServerErrorException(
        'Configured admin user was not found',
      );
    }

    return admin.id;
  }
}
