// Angular imports
import fetch from 'node-fetch';
import { URLSearchParams } from 'url';
// Constants
import { GOOGLE_OAUTH2_URI, GOOGLE_OAUTH_TOKEN_API, GOOGLE_USERINFO_API } from 'apps/common/src/constants';
import { GoogleTokenUserInfoI, GoogleUserInfoI } from 'apps/common/src/interfaces';
import { GoogleGrantTypeT } from 'apps/common/src/types';

export const GoogleAuthRedirect = (state: any): string => {
  console.log('testing', {
    client: process.env.GOOGLE_CLIENT_ID!,
    uri: process.env.GOOGLE_REDIRECT_URL!,
  });
  return `${GOOGLE_OAUTH2_URI}?${new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URL!,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state: Buffer.from(JSON.stringify(state)).toString('base64'),
  })}`;
};

export const GoogleGetToken = async (data: {
  code: GoogleGrantTypeT;
  grant_type: string;
  client_id: string;
  client_secret: string;
  redirect_uri: string;
}): Promise<GoogleTokenUserInfoI | null> => {
  try {
    const urlencoded = new URLSearchParams();
    for (const key of Object.keys(data)) {
      urlencoded.append(key, data[key]);
    }

    const response = await fetch(GOOGLE_OAUTH_TOKEN_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: urlencoded,
    }).then((res) => res.json());

    return response as GoogleTokenUserInfoI;
  } catch (error) {
    console.log('GoogleGetToken error:', error);
    return null;
  }
};

export const GoogleGetRefreshToken = async (data: {
  refresh_token: string;
  grant_type: string;
  client_id: string;
  client_secret: string;
}): Promise<GoogleTokenUserInfoI | null> => {
  try {
    const urlencoded = new URLSearchParams();
    for (const key of Object.keys(data)) {
      urlencoded.append(key, data[key]);
    }

    const response = await fetch(GOOGLE_OAUTH_TOKEN_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: urlencoded,
    }).then((res) => res.json());

    return response as GoogleTokenUserInfoI;
  } catch (error) {
    console.log('GoogleGetRefreshToken error:', error);
    return null;
  }
};

export const GoogleUserInfo = async (accessToken: string): Promise<GoogleUserInfoI | null> => {
  try {
    const response = await fetch(GOOGLE_USERINFO_API, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    }).then((res) => res.json());

    return response as GoogleUserInfoI;
  } catch (error) {
    console.log('GoogleUserInfo error:', error);
    return null;
  }
};
