import { URLSearchParams } from 'url';
import fetch from 'node-fetch';
import { IMicrosoftUserInfo } from 'apps/common/src/interfaces';
import { MICROSOFT_ME_API, MICROSOFT_OAUTH2_URI, MICROSOFT_OAUTH_TOKEN_API, MICROSOFT_SCOPE } from 'apps/common/src/constants';

export const MicrosoftGenerateRedirectURI = (state: { name: string }): string => {
  try {
    return `${MICROSOFT_OAUTH2_URI}?${new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID,
      response_type: 'code',
      redirect_uri: process.env.MICROSOFT_REDIRECT_URL,
      response_mode: 'query',
      scope: MICROSOFT_SCOPE,
      state: Buffer.from(JSON.stringify(state)).toString('base64'),
      grant_type: 'authorization_code',
    })}`;
  } catch (error) {
    return null;
  }
};

export const MicrosoftGetToken = async (data: { code: string; grant_type: string; client_id: string; client_secret: string; redirect_uri: string }): Promise<any> => {
  try {
    const urlencoded = new URLSearchParams();
    urlencoded.append('scope', MICROSOFT_SCOPE);
    for (const key of Object.keys(data)) {
      urlencoded.append(key, data[key]);
    }
    const response = await fetch(MICROSOFT_OAUTH_TOKEN_API, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: urlencoded, redirect: 'follow' }).then(
      (res: any) => res.json(),
    );
    return response;
  } catch (error) {
    console.log('error', error);
    return null;
  }
};

export const MicrosoftGetRefreshToken = async (data: { refresh_token: string; grant_type: string; client_id: string; client_secret: string }): Promise<any> => {
  try {
    const urlencoded = new URLSearchParams();
    for (const key of Object.keys(data)) {
      urlencoded.append(key, data[key]);
    }
    const response = await fetch(MICROSOFT_OAUTH_TOKEN_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'follow',
      body: urlencoded,
    }).then((res: any) => res.json());
    return response;
  } catch (error) {
    return null;
  }
};

export const MicrosoftGenerateAuthToken = async (data: { refresh_token: string; grant_type: string; client_id: string; client_secret: string }): Promise<any> => {
  try {
    const urlencoded = new URLSearchParams();
    for (const key of Object.keys(data)) {
      urlencoded.append(key, data[key]);
    }
    const response = await fetch(MICROSOFT_OAUTH_TOKEN_API, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, redirect: 'follow', body: urlencoded }).then(
      (res: any) => res.json(),
    );
    return response;
  } catch (error) {
    return null;
  }
};

export const MicrosoftUserInfo = async (authToken: string): Promise<IMicrosoftUserInfo> => {
  try {
    const response = await fetch(MICROSOFT_ME_API, { method: 'GET', headers: { Accept: 'application/json', Authorization: authToken, 'Content-Type': 'application/json' }, redirect: 'follow' })
      .then((res: any) => res.json())
      .catch((err) => {
        console.log('MicrosoftUserInfo error: ', err);
        return null;
      });
    return response;
  } catch (error) {
    return null;
  }
};
