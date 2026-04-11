import { BadRequestException, Injectable } from '@nestjs/common';
import { ReturnModelType } from '@typegoose/typegoose';
import { InjectModel } from 'nestjs-typegoose';
import { SSTMailQueue } from 'apps/common/src/database/mongodb/src/superstudy';
import { Accounts } from 'apps/common/src/database/mongodb/src/isms';

@Injectable()
export class MailQueueService {
  constructor(
    @InjectModel(SSTMailQueue)
    private readonly mailQueueModel: ReturnModelType<typeof SSTMailQueue>,
    @InjectModel(Accounts)
    private readonly accountsModel: ReturnModelType<typeof Accounts>,
  ) {}

  private normalizeEmail(value: any): string {
    return String(value ?? '').trim().toLowerCase();
  }

  private getPrimaryEmail(user: any): string {
    const emailAddresses = Array.isArray(user?.emailAddresses) ? user.emailAddresses : [];
    return this.normalizeEmail(user?.email || emailAddresses[0] || '');
  }

  async create(body: Record<string, any>) {
    if (!body?.to || !body?.subject) {
      throw new BadRequestException('to and subject are required');
    }

    const mail = await this.mailQueueModel.create({
      to: body.to,
      subject: body.subject,
      html: body.html || '',
      status: 'pending',
      createdBy: body.createdBy ?? null,
      properties: body.properties ?? null,
      propertiesBranches: body.propertiesBranches ?? null,
    });

    return mail.toObject();
  }

  async createForAdmins(body: Record<string, any>) {
    if (!body?.subject) {
      throw new BadRequestException('subject is required');
    }

    const adminMap = new Map<string, any>();

    for (const admin of await this.accountsModel
      .find({ role: { $in: ['admin', 'staff'] }, deleted: { $ne: true } })
      .lean()) {
      const email = this.getPrimaryEmail(admin);
      if (!email) continue;
      adminMap.set(email, {
        email,
        emailPreferences: admin['emailPreferences'] || {},
      });
    }

    const admins = Array.from(adminMap.values());

    const filteredAdmins = admins.filter((user) => {
      if (!body.notificationType) return true;
      const prefs = user['emailPreferences'] || {};
      return prefs[body.notificationType] !== false;
    });

    if (filteredAdmins.length === 0) {
      return { queuedCount: 0 };
    }

    const docs = filteredAdmins.map((user) => ({
      to: user.email,
      subject: body.subject,
      html: body.html || '',
      status: 'pending',
      createdBy: body.createdBy ?? null,
      properties: body.properties ?? null,
      propertiesBranches: body.propertiesBranches ?? null,
    }));

    const inserted = await this.mailQueueModel.insertMany(docs);
    return { queuedCount: inserted.length };
  }
}
