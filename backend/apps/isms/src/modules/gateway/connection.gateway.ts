import { MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { ReturnModelType } from '@typegoose/typegoose';
import { isEmpty } from 'lodash';
import { InjectModel } from 'nestjs-typegoose';
import { getConnectionToken } from 'nestjs-typegoose';
import mongoose from 'mongoose';
import { Server, Socket } from 'socket.io';
import { Inject } from '@nestjs/common';
import { ConnectionSocketIO, IAuthToken, NodeRSADecryptService } from 'apps/common';

@WebSocketGateway({
  path: '/connection',
  cors: {
    origin: '*',
  },
})
export class ConnectionGateway implements OnGatewayDisconnect, OnGatewayConnection {
  @WebSocketServer()
  public server: Server;

  constructor(
    // @InjectModel(ConnectionSocketIO) private readonly connectionSocketIO: ReturnModelType<typeof ConnectionSocketIO>,
    @Inject(getConnectionToken()) private connection: mongoose.Connection,
  ) {}

  // @UseInterceptors(SocketIOInterceptor)
  public handleConnection(client: Socket): void {
    // console.log('Connected ', client.id, client.handshake.headers);
    const authorization: string = client.handshake.query.authorization as string;
    const userAgent: string = client.handshake.headers['user-agent'] as string;
    this.manageConnectedAndDisconnected({
      type: 'connected',
      socketId: client.id,
      userAgent: userAgent,
      authorization: authorization,
    });
  }

  public handleDisconnect(client: Socket): void {
    // console.log('Disconnected ', client.id, client.handshake.query);
    const authorization: string = client.handshake.query.authorization as string;
    const userAgent: string = client.handshake.headers['user-agent'] as string;
    this.manageConnectedAndDisconnected({
      type: 'disconnected',
      socketId: client.id,
      userAgent: userAgent,
      authorization: authorization,
    });
  }

  @SubscribeMessage('connection')
  public async handleEmitData(
    @MessageBody()
    message,
  ): Promise<void> {
    console.log('message ', message);
  }

  private manageConnectedAndDisconnected(data: { type: 'connected' | 'disconnected'; socketId: string; userAgent: string; authorization: string }): void {
    if (this.connection.readyState === 1) {
      if (!isEmpty(data.authorization) || !isEmpty(NodeRSADecryptService(data.authorization))) {
        // const decryptedXAuthToken = NodeRSADecryptService(data.authorization) as IAuthToken;
      }
    }
  }
}
