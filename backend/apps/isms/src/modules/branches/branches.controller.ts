import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HTTPInterceptor, IAuthTokenPayload, IResponseHandlerParams } from 'apps/common';
import { BranchesService } from './branches.service';
import { Controller, Post, Body, Req, Get, Param, Headers, UseInterceptors, Patch, Delete } from '@nestjs/common';
import { CreateBranchDTO, SwitchBranchDTO } from './dto';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Branches')
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Fetch branches`,
  })
  public async fetchAccount(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.branchesService.fetch(tokenPayload);
  }

  @Get('assigned')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Assigned branches`,
  })
  public async assigned(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.branchesService.assigned(tokenPayload);
  }

  @Post()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Create a branch`,
  })
  public async create(@Body() body: CreateBranchDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.branchesService.create(body, tokenPayload);
  }

  @Patch(':id')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Update a branch`,
  })
  public async update(
    @Param('id') id: string,
    @Body() body: CreateBranchDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.branchesService.update(id, body, tokenPayload);
  }

  @Patch(':id/set-primary')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Update a branch`,
  })
  public async setPrimary(@Param('id') id: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.branchesService.setPrimary(id, tokenPayload);
  }

  @Post('switch')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Switch branch`,
  })
  public async switch(
    @Body() body: SwitchBranchDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload,
    @Req() request: Request
  ): Promise<IResponseHandlerParams> {
    return await this.branchesService.switch(body, tokenPayload, request);
  }

  @Delete(':id')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Delete a branch`,
  })
  public async delete(@Param('id') id: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.branchesService.delete(id, tokenPayload);
  }

  @Post(':id/undo')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Delete a branch`,
  })
  public async undo(@Param('id') id: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.branchesService.undo(id, tokenPayload);
  }
}
