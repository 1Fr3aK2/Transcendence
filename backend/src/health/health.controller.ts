import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
	constructor(
		private readonly healthService: HealthService,
	) { }

	@Get()
	async check() {
		const database = await this.healthService.checkDatabase();
		const redis = await this.healthService.checkRedis();
		const vault = await this.healthService.checkVault();

		const status = database && redis && vault ? 'ok' : 'error';

		const result = {
			status,
			database: database ? 'up' : 'down',
			redis: redis ? 'up' : 'down',
			vault: vault ? 'up' : 'down',
		};

		if (status === 'error') {
			throw new ServiceUnavailableException(result);
		}

		return result;
	}
}