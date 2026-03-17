import { HttpStatus, Injectable } from '@nestjs/common';
import { CreateMaterialDTO, UpdateMaterialDTO } from './dto';
import { IAuthTokenPayload, IResponseHandlerParams, ResponseHandlerService, Materials, STATUS_CODE } from 'apps/common';
import { ReturnModelType } from '@typegoose/typegoose';
import { InjectModel } from 'nestjs-typegoose';
import { isEmpty } from 'lodash';

@Injectable()
export class MaterialsService {
  constructor(@InjectModel(Materials) private readonly materials: ReturnModelType<typeof Materials>) {}

  public async create(body: CreateMaterialDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const material = await this.materials.create({
        name: body.name.trim(),
        price: body.price,
        quantity: body.quantity,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Materials was created',
        data: material,
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

  public async update(materialId: string, body: UpdateMaterialDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const material = await this.materials.findOneAndUpdate(
        {
          _id: materialId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        },
        {
          name: body.name,
          price: body.price,
          quantity: body.quantity,
        },
        { new: true },
      );
      if (isEmpty(material)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Material was updated successfully',
        data: material,
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

  public async fetch(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const materials = await this.materials
        .find({
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
          deleted: false,
        })
        .sort({ createdAt: -1 });

      if (isEmpty(materials)) {
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
        data: materials,
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

  public async fetchById(materialId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const material = await this.materials.findOne({
        _id: materialId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
        deleted: false,
      });

      if (isEmpty(material)) {
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
        data: material,
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

  public async softDelete(materialId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      await this.materials.updateOne(
        {
          _id: materialId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        },
        { deleted: true },
      );
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_DELETED,
        message: 'Material has been deleted',
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

  // when we update the classes status to finished, then all the `students-tuition-attendance` status need to updated too
}
