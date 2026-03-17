import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HTTPInterceptor, IAuthTokenPayload, IResponseHandlerParams } from 'apps/common';
import { CoursesService } from './courses.service';
import { Controller, Post, Body, Get, Param, UseInterceptors, Delete, Patch, Headers } from '@nestjs/common';
import { CreateCourseDTO, UpdateCourseDTO } from './dto';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Courses')
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Create a course`,
  })
  public async create(@Body() body: CreateCourseDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.coursesService.create(body, tokenPayload);
  }

  @Get(':courseId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Fetch a course`,
  })
  public async fetchById(
    @Param('courseId') courseId: string,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.coursesService.fetchById(courseId, tokenPayload);
  }

  @Patch(':courseId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Update a course`,
  })
  public async updateById(
    @Param('courseId') courseId: string,
    @Body() body: UpdateCourseDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.coursesService.updateById(courseId, body, tokenPayload);
  }

  @Get()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Fetch courses`,
  })
  public async fetchAccount(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.coursesService.fetch(tokenPayload);
  }

  @Delete(':courseId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Delete a course`,
  })
  public async softDelete(
    @Param('courseId') courseId: string,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.coursesService.softDelete(courseId, tokenPayload);
  }
}
