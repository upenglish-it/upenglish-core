import { Controller, HttpCode, HttpStatus, Headers, Get, UseInterceptors, Body, Post, Param, Patch, Delete, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IAuthTokenPayload, IResponseHandlerParams } from 'apps/common';
import { HTTPInterceptor } from 'apps/common';
import {
  AddPeriodDTO,
  AddSectionDTO,
  GetStudentTestDetailsDTO,
  GetTestOfClassDTO,
  UpdateDescriptionDTO,
  UpdatePeriodNameDTO,
  UpdateSectionNameDTO,
  UpdateStatusDTO,
} from './dto';
import { JoiPipe } from 'nestjs-joi';
import { TestsOfClassService } from './tests-of-class.service';
import { AddTestDTO } from './dto/src/periods-sections-tests.dto';
import { AddRedflagDTO, GetRedflagsDTO } from './dto/src/red-flags.dto';
import { AddAnnouncementDTO, GetAnnouncementByIdDTO } from './dto/src/announcements.dto';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Tests of Class')
@Controller('tests-of-class')
export class TestsOfClassController {
  constructor(private readonly testsOfClassService: TestsOfClassService) {}

  @Get('test-of-class')
  @UseInterceptors(HTTPInterceptor)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: `When admin/teacher wants to view the test of a class` })
  public async getTestOfClass(
    @Query(JoiPipe) query: GetTestOfClassDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.testsOfClassService.getTestOfClass(query, tokenPayload);
  }

  @Get('student-test-details')
  @UseInterceptors(HTTPInterceptor)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: `Fetch student test details` })
  public async getStudentTestDetails(
    @Query(JoiPipe) query: GetStudentTestDetailsDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.testsOfClassService.getStudentTestDetails(query, tokenPayload);
  }

  @Get('student/classes')
  @UseInterceptors(HTTPInterceptor)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: `Fetch the student classes` })
  public async studentClasses(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.testsOfClassService.studentClasses(tokenPayload);
  }

  @Get('admin/class-for-courses')
  @UseInterceptors(HTTPInterceptor)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: `Fetch the teacher assigned classes for my courses` })
  public async teacherClassForCourses(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.testsOfClassService.teacherClassForCourses(tokenPayload);
  }

  @Get('teacher/classes')
  @UseInterceptors(HTTPInterceptor)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: `Fetch the teacher classes` })
  public async teacherClasses(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.testsOfClassService.teacherClasses(tokenPayload);
  }

  @Get('teacher/assigned-class-for-my-courses')
  @UseInterceptors(HTTPInterceptor)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: `Fetch the teacher assigned classes for my courses` })
  public async teacherAssignedClassForMyCourses(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.testsOfClassService.teacherAssignedClassForMyCourses(tokenPayload);
  }

  @Get('admin/courses')
  @UseInterceptors(HTTPInterceptor)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: `Fetch the admin courses` })
  public async adminCourses(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.testsOfClassService.adminCourses(tokenPayload);
  }

  @Get('admin/classes')
  @UseInterceptors(HTTPInterceptor)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: `Fetch the admin classes` })
  public async adminClasses(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.testsOfClassService.adminClasses(tokenPayload);
  }

  @Patch('status')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Update status` })
  public async updateStatus(
    @Body(JoiPipe) body: UpdateStatusDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.testsOfClassService.updateStatus(body, tokenPayload);
  }

  @Patch('description')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Update description` })
  public async updateDescription(
    @Body(JoiPipe) body: UpdateDescriptionDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.testsOfClassService.updateDescription(body, tokenPayload);
  }

  @Post('periods')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Add periods` })
  public async addPeriod(
    @Body(JoiPipe) body: AddPeriodDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.testsOfClassService.addPeriod(body, tokenPayload);
  }

  @Get('red-flags')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Get red-flags` })
  public async getRedflags(
    @Query(JoiPipe) query: GetRedflagsDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.testsOfClassService.redflags(query, tokenPayload);
  }

  @Post('red-flags')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Add redflags` })
  public async addRedflag(
    @Body(JoiPipe) body: AddRedflagDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.testsOfClassService.addRedflag(body, tokenPayload);
  }

  @Get('announcements')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Get announcements` })
  public async getAnnouncements(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.testsOfClassService.announcements(tokenPayload);
  }

  @Get('announcement/by-id')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Get announcement by id` })
  public async getAnnouncementById(
    @Query(JoiPipe) query: GetAnnouncementByIdDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.testsOfClassService.announcementById(query, tokenPayload);
  }

  @Post('announcement')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Add announcement` })
  public async addAnnouncement(
    @Body(JoiPipe) body: AddAnnouncementDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.testsOfClassService.addAnnouncement(body, tokenPayload);
  }

  @Delete('announcement/:announcementId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Delete announcement` })
  public async deleteAnnouncement(
    @Param('announcementId') announcementId: string,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.testsOfClassService.deleteAnnouncementById(announcementId, tokenPayload);
  }

  @Patch('periods/:periodId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Update a period by id` })
  public async updatePeriodName(
    @Param('periodId') periodId: string,
    @Body(JoiPipe) body: UpdatePeriodNameDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.testsOfClassService.updatePeriodName(periodId, body, tokenPayload);
  }

  @Post('periods/:periodId/sections')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Add sections to a period` })
  public async addSection(
    @Param('periodId') periodId: string,
    @Body(JoiPipe) body: AddSectionDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.testsOfClassService.addSection(periodId, body, tokenPayload);
  }

  @Patch('sections/:sectionId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Update a section by id` })
  public async updateSectionName(
    @Param('sectionId') sectionId: string,
    @Body(JoiPipe) body: UpdateSectionNameDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.testsOfClassService.updateSectionName(sectionId, body, tokenPayload);
  }

  @Post('periods/:periodId/sections/:sectionId/tests')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Add tests to a section` })
  public async addTest(
    @Param('periodId') periodId: string,
    @Param('sectionId') sectionId: string,
    @Body(JoiPipe) body: AddTestDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.testsOfClassService.addTest(periodId, sectionId, body, tokenPayload);
  }

  @Delete('periods/:periodId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Delete a period` })
  public async deletePeriod(
    @Param('periodId') periodId: string,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.testsOfClassService.deletePeriod(periodId, tokenPayload);
  }

  @Delete('periods/:periodId/sections/:sectionId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Delete a section from a period` })
  public async deleteSection(
    @Param('periodId') periodId: string,
    @Param('sectionId') sectionId: string,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.testsOfClassService.deleteSection(periodId, sectionId, tokenPayload);
  }

  @Delete('periods/:periodId/sections/:sectionId/tests/:testId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Delete a test from a section` })
  public async deleteTest(
    @Param('periodId') periodId: string,
    @Param('sectionId') sectionId: string,
    @Param('testId') testId: string,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.testsOfClassService.deleteTest(periodId, sectionId, testId, tokenPayload);
  }

  @Patch('periods/:periodId/sections/:sectionId/reset')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Reset the tests of a section` })
  public async resetTests(
    @Param('periodId') periodId: string,
    @Param('sectionId') sectionId: string,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.testsOfClassService.resetTests(periodId, sectionId, tokenPayload);
  }

  // @Patch(':taskId')
  // @UseInterceptors(HTTPInterceptor)
  // @ApiOperation({ summary: `Update a task by id` })
  // public async updateById(
  //   @Param('taskId') taskId: string,
  //   @Body(JoiPipe) body: UpdateByIdTaskDTO,
  //   @Headers('token-payload') tokenPayload: IAuthTokenPayload
  // ): Promise<IResponseHandlerParams> {
  //   return await this.testsOfClassService.updateById(taskId, body, tokenPayload);
  // }

  @Get('students/pending-reviews')
  @UseInterceptors(HTTPInterceptor)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fetch total pending reviews for all students.' })
  public async getTotalPendingReviewsForAllStudents(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.testsOfClassService.getTotalPendingReviewsForAllStudents(tokenPayload);
  }
}
