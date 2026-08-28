import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateUserRoleDto {
  @ApiProperty({
    enum: [Role.USER, Role.MODERATOR],
    example: Role.MODERATOR,
  })
  @IsIn([Role.USER, Role.MODERATOR])
  role: Role;
}
