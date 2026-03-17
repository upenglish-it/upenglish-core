import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IResponseHandlerParams, ResponseHandlerService, STATUS_CODE } from 'apps/common';
import { Controller, HttpStatus, Post } from '@nestjs/common';
import { MigrationsService } from './migrations.service';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Migrations')
@Controller('migrations')
export class MigrationsController {
  constructor(private readonly migrationsService: MigrationsService) {}

  @Post('migrate')
  @ApiOperation({ summary: `Migrate data from sheet to database` })
  public async migrate(): Promise<IResponseHandlerParams> {
    this.migrationsService.migrate();
    return ResponseHandlerService({
      success: true,
      httpCode: HttpStatus.OK,
      statusCode: STATUS_CODE.OK,
      message: 'Migrations initiated successfully',
    });
  }

  @Post('migrate-data')
  @ApiOperation({ summary: `Migrate data from sheet to database` })
  public async migrateData(): Promise<IResponseHandlerParams> {
    this.migrationsService.migrateData();
    return ResponseHandlerService({
      success: true,
      httpCode: HttpStatus.OK,
      statusCode: STATUS_CODE.OK,
      message: 'Data migrated successfully',
    });
  }
}
