import { IsIn } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateUserRoleDto {
  @IsIn([Role.USER, Role.MODERATOR])
  role: Role;
}
