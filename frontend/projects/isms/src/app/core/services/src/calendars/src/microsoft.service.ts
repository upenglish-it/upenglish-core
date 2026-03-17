import { Injectable } from "@angular/core";
import { Observable, lastValueFrom } from "rxjs";
import { IAPIResponse } from "@isms-core/interfaces";
import { ApiService } from "../../api.service";
import { environment } from "@isms-env/environment";

@Injectable({ providedIn: "root" })
export class MicrosoftCalendarService {
  #apiUrl: string;

  constructor(private readonly apiService: ApiService) {
    this.#apiUrl = `${environment.apiUrl}/calendar/microsoft`;
  }

  private generateRedirectURL(): Observable<IAPIResponse> {
    return this.apiService.get(`${this.#apiUrl}/generate-redirect-url`);
  }

  private preSync(body: { code: string; state: string; session_state: string }): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}/pre-sync`, body);
  }

  public sync(body: { integrationId: string; sync: boolean }): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}/sync`, body);
  }

  public unsync(body: { integrationId: string; sync: boolean }): Observable<IAPIResponse> {
    return this.apiService.post(`${this.#apiUrl}/unsync`, body);
  }

  public async authenticate(): Promise<IAPIResponse> {
    return new Promise(async (resolve, reject) => {
      // Generate Redirection URL
      const generateRedirection = await lastValueFrom(this.generateRedirectURL());

      if (generateRedirection.success) {
        const windowWidth = 620;
        const windowHeight = 720;

        const winPosLeft = (screen.width - windowWidth) / 2;
        const winPosTop = (screen.height - windowHeight) / 2;

        const authenticationWindow: Window = window.open(
          generateRedirection.data.redirectURI,
          "_blank",
          `toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=no, copyhistory=no, width=${windowWidth}, height=${windowHeight}, top=${winPosTop}, left=${winPosLeft}`
        );

        const timer = setInterval(async () => {
          if (authenticationWindow.closed) {
            const authData: WindowAuthData = (window as any).WINDOW_AUTH_DATA || null;
            clearInterval(timer);

            console.log("authData", JSON.stringify(authData));
            if (authData) {
              await lastValueFrom(this.preSync({ code: authData.code, state: authData.state, session_state: authData.session_state })).then((res) => {
                if (res.success) {
                  resolve(res);
                } else {
                  resolve({ success: false } as any);
                }
              });
              delete (window as any).WINDOW_AUTH_DATA;
            } else {
              resolve({ success: false } as any);
            }
          }
        }, 500);
      } else {
        resolve({ success: false } as any);
      }
    });
  }
}

interface WindowAuthData {
  code: string;
  state: string;
  session_state: string;
}
