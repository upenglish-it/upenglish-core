import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { SSTContentProposals } from 'apps/common/src/database/mongodb/src/superstudy';

@Injectable()
export class ContentProposalsService {
  constructor(
    @InjectModel(SSTContentProposals)
    private readonly contentProposalsModel: ReturnModelType<typeof SSTContentProposals>,
  ) {}

  async create(data: Record<string, any>) {
    const proposal = await this.contentProposalsModel.create({
      ...data,
      status: 'pending',
      adminNote: '',
    });
    return proposal.toObject();
  }

  async findAll(query: Record<string, any> = {}) {
    const filters: any = {};
    if (query.status) filters.status = query.status;
    if (query.type) filters.type = query.type;
    if (query.teacherId) filters.teacherId = query.teacherId;
    if (query.sourceId) filters.sourceId = query.sourceId;

    const proposals = await this.contentProposalsModel.find(filters).lean();
    return proposals.sort((a, b) => {
      const tA = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
      const tB = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
      return tB - tA;
    });
  }

  async findOne(id: string) {
    const proposal = await this.contentProposalsModel.findById(id).lean();
    if (!proposal) throw new NotFoundException(`Proposal ${id} not found`);
    return proposal;
  }

  async update(id: string, data: Record<string, any>) {
    const updated = await this.contentProposalsModel
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Proposal ${id} not found`);
    return updated;
  }

  async remove(id: string) {
    const result = await this.contentProposalsModel.findByIdAndDelete(id).lean();
    if (!result) throw new NotFoundException(`Proposal ${id} not found`);
    return { deleted: true };
  }
}
