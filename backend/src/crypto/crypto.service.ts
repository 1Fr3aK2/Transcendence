import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class CryptoService {
  constructor(private readonly httpService: HttpService) {}

  async getHistory(coin: string, days: number = 7) {
    const response = await firstValueFrom(
      this.httpService.get(
        `https://api.coingecko.com/api/v3/coins/${coin}/market_chart`,
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