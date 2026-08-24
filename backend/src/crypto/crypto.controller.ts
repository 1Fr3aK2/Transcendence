import { Controller, Get, Param, Query } from '@nestjs/common';
import { CryptoService } from './crypto.service';
import { KrakenService } from './kraken.service';


@Controller('crypto')
export class CryptoController {
	constructor(
		private readonly cryptoService: CryptoService,
		private readonly krakenService: KrakenService,
	  ) {}

	@Get(':coin')
	getCurrentPrice(@Param('coin') coin: string) {
	    const symbol = `${coin.toUpperCase()}/EUR`;

	    return this.krakenService.getTicker(symbol);
	}

  @Get(':coin/history')
  getHistory(
    @Param('coin') coin: string,
    @Query('days') days?: string,
  ) {
    return this.cryptoService.getHistory(
      coin,
      days ? Number(days) : 7,
    );
  }
}