import {
	WebSocketGateway,
	WebSocketServer,
  } from '@nestjs/websockets';
  
import { OnEvent } from '@nestjs/event-emitter';
import { Server } from 'socket.io';
import { CryptoTicker } from './kraken.service';
  
  @WebSocketGateway({
	cors: {
	  origin: '*',
	},
  })
  export class CryptoGateway {
  
	@WebSocketServer()
	server: Server;
  
	@OnEvent('crypto.ticker')
	handleTicker(ticker: CryptoTicker) {
	  this.server.emit('crypto:ticker', ticker);
	}
  }