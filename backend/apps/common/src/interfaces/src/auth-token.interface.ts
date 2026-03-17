export interface IAuthToken {
  payload: IAuthTokenPayload;
  device: IAuthTokenDevice;
  interval: IAuthTokenInterval;
}

export interface IAuthTokenPayload {
  accountId: string;
  propertyId?: string; // seller business id
  branchId?: string; // seller shop id
  // organizationId: string;
  // organizationOfficeId: string;
  // accountId: string;
  queryIds: {
    propertyId?: string;
    branchId?: string;
  };
}

export interface IAuthTokenDevice {
  source: string;
}

export interface IAuthTokenInterval {
  expireAt: string;
}
