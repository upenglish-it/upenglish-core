/**
 * Api Service
 *
 * @file          api.service
 * @description   Provides a single service to be used for all API calls
 * @author        John Mark Alicante
 * @since         2025 - 06 - 01
 */

import { Injectable } from "@angular/core";
import { HttpClient, HttpBackend, HttpErrorResponse, HttpHeaders, HttpContext, HttpParams } from "@angular/common/http";
import { Observable, of, lastValueFrom, catchError } from "rxjs";

/**
 * @interface    ApiEndpointResponseI
 * @description  Type definition for all API call responses
 */
/**
 * @interface     ActionStatusT
 * @description   API status code types
 */
const ActionStatusC = [
  "internal-server-error",
  "request-denied",
  "not-found",
  "unprocessable-data",
  "data-created",
  "data-updated",
  "data-deleted",
  "data-modified",
  "data-merge",
  "data-skip",
  "data-sent",
  "data-received",
  "authenticated",
  "data-exists",
  "already-exists",
  "pending-verification",
  "verified",
  "not-verified",
] as const;
export type ActionStatusT = (typeof ActionStatusC)[number];

// /**
//  * @interface     ItemPricingTypeT
//  * @description   Pricing types
//  */
// export const ItemPricingTypesC = ["flat", "fixed", "structure"] as const;
// export type ItemPricingTypeT = (typeof ItemPricingTypesC)[number];

type ApiResponseI<T> = {
  timeRequested?: string;
  environment?: "development" | "production";
  domain?: string;
  httpCode?: number;
  statusCode?: ActionStatusT;
  success: boolean;
  message: string;
  data?: T;
};

/**
 * @interface    ApiEndpointGetParamsI
 * @description  Type definition for all API Get call parameters
 */
export interface ApiEndpointGetParamsI {
  urlParams?: string[];
  queryParams?: { [param: string]: string | number | boolean };
}

/**
 * @interface    ApiEndpointOptions
 * @description  Type definition for all API POST, PATCH call parameters
 */
export interface ApiEndpointOptions {
  headers?: HttpHeaders | { [header: string]: string | string[] };
  context?: HttpContext;
  observe?: "body";
  params?: HttpParams | { [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean> };
  reportProgress?: boolean;
  responseType?: "json";
  withCredentials?: boolean;
}

@Injectable({ providedIn: "root" })
export class ApiService {
  //--- HTTP direct client to bypass interceptor on apiService http client
  private httpDirectClient: HttpClient;

  //--- HTML Default Headers
  private htmlDefaultHeader: HttpHeaders = new HttpHeaders({
    "content-type": "application/json",
    authorization: localStorage.getItem("authorization") || "",
  });

  /**
   * @name  constructor
   */
  constructor(
    private readonly http: HttpClient,
    private readonly httpHandlerDirectToBackend: HttpBackend
  ) {
    this.httpDirectClient = new HttpClient(this.httpHandlerDirectToBackend);
  }

  /**
   * @name          handleError
   * @description   Handle error
   * @param         {HttpErrorResponse} err
   * @returns       {Observable<ApiResponseI<never>>}
   */
  handleError(err: HttpErrorResponse): Observable<ApiResponseI<never>> {
    return of({
      success: false,
      message: err.message,
    });
  }

  /**
   * @name          apiGet
   * @description   Most basic HTTP GET
   * @param         {string} endpoint
   * @param         {ApiEndpointGetParamsI} params (optional) either url or query parameters
   * @returns       {Promise<ApiResponseI<T>>}
   */
  async apiGet<T>(endpoint: string, params?: ApiEndpointGetParamsI): Promise<ApiResponseI<T>> {
    if (params && Array.isArray(params?.urlParams)) {
      endpoint += "/" + params.urlParams.join("/");
    }
    return await lastValueFrom(
      this.http
        .get<ApiResponseI<T>>(endpoint, {
          ...(params?.queryParams ? { params: params.queryParams } : {}),
          headers: this.htmlDefaultHeader,
        })
        .pipe(catchError((err) => this.handleError(err)))
    );
  }

  /**
   * @name          apiPost
   * @description   Most basic HTTP POST
   * @param         {string} endpoint
   * @param         {any} bodyPayload (optional) Added to request body
   * @returns       {Promise<ApiResponseI<T>>}
   */
  async apiPost<T>(
    endpoint: string,
    bodyPayload?: any,
    autoContentHeader: boolean = true,
    headers?: { [key: string]: string },
    params?: ApiEndpointGetParamsI
  ): Promise<ApiResponseI<T>> {
    console.log(">>", {
      ...(headers ? headers : {}),
    });
    return await lastValueFrom(
      this.http
        .post<ApiResponseI<T>>(
          endpoint,
          bodyPayload ? bodyPayload : "",
          autoContentHeader
            ? {
                ...(params?.queryParams ? { params: params.queryParams } : {}),
                ...(headers ? { headers } : {}),
              }
            : {
                ...(params?.queryParams ? { params: params.queryParams } : {}),
                headers: this.htmlDefaultHeader,
              }
        )
        .pipe(catchError((err) => this.handleError(err)))
    );
  }

  /**
   * @name          apiDirectPost
   * @description   Most basic HTTP POST to backend without going through interceptor
   * @param         {string} endpoint
   * @param         {any} bodyPayload? (optional) Added to request body
   * @returns       {Promise<ApiResponseI<T>>}
   */
  async apiDirectPost<T>(endpoint: string, bodyPayload?: any): Promise<ApiResponseI<T>> {
    return await lastValueFrom(
      this.httpDirectClient
        .post<ApiResponseI<T>>(endpoint, bodyPayload ? bodyPayload : "", {
          headers: this.htmlDefaultHeader,
        })
        .pipe(catchError((err) => this.handleError(err)))
    );
  }

  /**
   * @name          apiPatch
   * @description   Most basic HTTP PATCH
   * @param         {string} endpoint
   * @param         {any} bodyPayload? (optional) Added to request body
   * @returns       {Promise<ApiResponseI<T>>}
   */
  async apiPatch<T>(endpoint: string, bodyPayload?: any, options?: ApiEndpointOptions): Promise<ApiResponseI<T>> {
    return await lastValueFrom(this.http.patch<ApiResponseI<T>>(endpoint, bodyPayload ? bodyPayload : "", options).pipe(catchError((err) => this.handleError(err))));
  }

  /**
   * @name          apiDelete
   * @description   Most basic HTTP DELETE
   * @param         {string} endpoint
   * @param         {any} bodyPayload? (optional) Added to request body
   * @returns       {Promise<ApiResponseI<T>>}
   */
  async apiDelete<T>(endpoint: string, bodyPayload?: any): Promise<ApiResponseI<T>> {
    return await lastValueFrom(
      this.http
        .delete<ApiResponseI<T>>(endpoint, {
          headers: this.htmlDefaultHeader,
          ...(bodyPayload ? { body: bodyPayload } : {}),
        })
        .pipe(catchError((err) => this.handleError(err)))
    );
  }

  //=================================================================
}
