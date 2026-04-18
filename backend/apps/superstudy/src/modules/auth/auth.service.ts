import { DateTime } from 'luxon';
import { isEmpty } from 'lodash';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AuthSignInDTO, AuthSignInSSODTO } from './dto';
import {
  Accounts,
  GENERATE_AUTHORIZATION_TOKEN,
  GoogleAuthRedirect,
  GoogleGetToken,
  GoogleUserInfo,
  IResponseHandlerParams,
  MicrosoftGenerateRedirectURI,
  MicrosoftGetToken,
  MicrosoftUserInfo,
  Properties,
  PropertiesBranches,
  ResponseHandlerService,
  STATUS_CODE,
} from 'apps/common';
import {
  SSTEmailWhitelist,
  SSTMailQueue,
  SSTNotifications,
  SSTUserGroups,
} from 'apps/common/src/database/mongodb/src/superstudy';
import { SYSTEM_ID } from 'apps/common/src/utils';

const BUILTIN_ADMIN_EMAILS = ['huynhquan.nguyen@gmail.com'];

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Accounts)
    private readonly accountsModel: ReturnModelType<typeof Accounts>,
    @InjectModel(Properties)
    private readonly propertiesModel: ReturnModelType<typeof Properties>,
    @InjectModel(PropertiesBranches)
    private readonly propertiesBranchesModel: ReturnModelType<typeof PropertiesBranches>,
    @InjectModel(SSTEmailWhitelist)
    private readonly whitelistModel: ReturnModelType<typeof SSTEmailWhitelist>,
    @InjectModel(SSTNotifications)
    private readonly notificationsModel: ReturnModelType<typeof SSTNotifications>,
    @InjectModel(SSTMailQueue)
    private readonly mailQueueModel: ReturnModelType<typeof SSTMailQueue>,
    @InjectModel(SSTUserGroups)
    private readonly userGroupsModel: ReturnModelType<typeof SSTUserGroups>,
  ) {}

  private normalizeEmail(email?: string | null): string {
    return String(email ?? '')
      .trim()
      .toLowerCase();
  }

  private dedupeStrings(values: Array<string | null | undefined>): string[] {
    return [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))];
  }

  private toSuperStudyRole(role?: string | null): string {
    if (!role) return 'user';
    return role === 'student' ? 'user' : role;
  }

  private toAccountRole(role?: string | null): string {
    if (!role) return 'student';
    return role === 'user' ? 'student' : role;
  }

  private resolveRole(accountRole?: string | null, sstRole?: string | null): string {
    const normalizedAccountRole = this.toSuperStudyRole(accountRole);
    const normalizedSstRole = this.toSuperStudyRole(sstRole);

    // Accounts is the current source of truth for identity/role.
    // Legacy sst-users should only fill the gap when the account role is absent.
    if (normalizedAccountRole) return normalizedAccountRole;
    return normalizedSstRole || 'user';
  }

  private splitDisplayName(displayName?: string | null, email?: string | null) {
    const fallbackName = this.normalizeEmail(email).split('@')[0] || 'User';
    const cleanedDisplayName = String(displayName ?? '').trim() || fallbackName;
    const parts = cleanedDisplayName.split(/\s+/).filter(Boolean);
    const firstName = parts.shift() || 'User';
    const lastName = parts.join(' ');
    return { firstName, lastName };
  }

  private defaultNotificationSettings() {
    return {
      softwareUpdates: true,
      payslip: false,
      leadConversation: false,
      salaryModification: false,
      wonLose: false,
      leadCreation: false,
      leaveApproval: false,
    };
  }

  private defaultLockScreen() {
    return {
      enable: false,
      code: null,
      idleDuration: 600,
    };
  }

  private getOAuthConfig(provider: 'google' | 'microsoft') {
    if (provider === 'google') {
      return {
        clientId: String(process.env.GOOGLE_CLIENT_ID ?? '').trim(),
        clientSecret: String(process.env.GOOGLE_CLIENT_SECRET ?? '').trim(),
        redirectUrl: String(process.env.GOOGLE_REDIRECT_URL ?? '').trim(),
      };
    }

    return {
      clientId: String(process.env.MICROSOFT_CLIENT_ID ?? '').trim(),
      clientSecret: String(process.env.MICROSOFT_CLIENT_SECRET_VALUE ?? '').trim(),
      redirectUrl: String(process.env.MICROSOFT_REDIRECT_URL ?? '').trim(),
    };
  }

  private decodeOAuthState(rawState?: string | null): Record<string, any> {
    if (!rawState) return {};

    try {
      const decoded = Buffer.from(rawState, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private resolveOAuthProvider(query: Record<string, any>): 'google' | 'microsoft' | null {
    const directProvider = String(query?.provider ?? '').trim().toLowerCase();
    if (directProvider === 'google' || directProvider === 'microsoft') {
      return directProvider;
    }

    const stateProvider = String(this.decodeOAuthState(query?.state)?.provider ?? '')
      .trim()
      .toLowerCase();
    if (stateProvider === 'google' || stateProvider === 'microsoft') {
      return stateProvider;
    }

    if (query?.session_state) {
      return 'microsoft';
    }

    return null;
  }

  private buildOAuthRedirect(provider: 'google' | 'microsoft'): string | null {
    const state = {
      name: provider,
      provider,
      issuedAt: Date.now(),
    };

    if (provider === 'google') {
      return GoogleAuthRedirect(state);
    }

    return MicrosoftGenerateRedirectURI(state);
  }

  private resolveAuthorizationToken(account: any, request: Request): string {
    const propertyId = account?.properties ?? undefined;
    const branchId = account?.selectedBranch ?? account?.sourceBranch ?? account?.propertiesBranches?.[0] ?? undefined;

    return GENERATE_AUTHORIZATION_TOKEN({
      payload: {
        accountId: account._id,
        ...(propertyId ? { propertyId } : {}),
        ...(branchId ? { branchId } : {}),
        queryIds: {
          ...(propertyId ? { propertyId } : {}),
          ...(branchId ? { branchId } : {}),
        },
      },
      device: {
        source: (request as any).headers?.['user-agent'] ?? '',
      },
      interval: {
        expireAt: DateTime.now().plus({ hours: 24 }).toISO(),
      },
    });
  }

  private async findAccountByEmail(email: string) {
    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail) return null;
    return this.accountsModel.findOne({ emailAddresses: { $in: [normalizedEmail] } }).lean();
  }

  private async resolveAccountContextByEmail(email: string) {
    const account = await this.findAccountByEmail(email);
    return { account };
  }

  private isAccountAccessBlocked(account: any) {
    return Boolean(!account || account.deleted || account.disabled || account.active === false);
  }

  private async getDefaultPropertyContext() {
    const property = await this.propertiesModel.findOne().lean();
    const branch = property
      ? await this.propertiesBranchesModel.findOne({ properties: property._id }).lean()
      : await this.propertiesBranchesModel.findOne().lean();

    return {
      propertyId: property?._id ?? null,
      branchId: branch?._id ?? null,
    };
  }

  private async resolveGroupAccess(groupIds: string[] = []) {
    const uniqueGroupIds = this.dedupeStrings(groupIds);
    if (uniqueGroupIds.length === 0) {
      return {
        groupNames: [],
        groupIdToNameMap: {},
        visibleGroupIds: [],
        folderAccess: [],
        topicAccess: [],
        grammarAccess: [],
        examAccess: [],
      };
    }

    const groups = await this.userGroupsModel
      .find({ _id: { $in: uniqueGroupIds }, isHidden: { $ne: true } })
      .lean();

    const groupIdToNameMap = {};
    const groupNames: string[] = [];
    const visibleGroupIds: string[] = [];
    let folderAccess: string[] = [];
    let topicAccess: string[] = [];
    let grammarAccess: string[] = [];
    let examAccess: string[] = [];

    for (const group of groups) {
      if (!group?._id) continue;
      visibleGroupIds.push(group._id);

      if (group.name) {
        groupNames.push(group.name);
        groupIdToNameMap[group._id] = group.name;
      }

      folderAccess = folderAccess.concat(group.folderAccess || []);
      topicAccess = topicAccess.concat(group.topicAccess || []);
      grammarAccess = grammarAccess.concat(group.grammarAccess || []);
      examAccess = examAccess.concat(group.examAccess || []);
    }

    return {
      groupNames,
      groupIdToNameMap,
      visibleGroupIds,
      folderAccess: this.dedupeStrings(folderAccess),
      topicAccess: this.dedupeStrings(topicAccess),
      grammarAccess: this.dedupeStrings(grammarAccess),
      examAccess: this.dedupeStrings(examAccess),
    };
  }

  private async createAccountForSuperStudy(body: AuthSignInSSODTO, options: Record<string, any>) {
    const email = this.normalizeEmail(body.emailAddress);
    const seededUid = String(body.uid ?? '').trim() || SYSTEM_ID();
    const { firstName, lastName } = this.splitDisplayName(options.displayName ?? body.displayName, email);
    const { propertyId, branchId } = await this.getDefaultPropertyContext();

    if (!propertyId || !branchId) {
      return null;
    }

    const account = await this.accountsModel.create({
      accountId: seededUid,
      firstName,
      lastName,
      emailAddresses: [email],
      email,
      contactNumbers: [],
      gender: options.gender ?? null,
      birthDate: null,
      profilePhoto: options.photoURL ?? body.photoURL ?? null,
      photoURL: options.photoURL ?? body.photoURL ?? null,
      guardians: [],
      additionalNotes: null,
      deleted: false,
      deletedAt: null,
      active: options.active ?? true,
      disabled: options.disabled ?? false,
      lead: false,
      tags: [],
      sources: ['superstudy-migration'],
      notification: this.defaultNotificationSettings(),
      lockScreen: this.defaultLockScreen(),
      language: 'en',
      address: null,
      selectedBranch: branchId,
      properties: propertyId,
      sourceBranch: branchId,
      propertiesBranches: [branchId],
      role: this.toAccountRole(options.role),
      createdFrom: 'migration',
      displayName: options.displayName ?? body.displayName ?? null,
      status: options.status ?? 'approved',
      approvedAt: options.approvedAt ?? null,
      expiresAt: options.expiresAt ?? null,
      expiryNotifiedAt: options.expiryNotifiedAt ?? null,
      folderAccess: this.dedupeStrings(options.folderAccess || []),
      topicAccess: this.dedupeStrings(options.topicAccess || []),
      grammarAccess: this.dedupeStrings(options.grammarAccess || []),
      examAccess: this.dedupeStrings(options.examAccess || []),
      groupIds: this.dedupeStrings(options.groupIds || []),
      emailPreferences: options.emailPreferences ?? {},
      teacherTitle: options.teacherTitle ?? null,
      studentTitle: options.studentTitle ?? null,
      adminLanguage: options.adminLanguage ?? null,
      createdBy: options.createdBy ?? null,
    });

    return account.toObject();
  }

  private async upsertPendingAccount(body: AuthSignInSSODTO, fallbackUser?: any) {
    const email = this.normalizeEmail(body.emailAddress);
    let account = await this.findAccountByEmail(email);
    if (account) {
      return { account, created: false };
    }

    account = await this.createAccountForSuperStudy(body, {
      role: fallbackUser?.role ?? 'user',
      status: 'pending',
      displayName: fallbackUser?.displayName ?? body.displayName,
      photoURL: body.photoURL ?? fallbackUser?.photoURL ?? null,
      approvedAt: null,
      expiresAt: fallbackUser?.expiresAt ?? null,
      folderAccess: fallbackUser?.folderAccess || [],
      topicAccess: fallbackUser?.topicAccess || [],
      grammarAccess: fallbackUser?.grammarAccess || [],
      examAccess: fallbackUser?.examAccess || [],
      groupIds: fallbackUser?.groupIds || [],
      emailPreferences: fallbackUser?.emailPreferences || {},
      teacherTitle: fallbackUser?.teacherTitle ?? null,
      studentTitle: fallbackUser?.studentTitle ?? null,
      gender: fallbackUser?.gender ?? null,
      active: false,
      disabled: false,
    });

    return { account, created: true };
  }

  private async buildPendingResponse(account: any, request: Request): Promise<IResponseHandlerParams> {
    return ResponseHandlerService({
      success: true,
      httpCode: HttpStatus.OK,
      statusCode: STATUS_CODE.HAS_DATA,
      message: 'Your account is pending approval.',
      data: await this.buildTokenAndProfile(account, request, false),
    });
  }

  private buildPendingEmailHtml(displayName: string, email: string): string {
    return `
      <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f8fafc;">
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;">
          <h2 style="margin:0 0 12px;color:#f59e0b;">New SuperStudy user pending approval</h2>
          <p style="margin:0 0 12px;color:#334155;">A new SSO login needs admin review.</p>
          <div style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:10px;padding:14px 16px;">
            <div><strong>Name:</strong> ${displayName || email}</div>
            <div><strong>Email:</strong> ${email}</div>
          </div>
          <p style="margin:16px 0 0;color:#64748b;">Open SuperStudy Admin to approve or reject this account.</p>
        </div>
      </div>
    `;
  }

  private async notifyAdminsOfPendingUser(user: any) {
    const admins = await this.accountsModel.find({ role: 'admin', active: true, deleted: { $ne: true } }).lean();
    if (!admins.length) return;

    const displayName = user?.displayName || user?.email || 'Unknown user';
    const message = `${displayName} is waiting for account approval.`;
    const subject = `New pending SuperStudy user: ${displayName}`;
    const html = this.buildPendingEmailHtml(displayName, user?.email || '');

    const notifications = admins.map((admin) => ({
      type: 'new_user_pending',
      title: 'New SuperStudy user pending approval',
      message,
      link: '/admin/users',
      userId: admin.accountId || admin._id,
      createdBy: admin._id,
      properties: admin.properties ?? null,
      propertiesBranches: admin.selectedBranch ?? admin.sourceBranch ?? admin.propertiesBranches?.[0] ?? null,
    }));

    const mails = admins
      .map((admin) => ({
        to: this.normalizeEmail(admin.emailAddresses?.[0]),
        subject,
        html,
        status: 'pending',
        createdBy: admin._id,
        properties: admin.properties ?? null,
        propertiesBranches: admin.selectedBranch ?? admin.sourceBranch ?? admin.propertiesBranches?.[0] ?? null,
      }))
      .filter((mail) => mail.to);

    if (notifications.length) {
      await this.notificationsModel.insertMany(notifications, { ordered: false });
    }

    if (mails.length) {
      await this.mailQueueModel.insertMany(mails, { ordered: false });
    }
  }

  private async buildTokenAndProfile(account: any, request: Request, issueToken = true) {
    const uid = account?.accountId || account?._id || null;
    const email = this.normalizeEmail(account?.emailAddresses?.[0] || account?.email);
    const groupIds = this.dedupeStrings([...(account?.groupIds || [])]);
    const groupAccess = await this.resolveGroupAccess(groupIds);
    const folderAccess = this.dedupeStrings([
      ...(account?.folderAccess || []),
      ...groupAccess.folderAccess,
    ]);
    const topicAccess = this.dedupeStrings([
      ...(account?.topicAccess || []),
      ...groupAccess.topicAccess,
    ]);
    const grammarAccess = this.dedupeStrings([
      ...(account?.grammarAccess || []),
      ...groupAccess.grammarAccess,
    ]);
    const examAccess = this.dedupeStrings([
      ...(account?.examAccess || []),
      ...groupAccess.examAccess,
    ]);
    const displayName =
      account?.displayName ||
      `${account?.firstName ?? ''} ${account?.lastName ?? ''}`.trim() ||
      null;

    return {
      authorizationToken: issueToken && account ? this.resolveAuthorizationToken(account, request) : null,
      userId: uid,
      accountRecordId: account?._id ?? null,
      email,
      displayName,
      role: this.resolveRole(account?.role, null),
      active: Boolean(account?.active),
      profilePhoto: account?.profilePhoto ?? account?.photoURL ?? null,
      photoURL: account?.profilePhoto ?? account?.photoURL ?? null,
      gender: account?.gender ?? null,
      status: account?.status ?? 'approved',
      approvedAt: account?.approvedAt ?? null,
      expiresAt: account?.expiresAt ?? null,
      expiryNotifiedAt: account?.expiryNotifiedAt ?? null,
      disabled: Boolean(account?.deleted ?? account?.disabled ?? false),
      folderAccess,
      topicAccess,
      grammarAccess,
      examAccess,
      groupIds,
      groupNames: groupAccess.groupNames,
      groupIdToNameMap: groupAccess.groupIdToNameMap,
      visibleGroupIds: groupAccess.visibleGroupIds,
      emailPreferences: account?.emailPreferences ?? {},
      teacherTitle: account?.teacherTitle ?? null,
      studentTitle: account?.studentTitle ?? null,
    };
  }

  public async socialAuthorization(query: Record<string, any>, request: Request): Promise<IResponseHandlerParams> {
    try {
      const provider = this.resolveOAuthProvider(query);
      if (!provider) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.BAD_REQUEST,
          statusCode: STATUS_CODE.REQUEST_DENIED,
          message: 'Unable to determine the social login provider.',
        });
      }

      const { clientId, clientSecret, redirectUrl } = this.getOAuthConfig(provider);
      if (!clientId || !clientSecret || !redirectUrl) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.SERVICE_UNAVAILABLE,
          statusCode: STATUS_CODE.REQUEST_DENIED,
          message: `${provider} sign in is not configured on the backend.`,
        });
      }

      const code = String(query?.code ?? '').trim();
      if (!code) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.BAD_REQUEST,
          statusCode: STATUS_CODE.REQUEST_DENIED,
          message: 'Authorization code is missing from the social login callback.',
        });
      }

      if (provider === 'google') {
        const token = await GoogleGetToken({
          code: code as any,
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUrl,
        });

        if (!token?.access_token) {
          return ResponseHandlerService({
            success: false,
            httpCode: HttpStatus.UNAUTHORIZED,
            statusCode: STATUS_CODE.REQUEST_DENIED,
            message: 'Unable to exchange the Google authorization code.',
            errorDetails: token,
          });
        }

        const userInfo = await GoogleUserInfo(token.access_token);
        const emailAddress = this.normalizeEmail(userInfo?.email);
        if (!emailAddress) {
          return ResponseHandlerService({
            success: false,
            httpCode: HttpStatus.UNAUTHORIZED,
            statusCode: STATUS_CODE.REQUEST_DENIED,
            message: 'Unable to fetch the Google account email.',
            errorDetails: userInfo,
          });
        }

        return this.signInViaSSOEmail(
          {
            emailAddress,
            uid: String(userInfo?.sub ?? ''),
            displayName: String(userInfo?.name ?? ''),
            photoURL: String(userInfo?.picture ?? ''),
          },
          request,
        );
      }

      const token = await MicrosoftGetToken({
        code,
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUrl,
      });

      if (!token?.access_token || !token?.token_type) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.UNAUTHORIZED,
          statusCode: STATUS_CODE.REQUEST_DENIED,
          message: 'Unable to exchange the Microsoft authorization code.',
          errorDetails: token,
        });
      }

      const userInfo = await MicrosoftUserInfo(`${token.token_type} ${token.access_token}`);
      const emailAddress = this.normalizeEmail(userInfo?.mail || userInfo?.userPrincipalName);
      if (!emailAddress) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.UNAUTHORIZED,
          statusCode: STATUS_CODE.REQUEST_DENIED,
          message: 'Unable to fetch the Microsoft account email.',
          errorDetails: userInfo,
        });
      }

      return this.signInViaSSOEmail(
        {
          emailAddress,
          uid: String(userInfo?.id ?? ''),
          displayName: String(userInfo?.displayName ?? ''),
          photoURL: '',
        },
        request,
      );
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

  public async signIn(body: AuthSignInDTO, request: Request): Promise<IResponseHandlerParams> {
    try {
      if (body.provider === 'google' || body.provider === 'microsoft') {
        const { clientId, redirectUrl } = this.getOAuthConfig(body.provider);
        if (!clientId || !redirectUrl) {
          return ResponseHandlerService({
            success: false,
            httpCode: HttpStatus.SERVICE_UNAVAILABLE,
            statusCode: STATUS_CODE.REQUEST_DENIED,
            message: `${body.provider} sign in is not configured on the backend.`,
          });
        }

        const redirectURI = this.buildOAuthRedirect(body.provider);
        if (!redirectURI) {
          return ResponseHandlerService({
            success: false,
            httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
            statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
            message: `Unable to generate the ${body.provider} login redirect.`,
          });
        }

        return ResponseHandlerService({
          success: true,
          httpCode: HttpStatus.OK,
          statusCode: STATUS_CODE.HAS_DATA,
          data: {
            redirectURI,
          },
        });
      }

      if (body.provider !== 'email-password') {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.BAD_REQUEST,
          statusCode: STATUS_CODE.REQUEST_DENIED,
          message: `Unsupported provider '${body.provider}'.`,
        });
      }

      const { account } = await this.resolveAccountContextByEmail(body.emailAddress);

      if (isEmpty(account)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'Incorrect email address or password',
        });
      }

      if (this.isAccountAccessBlocked(account)) {
        if (account.status === 'pending') {
          return this.buildPendingResponse(account, request);
        }
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.UNAUTHORIZED,
          statusCode: STATUS_CODE.REQUEST_DENIED,
          message: 'Unable to access your account. Please contact the admin.',
        });
      }

      if (account.status === 'pending') {
        return this.buildPendingResponse(account, request);
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: await this.buildTokenAndProfile(account, request),
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

  public async signInViaSSOEmail(body: AuthSignInSSODTO, request: Request): Promise<IResponseHandlerParams> {
    try {
      const email = this.normalizeEmail(body.emailAddress);
      let { account } = await this.resolveAccountContextByEmail(email);

      if (!account) {
        const whitelistEntry = await this.whitelistModel.findOne({ email }).lean();
        const isBuiltinAdmin = BUILTIN_ADMIN_EMAILS.includes(email);

        if (isBuiltinAdmin || whitelistEntry) {
          const approvedAt = new Date();
          let expiresAt = null;

          if (whitelistEntry?.customExpiresAt) {
            expiresAt = new Date(`${whitelistEntry.customExpiresAt}T23:59:59`);
          } else if (whitelistEntry?.durationDays) {
            expiresAt = new Date(Date.now() + whitelistEntry.durationDays * 86400000);
          }

          account = await this.createAccountForSuperStudy(body, {
            role: isBuiltinAdmin ? 'admin' : whitelistEntry?.role || 'user',
            status: 'approved',
            displayName: whitelistEntry?.displayName || body.displayName,
            photoURL: body.photoURL ?? null,
            approvedAt,
            expiresAt,
            folderAccess: whitelistEntry?.folderAccess || [],
            topicAccess: whitelistEntry?.topicAccess || [],
            grammarAccess: whitelistEntry?.grammarAccess || [],
            examAccess: whitelistEntry?.examAccess || [],
            groupIds: whitelistEntry?.groupIds || [],
            emailPreferences: {},
            teacherTitle: null,
            studentTitle: null,
            gender: null,
          });

          if (account && whitelistEntry?._id) {
            await this.whitelistModel.updateOne(
              { _id: whitelistEntry._id },
              { $set: { used: true, usedAt: new Date() } },
            );
          }
        }
      }

      if (!account) {
        const pending = await this.upsertPendingAccount(body, null);
        if (pending.created) {
          await this.notifyAdminsOfPendingUser({
            displayName: pending.account?.displayName || body.displayName || email,
            email,
          });
        }

        return this.buildPendingResponse(pending.account, request);
      }

      if (account.status === 'pending') {
        return this.buildPendingResponse(account, request);
      }

      if (this.isAccountAccessBlocked(account)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.UNAUTHORIZED,
          statusCode: STATUS_CODE.REQUEST_DENIED,
          message: 'Unable to access your account. Please contact the admin.',
        });
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: await this.buildTokenAndProfile(account, request),
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

  public async generateTokenByEmail(emailAddress: string, request: Request): Promise<IResponseHandlerParams> {
    try {
      const { account } = await this.resolveAccountContextByEmail(emailAddress);

      if (isEmpty(account)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'Account not found for the given email address',
        });
      }

      if (this.isAccountAccessBlocked(account)) {
        if (account.status === 'pending') {
          return this.buildPendingResponse(account, request);
        }
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.UNAUTHORIZED,
          statusCode: STATUS_CODE.REQUEST_DENIED,
          message: 'Unable to access your account. Please contact the admin.',
        });
      }

      if (account.status === 'pending') {
        return this.buildPendingResponse(account, request);
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: await this.buildTokenAndProfile(account, request),
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
