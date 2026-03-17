import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { IAPIResponse } from "@isms-core/interfaces";

@Injectable({
  providedIn: "root",
})
export class ApiService {
  constructor(private httpClient: HttpClient) {}

  public post<T>(endPointUrl: string, data?: T): Observable<IAPIResponse> {
    return this.httpClient.post(endPointUrl, data, this.httpOptions).pipe(map((mapData: any) => mapData));
  }

  public postWithFile<T>(endPointUrl: string, data: T): Observable<IAPIResponse> {
    return this.httpClient.post(endPointUrl, data).pipe(map((mapData: any) => mapData));
  }

  public put<T>(endPointUrl: string, data?: T): Observable<IAPIResponse> {
    return this.httpClient.put(endPointUrl, data, this.httpOptions).pipe(map((mapData: any) => mapData));
  }

  public patch<T>(endPointUrl: string, data?: T): Observable<IAPIResponse> {
    return this.httpClient.patch(endPointUrl, data, this.httpOptions).pipe(map((mapData: any) => mapData));
  }

  public delete<T>(endPointUrl: string, data?: T): Observable<IAPIResponse> {
    if (!data) {
      return this.httpClient.delete(endPointUrl, this.httpOptions).pipe(map((mapData: any) => mapData));
    } else {
      const options = { headers: new HttpHeaders({ "Content-Type": "application/json" }), body: data };
      return this.httpClient.delete(endPointUrl, options).pipe(map((mapData: any) => mapData));
    }
  }

  public get<T>(endPointUrl: string, params?: T): Observable<IAPIResponse> {
    let httpOptions = { ...this.httpOptions };
    if (params) {
      httpOptions = { ...httpOptions, params };
    }

    return this.httpClient.get(endPointUrl, httpOptions).pipe(map((mapData: any) => mapData));
  }

  public get httpOptions(): any {
    return {
      reportProgress: true,
      headers: new HttpHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
    };
  }

  public get formDataHttpOptions(): any {
    return {
      headers: new HttpHeaders({ "Content-Type": "multipart/form-data", Accept: "application/json" }),
    };
  }
}
