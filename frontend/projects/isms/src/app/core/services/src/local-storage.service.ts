import { Injectable } from "@angular/core";
import { Subject } from "rxjs";
import { CryptoDecrypt, CryptoEncrypt, CryptoService } from "./crypto.service";

@Injectable({
  providedIn: "root",
})
export class LocalStorageService {
  private updated: Subject<void>;

  constructor(private cryptoService: CryptoService) {
    this.updated = new Subject<void>();
  }

  public clear(): void {
    localStorage.clear();
  }

  public remove(key: string): void {
    const encryptedKey: string = this.cryptoService.encrypt(key);
    if (localStorage.getItem(encryptedKey) != null) {
      localStorage.removeItem(encryptedKey);
    }

    const encryptedKeyExpiry: string = this.cryptoService.encrypt(`${key}_expiry`);
    if (localStorage.getItem(encryptedKeyExpiry) != null) {
      localStorage.removeItem(encryptedKeyExpiry);
    }

    this.updated.next();
  }

  public get(key: string): string {
    const encryptedKey: string = this.cryptoService.encrypt(key);
    if (localStorage.getItem(encryptedKey) != null) {
      return this.cryptoService.decrypt(localStorage.getItem(encryptedKey));
    }
    return null;
  }

  public set(key: string, value: string, expirySeconds?: number): void {
    try {
      const encryptedKey: string = this.cryptoService.encrypt(key);
      const encryptedValue: string = this.cryptoService.encrypt(value);
      localStorage.setItem(encryptedKey, encryptedValue);
      if (expirySeconds !== undefined && expirySeconds != null) {
        const expiry: number = Date.now() + Math.abs(expirySeconds) * 1000;
        const encryptedExpiryKey: string = this.cryptoService.encrypt(`${key}_expiry`);
        const encryptedExpiryValue: string = this.cryptoService.encrypt(expiry.toString());
        localStorage.setItem(encryptedExpiryKey, encryptedExpiryValue);
      }
      this.updated.next();
    } catch (error) {
      console.log("error", error);
    }
  }
}

export const LocalStorageClear = (): void => {
  localStorage.clear();
};

export const LocalStorageRemove = (key: string): void => {
  const encryptedKey: string = CryptoEncrypt(key);
  if (localStorage.getItem(encryptedKey) != null) {
    localStorage.removeItem(encryptedKey);
  }

  const encryptedKeyExpiry: string = CryptoEncrypt(`${key}_expiry`);
  if (localStorage.getItem(encryptedKeyExpiry) != null) {
    localStorage.removeItem(encryptedKeyExpiry);
  }
};

export const LocalStorageGet = (key: string): string => {
  const encryptedKey: string = CryptoEncrypt(key);
  if (localStorage.getItem(encryptedKey) != null) {
    return CryptoDecrypt(localStorage.getItem(encryptedKey));
  }
  return null;
};

export const LocalStorageSet = (key: string, value: string, expirySeconds?: number): void => {
  const encryptedKey: string = CryptoEncrypt(key);
  const encryptedValue: string = CryptoEncrypt(value);
  localStorage.setItem(encryptedKey, encryptedValue);
  if (expirySeconds !== undefined && expirySeconds != null) {
    const expiry: number = Date.now() + Math.abs(expirySeconds) * 1000;
    const encryptedExpiryKey: string = CryptoEncrypt(`${key}_expiry`);
    const encryptedExpiryValue: string = CryptoEncrypt(expiry.toString());
    localStorage.setItem(encryptedExpiryKey, encryptedExpiryValue);
  }
};
