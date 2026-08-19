import { Controller, Get, Param, Query } from '@nestjs/common';
import { CryptoService } from './crypto.service';

@Controller('crypto')
export class CryptoController {
  constructor(private readonly cryptoService: CryptoService) {}

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

  //@Get('bitcoin/history')
  //getBitcoinHistory(@Query('days') days?: string) {
  //  return this.cryptoService.getBitcoinHistory(
  //    days ? Number(days) : 7,
  //  );
  //}
}