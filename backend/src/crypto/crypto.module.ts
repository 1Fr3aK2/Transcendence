import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CryptoController } from './crypto.controller';
import { CryptoService } from './crypto.service';
import { KrakenService } from './kraken.service';
import { CryptoGateway } from './crypto.gateway';


@Module({
  imports: [HttpModule],
  controllers: [CryptoController],
  providers: [CryptoService,
	KrakenService,
    CryptoGateway,
  ],
  exports: [KrakenService],
  
})
export class CryptoModule {}