import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HTTPInterceptor, IAuthTokenPayload, IResponseHandlerParams } from 'apps/common';
import { ClassesService } from './classes.service';
import { Controller, Post, Body, Get, Param, UseInterceptors, Delete, Patch, Headers, Query } from '@nestjs/common';
import { CreateClassDTO, FetchClassDTO, SetVersionClassTuitionPaymentDTO, UpdateClassDTO, CreateDraftTuitionDTO, FetchDraftTuitionDTO } from './dto';
import {
  AttendanceStudentsInClassDTO,
  BreakdownOfClassDTO,
  ClassPricingDTO,
  EnrollStudentToClassDTO,
  MarkAttendanceDTO,
  RefundClassDTO,
  StopLearningDTO,
  StudentClassDebtsDTO,
  TuitionStudentsInClassDTO,
} from './dto/src/enroll-student.dto';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Classes')
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Create a class`,
  })
  public async create(@Body() body: CreateClassDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.classesService.create(body, tokenPayload);
  }

  @Patch(':classId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Update a class` })
  public async updateById(
    @Param('classId') classId: string,
    @Body() body: UpdateClassDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.classesService.updateById(classId, body, tokenPayload);
  }

  @Get()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch classes` })
  public async fetch(@Query() query: FetchClassDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.classesService.fetch(query, tokenPayload);
  }

  @Get('by-id/:classId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch class` })
  public async fetchById(
    @Param('classId') classId: string,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.classesService.fetchById(classId, tokenPayload);
  }

  @Delete(':classId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Delete a course` })
  public async softDelete(
    @Param('classId') classId: string,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.classesService.softDelete(classId, tokenPayload);
  }

  @Post('enroll')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Enroll student to a class` })
  public async enrollToClass(
    @Body() body: EnrollStudentToClassDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.classesService.enrollToClass(body, tokenPayload);
  }

  @Post('set-version/:studentClassId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Set version` })
  public async setVersion(
    @Param('studentClassId') studentClassId: string,
    @Body() body: SetVersionClassTuitionPaymentDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.classesService.setVersion(body, studentClassId, tokenPayload);
  }

  @Get('versions/:studentClassId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Changelog versions` })
  public async undo(
    @Param('studentClassId') studentClassId: string,
    @Body() body: SetVersionClassTuitionPaymentDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.classesService.setVersion(body, studentClassId, tokenPayload);
  }

  @Patch('stop-learning/:studentTuitionAttendanceId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Stop student class learning` })
  public async stopLearning(
    @Param('studentTuitionAttendanceId') studentTuitionAttendanceId: string,
    @Body() body: StopLearningDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.classesService.stopLearning(body, studentTuitionAttendanceId, tokenPayload);
  }

  // @Get('stop-learning-accumulated/:studentClassId')
  // @UseInterceptors(HTTPInterceptor)
  // @ApiOperation({ summary: `Get the accumulated when the student the class learning` })
  // public async stopLearningAccumulated(
  //   @Param('studentClassId') studentClassId: string,
  //   @Body() body: StopLearningAccumulatedDTO,
  //   @Headers('token-payload') tokenPayload: IAuthTokenPayload,
  // ): Promise<IResponseHandlerParams> {
  //   return await this.classesService.stopLearningAccumulated(body, studentClassId, tokenPayload);
  // }

  @Post('pricing')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch class pricing` })
  public async classPricing(
    @Body() body: ClassPricingDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.classesService.classPricing(body, tokenPayload);
  }

  @Post('mark-attendance')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Mark attendance` })
  public async markAttendance(
    @Body() body: MarkAttendanceDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.classesService.markAttendance(body, tokenPayload);
  }

  @Get('tuition/students')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch students for tuition` })
  public async tuitionStudents(
    @Query() query: TuitionStudentsInClassDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.classesService.tuitionStudents(query, tokenPayload);
  }

  @Get('attendance/students')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch students for attendance` })
  public async attendanceStudents(
    @Query() query: AttendanceStudentsInClassDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.classesService.attendanceStudents(query, tokenPayload);
  }

  @Get('breakdown')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Class breakdown` })
  public async breakdown(
    @Query() query: BreakdownOfClassDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.classesService.breakdown(query, tokenPayload);
  }

  @Get('student-class-debts')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Student class debts` })
  public async studentClassDebts(
    @Query() query: StudentClassDebtsDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.classesService.studentClassDebts(query, tokenPayload);
  }

  @Get('student-classes')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch student classes` })
  public async fetchStudentClasses(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.classesService.fetchStudentClasses(tokenPayload);
  }

  @Get('savings-breakdown/:studentId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch student savings breakdown` })
  public async fetchSavingsBreakdown(
    @Param('studentId') studentId: string,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.classesService.fetchSavingsBreakdown(studentId, tokenPayload);
  }

  @Get('savings/:studentId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch student savings` })
  public async fetchSavings(
    @Param('studentId') studentId: string,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.classesService.fetchSavings(studentId, tokenPayload);
  }

  @Post('refund')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Make a refund` })
  public async refund(@Body() body: RefundClassDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.classesService.refund(body, tokenPayload);
  }

  @Get('draft-tuition/students')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch students draft tuition` })
  public async fetchDraftTuitionStudents(
    @Query() query: FetchDraftTuitionDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.classesService.fetchDraftTuitionStudents(query, tokenPayload);
  }

  @Post('draft-tuition/students')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch students for draft tuition` })
  public async createDraftTuitionStudents(
    @Body() body: CreateDraftTuitionDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.classesService.createDraftTuitionStudents(body, tokenPayload);
  }

  @Delete('draft-tuition/students/:id')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch students for draft tuition` })
  public async deleteDraftTuitionStudents(
    @Param('id') id: string,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.classesService.deleteDraftTuitionStudents(id, tokenPayload);
  }
}
