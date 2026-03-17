import { Injectable } from "@angular/core";
@Injectable({
  providedIn: "root",
})
export class FileService {
  public constructBase64ToBlobImage(base64Image: string): Blob {
    const block = base64Image.split(";");
    const contentType = block[0].split(":")[1];
    const realData = block[1].split(",")[1];
    return this.base64ToBlob(realData, contentType);
  }

  private base64ToBlob(b64Data: string, contentType: string, sliceSize?: number): Blob {
    contentType = contentType || "";
    sliceSize = sliceSize || 512;

    const byteCharacters = atob(b64Data);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);

      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);

      byteArrays.push(byteArray);
    }

    const blob = new Blob(byteArrays, { type: contentType });
    return blob;
  }
}
