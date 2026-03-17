import { Injectable } from "@angular/core";
import * as CryptoJS from "crypto-js";

@Injectable({
  providedIn: "root",
})
export class CryptoService {
  public encrypt(value: string): string {
    const utf8Key = CryptoJS.enc.Utf8.parse(this.lssk);
    const utf8Iv = CryptoJS.enc.Utf8.parse(this.lssk);
    const utf8Val = CryptoJS.enc.Utf8.parse(value);
    const options: any = {
      keySize: 128 / 8,
      iv: utf8Iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    };

    const encrypted: any = CryptoJS.AES.encrypt(utf8Val, utf8Key, options);
    return encrypted.toString();
  }

  // Supported min length of key is 12
  public decrypt(value: string): string {
    const utf8Key = CryptoJS.enc.Utf8.parse(this.lssk);
    const utf8Iv = CryptoJS.enc.Utf8.parse(this.lssk);

    const options: any = {
      keySize: 128 / 8,
      iv: utf8Iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    };

    const decrypted: any = CryptoJS.AES.decrypt(value, utf8Key, options);
    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  public get lssk(): string {
    return localStorage.getItem("lssk");
  }
}

export const CryptoEncrypt = (value: string): string => {
  const utf8Key = CryptoJS.enc.Utf8.parse(lssk);
  const utf8Iv = CryptoJS.enc.Utf8.parse(lssk);
  const utf8Val = CryptoJS.enc.Utf8.parse(value);
  const options: any = {
    keySize: 128 / 8,
    iv: utf8Iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  };

  const encrypted: any = CryptoJS.AES.encrypt(utf8Val, utf8Key, options);
  return encrypted.toString();
};

export const CryptoDecrypt = (value: string): string => {
  const utf8Key = CryptoJS.enc.Utf8.parse(lssk);
  const utf8Iv = CryptoJS.enc.Utf8.parse(lssk);
  const options: any = {
    keySize: 128 / 8,
    iv: utf8Iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  };

  const decrypted: any = CryptoJS.AES.decrypt(value, utf8Key, options);
  return decrypted.toString(CryptoJS.enc.Utf8);
};

export const lssk = localStorage.getItem("lssk");
