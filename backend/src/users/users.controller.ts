import { UsersService } from './users.service';
import { CreateUserDto } from './create-user.dto';
import { UpdateUserDto } from './update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth-guard';
import { RolesGuard } from 'src/auth/roles/roles.guard';
import { Roles } from 'src/auth/roles/roles.decorator';
import {
	Body,
	Controller,
	Get,
	Param,
	Post,
	Patch,
	Delete,
	UseGuards,
  } from '@nestjs/common';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('ADMIN')
	@Get()
	findAll() {
	  return this.usersService.findAll();
	}	
	@Post()
	create(@Body() createUserDto: CreateUserDto) {
	  return this.usersService.create(createUserDto);
	}

	@Get(':id')
	@UseGuards(JwtAuthGuard)
	findOne(@Param('id') id: string) {
	  return this.usersService.findOne(Number(id));
	}

	@Patch(':id')
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('ADMIN')
	update(
	  @Param('id') id: string,
	  @Body() dto: UpdateUserDto,
	) {
	  return this.usersService.update(Number(id), dto);
	}

	@Delete(':id')
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('ADMIN')
	remove(@Param('id') id: string) {
	  return this.usersService.remove(Number(id));
	}
}