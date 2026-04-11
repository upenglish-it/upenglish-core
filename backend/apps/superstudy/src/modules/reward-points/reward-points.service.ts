import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { SSTRewardPointHistory, SSTRewardPoints } from 'apps/common/src/database/mongodb/src/superstudy';

@Injectable()
export class RewardPointsService {
  constructor(
    @InjectModel(SSTRewardPoints)
    private readonly model: ReturnModelType<typeof SSTRewardPoints>,
    @InjectModel(SSTRewardPointHistory)
    private readonly historyModel: ReturnModelType<typeof SSTRewardPointHistory>,
  ) {}

  private normalizeRewardPoint(doc: any) {
    return {
      id: doc._id,
      ...doc,
      userId: doc.userId || doc._id,
    };
  }

  private findRewardPointDoc(userId: string) {
    return this.model.findOne({ $or: [{ userId }, { _id: userId }] });
  }

  private async ensureRewardPointDoc(
    userId: string,
    displayName = '',
    metadata: { createdBy?: string; properties?: string; propertiesBranches?: string } = {},
  ) {
    let doc = await this.findRewardPointDoc(userId);
    if (doc) return doc;

    doc = await this.model.create({
      _id: userId,
      userId,
      displayName,
      points: 0,
      migratedAt: null,
      createdBy: metadata.createdBy ?? null,
      properties: metadata.properties ?? null,
      propertiesBranches: metadata.propertiesBranches ?? null,
    });

    return doc;
  }

  async findAll(filters: Record<string, any> = {}) {
    const query: Record<string, any> = {};
    for (const [key, val] of Object.entries(filters)) {
      if (val !== undefined && val !== null && val !== '') query[key] = val;
    }
    const docs = await this.model.find(query).sort({ createdAt: -1 }).lean();
    return docs.map(d => this.normalizeRewardPoint(d));
  }

  async findById(id: string) {
    const doc = await this.findRewardPointDoc(id).lean();
    if (!doc) {
      return {
        id,
        userId: id,
        displayName: '',
        points: 0,
      };
    }
    return this.normalizeRewardPoint(doc);
  }

  async create(body: Record<string, any>) {
    const payload = {
      ...body,
      userId: body.userId || body._id || null,
      points: Number(body.points ?? 0),
    };
    const doc = await this.model.create(payload);
    return this.normalizeRewardPoint(doc.toObject());
  }

  async update(id: string, body: Record<string, any>) {
    const setFields: Record<string, any> = {};
    const unsetFields: Record<string, any> = {};
    for (const [key, val] of Object.entries(body)) {
      if (val === null) unsetFields[key] = '';
      else setFields[key] = val;
    }
    const update: Record<string, any> = {};
    if (Object.keys(setFields).length) update['$set'] = setFields;
    if (Object.keys(unsetFields).length) update['$unset'] = unsetFields;
    const existing = await this.findRewardPointDoc(id);
    if (!existing) throw new NotFoundException('Not found');
    const doc = await this.model.findByIdAndUpdate(existing._id, update, { new: true }).lean();
    if (!doc) throw new NotFoundException('Not found');
    return this.normalizeRewardPoint(doc);
  }

  async remove(id: string) {
    const existing = await this.findRewardPointDoc(id);
    if (!existing) throw new NotFoundException('Not found');
    const doc = await this.model.findByIdAndDelete(existing._id).lean();
    if (!doc) throw new NotFoundException('Not found');
    return { success: true };
  }

  async getHistory(userId: string) {
    const docs = await this.historyModel.find({ userId }).sort({ createdAt: -1 }).lean();
    return docs.map(doc => ({ id: doc._id, ...doc }));
  }

  async addPoints(userId: string, body: Record<string, any>) {
    const amount = Number(body.amount ?? 0);
    if (!amount || amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    const doc = await this.ensureRewardPointDoc(userId, body.displayName || '', body);
    const nextPoints = Number(doc.points || 0) + amount;

    await this.model.findByIdAndUpdate(doc._id, {
      $set: {
        userId,
        displayName: body.displayName || doc.displayName || '',
        points: nextPoints,
        createdBy: doc.createdBy ?? body.createdBy ?? null,
        properties: doc.properties ?? body.properties ?? null,
        propertiesBranches: doc.propertiesBranches ?? body.propertiesBranches ?? null,
      },
    });

    await this.historyModel.create({
      userId,
      type: 'earn',
      amount,
      reason: body.reason || '',
      groupId: body.groupId || '',
      groupName: body.groupName || '',
      createdBy: body.createdBy || null,
      properties: body.properties || null,
      propertiesBranches: body.propertiesBranches || null,
    });

    return { userId, points: nextPoints };
  }

  async subtractPoints(userId: string, body: Record<string, any>) {
    const amount = Number(body.amount ?? 0);
    if (!amount || amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    const doc = await this.ensureRewardPointDoc(userId, body.displayName || '', body);
    const nextPoints = Math.max(0, Number(doc.points || 0) - amount);

    await this.model.findByIdAndUpdate(doc._id, {
      $set: {
        userId,
        displayName: body.displayName || doc.displayName || '',
        points: nextPoints,
        createdBy: doc.createdBy ?? body.createdBy ?? null,
        properties: doc.properties ?? body.properties ?? null,
        propertiesBranches: doc.propertiesBranches ?? body.propertiesBranches ?? null,
      },
    });

    await this.historyModel.create({
      userId,
      type: 'deduct',
      amount,
      reason: body.reason || '',
      groupId: body.groupId || '',
      groupName: body.groupName || '',
      createdBy: body.createdBy || null,
      properties: body.properties || null,
      propertiesBranches: body.propertiesBranches || null,
    });

    return { userId, points: nextPoints };
  }

  async redeemGift(userId: string, body: Record<string, any>) {
    const amount = Number(body.amount ?? 0);
    if (!amount || amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    const doc = await this.findRewardPointDoc(userId);
    if (!doc) {
      throw new NotFoundException('Reward points not found');
    }

    const currentPoints = Number(doc.points || 0);
    if (currentPoints < amount) {
      throw new BadRequestException(`Không đủ điểm! Hiện có ${currentPoints} điểm, cần ${amount} điểm.`);
    }

    const nextPoints = currentPoints - amount;
    await this.model.findByIdAndUpdate(doc._id, {
      $set: {
        userId,
        displayName: body.displayName || doc.displayName || '',
        points: nextPoints,
      },
    });

    await this.historyModel.create({
      userId,
      type: 'redeem',
      amount,
      giftName: body.giftName || '',
      groupId: body.groupId || '',
      groupName: body.groupName || '',
      createdBy: body.createdBy || null,
      properties: body.properties || null,
      propertiesBranches: body.propertiesBranches || null,
    });

    return { userId, points: nextPoints };
  }

}
