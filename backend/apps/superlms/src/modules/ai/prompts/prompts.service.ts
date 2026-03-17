import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { isEmpty } from 'lodash';
import { CreatePromptDTO, UpdateByIdPromptDTO } from './dto';
import { STATUS_CODE, IELTSPrompts, IAuthTokenPayload, IResponseHandlerParams, ResponseHandlerService } from 'apps/common';

@Injectable()
export class PromptsService {
  constructor(@InjectModel(IELTSPrompts) private readonly prompts: ReturnModelType<typeof IELTSPrompts>) {}

  public async create(body: CreatePromptDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const createdPrompt = await this.prompts.create({
        name: body.name,
        provider: body.provider,
        model: body.model,
        apiKey: body.apiKey,
        message: body.message,
        createdBy: tokenPayload.accountId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });
      console.log('createdPrompt', createdPrompt);
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Successfully created',
        data: createdPrompt,
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }

  public async getAll(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const prompts = await this.prompts.find({ properties: tokenPayload.propertyId }).sort({ createdAt: -1 });

      if (isEmpty(prompts)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: prompts,
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }

  public async getById(promptId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const prompt = await this.prompts.findOne({ _id: promptId, properties: tokenPayload.propertyId });

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: prompt,
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }

  public async updateById(promptId: string, body: UpdateByIdPromptDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      await this.prompts.findOneAndUpdate({ _id: promptId, properties: tokenPayload.propertyId }, { $set: body }, { new: true });

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Successfully updated',
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }
}
