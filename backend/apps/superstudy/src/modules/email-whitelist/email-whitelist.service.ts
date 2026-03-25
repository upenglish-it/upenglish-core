import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { SSTEmailWhitelist } from 'apps/common/src/database/mongodb/src/superstudy';

@Injectable()
export class EmailWhitelistService {
  constructor(
    @InjectModel(SSTEmailWhitelist)
    private readonly whitelistModel: ReturnModelType<typeof SSTEmailWhitelist>,
  ) {}

  /**
   * List whitelist entries, optionally filtered by role or used status
   */
  async findAll(filters: { role?: string; used?: boolean }) {
    const query: Record<string, any> = {};
    if (filters.role) query.role = filters.role;
    if (filters.used !== undefined) query.used = filters.used;

    const entries = await this.whitelistModel.find(query).lean();
    return entries.sort((a, b) => {
      const tA = a['createdAt'] ? new Date(a['createdAt']).getTime() : 0;
      const tB = b['createdAt'] ? new Date(b['createdAt']).getTime() : 0;
      return tB - tA; // newest first
    });
  }

  async findOne(id: string) {
    const entry = await this.whitelistModel.findById(id).lean();
    if (!entry) throw new NotFoundException(`Whitelist entry ${id} not found`);
    return entry;
  }

  /**
   * Check if an email is on the whitelist (case-insensitive)
   * Returns the entry or null — used by the registration flow
   * Equivalent checking emails in the original Firestore admin whitelist collection
   */
  async checkEmail(email: string) {
    if (!email) return null;
    const entry = await this.whitelistModel
      .findOne({ email: email.toLowerCase().trim() })
      .lean();
    return entry ?? null;
  }

  /**
   * Add a new email to the whitelist
   * Enforces uniqueness on email (case-insensitive)
   */
  async create(data: Record<string, any>) {
    const normalizedEmail = (data.email || '').toLowerCase().trim();
    const existing = await this.whitelistModel.findOne({ email: normalizedEmail });
    if (existing) {
      throw new ConflictException(`Email "${normalizedEmail}" is already in the whitelist`);
    }

    const entry = await this.whitelistModel.create({
      ...data,
      email: normalizedEmail,
      used: false,
      addedAt: new Date().toISOString(),
    });
    return entry.toObject();
  }

  /**
   * Bulk-add multiple emails at once
   * Skips duplicates and returns a summary
   */
  async bulkCreate(items: Record<string, any>[]) {
    const added: string[] = [];
    const skipped: string[] = [];

    for (const item of items) {
      const email = (item.email || '').toLowerCase().trim();
      if (!email) continue;

      const existing = await this.whitelistModel.findOne({ email });
      if (existing) {
        skipped.push(email);
        continue;
      }

      await this.whitelistModel.create({
        ...item,
        email,
        used: false,
        addedAt: new Date().toISOString(),
      });
      added.push(email);
    }

    return { added: added.length, skipped: skipped.length, addedEmails: added, skippedEmails: skipped };
  }

  async update(id: string, data: Record<string, any>) {
    // Ensure email stays normalized if being updated
    if (data.email) data.email = data.email.toLowerCase().trim();

    const updated = await this.whitelistModel
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Whitelist entry ${id} not found`);
    return updated;
  }

  /**
   * Mark an entry as "used" when the corresponding user registers
   * Called by the registration/user-approval flow
   */
  async markUsed(id: string) {
    const updated = await this.whitelistModel
      .findByIdAndUpdate(id, { $set: { used: true, usedAt: new Date() } }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Whitelist entry ${id} not found`);
    return updated;
  }

  /**
   * Mark a whitelist entry as used by email (used internally by registration)
   */
  async markUsedByEmail(email: string) {
    const normalizedEmail = email.toLowerCase().trim();
    return this.whitelistModel
      .findOneAndUpdate(
        { email: normalizedEmail },
        { $set: { used: true, usedAt: new Date() } },
        { new: true },
      )
      .lean();
  }

  async remove(id: string) {
    const result = await this.whitelistModel.findByIdAndDelete(id).lean();
    if (!result) throw new NotFoundException(`Whitelist entry ${id} not found`);
    return { deleted: true };
  }
}
