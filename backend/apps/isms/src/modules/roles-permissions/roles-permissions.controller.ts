import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HTTPInterceptor, IResponseHandlerParams } from 'apps/common';
import { RolesPermissionsService } from './roles-permissions.service';
import { Controller, Post, Body, Req, Get, Param, UseInterceptors, Delete } from '@nestjs/common';
import { CreateRolePermissionDTO } from './dto';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Roles Permissions')
@Controller('roles-permissions')
export class RolesPermissionsController {
  constructor(private readonly rolesPermissionsService: RolesPermissionsService) {}

  @Post()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Create a roles permissions`,
  })
  public async create(@Body() body: CreateRolePermissionDTO, @Req() req: Request): Promise<IResponseHandlerParams> {
    return await this.rolesPermissionsService.create(body, req.headers['data']);
  }

  @Get()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Fetch roles permissions`,
  })
  public async fetch(@Req() req: Request): Promise<IResponseHandlerParams> {
    return await this.rolesPermissionsService.fetch(req.headers['data']);
  }

  @Get('by-id/:rolePermissionId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Fetch roles permissions by id`,
  })
  public async fetchById(@Param('rolePermissionId') rolePermissionId: string, @Req() req: Request): Promise<IResponseHandlerParams> {
    return await this.rolesPermissionsService.fetchById(rolePermissionId, req.headers['data']);
  }

  @Delete(':rolePermissionId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Delete a role permission`,
  })
  public async softDelete(@Param('rolePermissionId') rolePermissionId: string, @Req() req: Request): Promise<IResponseHandlerParams> {
    return await this.rolesPermissionsService.softDelete(rolePermissionId, req.headers['data']);
  }

  @Get('defined')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Fetch defined roles permissions`,
  })
  public async defined(): Promise<IResponseHandlerParams> {
    return await this.rolesPermissionsService.defined();
  }
}
