import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { UpdateUserRoleDto } from '../users/update-user-role.dto';
import { AdminApiKeyGuard } from './admin-api-key.guard';

@UseGuards(AdminApiKeyGuard)
@Controller('api/admin')
export class PublicApiController {

  constructor(private readonly usersService: UsersService) {}

  @Get('users')
  getUsers() {
    return this.usersService.findAll();
  }

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
}
