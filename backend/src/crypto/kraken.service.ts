import {
	Injectable,
	Logger,
	OnModuleDestroy,
	OnModuleInit,
  } from '@nestjs/common';
  import WebSocket = require('ws');
import { EventEmitter2 } from '@nestjs/event-emitter';
  
export interface CryptoTicker {
	symbol: string;
	bid: number;
	ask: number;
	last: number;
	volume: number;
	vwap: number;
	low: number;
	high: number;
	change: number;
	change_pct: number;
	timestamp: string;
}
  
  @Injectable()
  export class KrakenService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(KrakenService.name);
  
	private ws: WebSocket | null = null;

	constructor(
		private readonly eventEmitter: EventEmitter2,
	  ) {}
  
	private tickers = new Map<string, CryptoTicker>();
  
	onModuleInit() {
	  this.connect();
	}
  
	onModuleDestroy() {
	  this.ws?.close();
	}
  
	private connect() {
	  this.ws = new WebSocket('wss://ws.kraken.com/v2');
  
	  this.ws.on('open', () => {
		this.logger.log('Connected to Kraken');
  
		this.subscribe();
	  });
  
	  this.ws.on('message', (message) => {
		this.handleMessage(message.toString());
	  });
  
	  this.ws.on('error', (error) => {
		this.logger.error(`Kraken WebSocket error: ${error.message}`);
	  });
  
	  this.ws.on('close', () => {
		this.logger.warn('Kraken WebSocket disconnected');
  
		// Reconectar depois de 5 segundos
		setTimeout(() => {
		  this.connect();
		}, 5000);
	  });
	}
  
	private subscribe() {
	  const message = {
		method: 'subscribe',
		params: {
		  channel: 'ticker',
		  symbol: ['BTC/EUR', 'ETH/EUR'],
		},
	  };
  
	  this.ws?.send(JSON.stringify(message));
  
	  this.logger.log('Subscribed to BTC/EUR and ETH/EUR');
	}
  
	private handleMessage(message: string) {
	  try {
		const data = JSON.parse(message);
  
		if (data.channel !== 'ticker') {
		  return;
		}
  
		if (!data.data || !data.data.length) {
		  return;
		}
  
		const ticker = data.data[0];
  
		const crypto: CryptoTicker = {
		  symbol: ticker.symbol,
		  bid: ticker.bid,
		  ask: ticker.ask,
		  last: ticker.last,
		  volume: ticker.volume,
		  vwap: ticker.vwap,
		  low: ticker.low,
		  high: ticker.high,
		  change: ticker.change,
		  change_pct: ticker.change_pct,
		  timestamp: ticker.timestamp,
		};
  
		this.tickers.set(ticker.symbol, crypto);
  
		this.eventEmitter.emit('crypto.ticker', crypto);

		this.logger.debug(
		  `${ticker.symbol}: ${ticker.last} EUR`,
		);
	  } catch (error) {
		this.logger.error('Failed to parse Kraken message');
	  }
	}
  
	getTicker(symbol: string): CryptoTicker | undefined {
	  return this.tickers.get(symbol);
	}
  
	getAllTickers(): CryptoTicker[] {
	  return Array.from(this.tickers.values());
	}
  }