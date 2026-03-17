import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { IAPIResponse } from "@isms-core/interfaces";
import { environment } from "@isms-env/environment";
import { ApiService } from "../../api.service";

@Injectable({
  providedIn: "root",
})
export class FileManagerService {
  #apiUrl: string;

  constructor(private apiService: ApiService) {
    this.#apiUrl = `${environment.apiUrl}/file-manager`;
  }

  public extractCSV(formData: FormData, type: "macintosh" | "utf-8" | "latinascii"): Observable<IAPIResponse> {
    return this.apiService.postWithFile(`${this.#apiUrl}/extract-csv?type=${type}`, formData);
  }
}
