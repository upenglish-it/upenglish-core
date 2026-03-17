import { Injectable } from "@angular/core";
import { Socket, io } from "socket.io-client";
import { LocalStorageService } from "../local-storage.service";
import { DataManagerService } from "./data-manager.service";
import { environment } from "@isms-env/environment";
import { LocalStorageKeys } from "@isms-core/constants";

@Injectable({
  providedIn: "root",
})
export class SocketIOService {
  public socket: Socket;
  public socketEventName = "recruiter";

  constructor(
    private readonly localStorageService: LocalStorageService,
    private readonly dataManagerService: DataManagerService
  ) {}

  public async connect(): Promise<void> {
    this.socket = io(environment.socketIOUrl, {
      path: "/connection",
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      withCredentials: true,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      transports: ["websocket", "polling"],
      query: {
        authorization: this.localStorageService.get(LocalStorageKeys.AUTHORIZATION),
      },
    });

    this.socket.once("connect", () => {
      console.log("ISMS Socket is connected");
    });

    this.socket.on("connect_error", (err) => {
      console.error(`ISMS Socket Connection Error: ${err.message}`);
    });

    this.socket.on("disconnect", () => {
      // Recruitment socket server was disconnected or has an internal error
      console.error(`ISMS Socket Is Disconnected`);
    });

    // Update user status to `online`
    this.socket.on(this.socketEventName, async (event: IRecruiterSocketIOEvent) => {
      console.log("socket event >> ", event);
      if (event.type === "new-message-from-candidate") {
        this.dataManagerService.newMessageFromCandidate(event.data);
      }
    });
  }

  public reconnect(): void {
    this.disconnect();
    setTimeout(() => {
      this.connect();
    }, 1500);
  }

  public disconnect(): void {
    this.socket.disconnect();
  }
}

export interface IRecruiterSocketIOEvent {
  type: TEventType;
  data: any;
}
type TEventType = "new-message-from-candidate";
