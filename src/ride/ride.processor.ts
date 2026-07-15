import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { RideService } from './ride.service';
import { Logger } from '@nestjs/common';

@Processor('ride-allocation')
export class RideProcessor {
  private readonly logger = new Logger(RideProcessor.name);

  constructor(private readonly rideService: RideService) {}

  @Process('check-timeout')
  async handleTimeout(job: Job) {
    const { rideId, longitude, latitude, attempt, radius } = job.data;
    this.logger.log(`Checking timeout for ride ${rideId} (Attempt ${attempt})`);
    
    await this.rideService.handleRideTimeout(rideId, longitude, latitude, attempt, radius);
  }
}
