import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class CryptoService {
  getHistory(coin: string, arg1: number) {
	  throw new Error('Method not implemented.');
  }
  constructor(private readonly httpService: HttpService) {}

  async getBitcoinHistory(days: number = 7) {
    const response = await firstValueFrom(
      this.httpService.get(
        'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart',
        {
          params: {
            vs_currency: 'eur',
            days,
          },
        },
      ),
    );

    return response.data.prices.map(
      ([timestamp, price]: [number, number]) => ({
        timestamp,
        price,
      }),
    );
  }
}