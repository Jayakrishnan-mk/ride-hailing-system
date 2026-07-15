import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ride, RideState } from './ride.entity';
import { RedisService } from '../redis/redis.service';
import { DriverService } from '../driver/driver.service';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

@Injectable()
export class RideService {
  private readonly logger = new Logger(RideService.name);
  private readonly TIMEOUT_MS = 10000; // 10 seconds for testing
  private readonly MAX_RETRIES = 3;

  constructor(
    @InjectRepository(Ride)
    private readonly rideRepository: Repository<Ride>,
    private readonly redisService: RedisService,
    private readonly driverService: DriverService,
    @InjectQueue('ride-allocation') private readonly rideQueue: Queue,
  ) {}

  async createRideRequest(longitude: number, latitude: number): Promise<Ride> {
    const ride = this.rideRepository.create({
      pickupLongitude: longitude,
      pickupLatitude: latitude,
      state: RideState.SEARCHING,
    });
    const savedRide = await this.rideRepository.save(ride);

    // Initial driver search
    const radius = 5;
    const drivers = await this.driverService.findNearbyDrivers(longitude, latitude, radius);
    this.logger.log(`Notifying drivers [${drivers.join(',')}] for ride ${savedRide.id}`);
    
    // Adding a delayed job to check if it timed out
    await this.rideQueue.add(
      'check-timeout',
      { rideId: savedRide.id, longitude, latitude, attempt: 1, radius },
      { delay: this.TIMEOUT_MS }
    );

    return savedRide;
  }

  // CORE CONCURRENCY LOGIC
  async acceptRide(rideId: string, driverId: string): Promise<{ success: boolean; message: string }> {
    const client = this.redisService.getClient();
    const assignmentKey = `ride:${rideId}:assignment`;

    // 1. ATOMIC OPERATION: Set Only if Not Exists (NX)
    const acquired = await client.set(assignmentKey, driverId, 'EX', 86400, 'NX');

    if (!acquired) {
      const winningDriver = await client.get(assignmentKey);
      if (winningDriver === driverId) return { success: true, message: 'You have already accepted this ride' };
      return { success: false, message: 'Ride already accepted by another driver' };
    }

    // We won the Redis race against other drivers!
    const result = await this.rideRepository.update(
      { id: rideId, state: RideState.SEARCHING }, // update if still SEARCHING
      { state: RideState.ASSIGNED, assignedDriverId: driverId }
    );
    
    if (result.affected === 0) {
      // if result.affected is 0, it means the ride is no longer in SEARCHING state, 
      // it could be already assigned to some other driver or timed out.
      await client.del(assignmentKey); // Rollback Redis lock
      this.logger.warn(`Driver ${driverId} accepted ride ${rideId} just as it timed out.`);
      return { success: false, message: 'Ride is no longer available (Timed out)' };
    }

    this.logger.log(`Driver ${driverId} successfully assigned to ride ${rideId}`);
    return { success: true, message: 'Ride successfully assigned' };
  }

  // Background Worker Logic
  async handleRideTimeout(rideId: string, longitude: number, latitude: number, attempt: number, currentRadius: number) {
    const ride = await this.rideRepository.findOne({ where: { id: rideId } });
    if (!ride || ride.state !== RideState.SEARCHING) return; // Already assigned, do nothing

    if (attempt >= this.MAX_RETRIES) {
      const result = await this.rideRepository.update(
        { id: rideId, state: RideState.SEARCHING },
        { state: RideState.TIMEOUT }
      );
      if (result.affected && result.affected > 0) {
        this.logger.warn(`Ride ${rideId} timed out after ${this.MAX_RETRIES} attempts`);
      }
      return;
    }

    // Retry with an expanded radius
    const newRadius = currentRadius + 5;
    const nextAttempt = attempt + 1;
    this.logger.log(`Retrying ride ${rideId} with radius ${newRadius}km (Attempt ${nextAttempt})`);

    const drivers = await this.driverService.findNearbyDrivers(longitude, latitude, newRadius);
    this.logger.log(`Notifying new drivers [${drivers.join(',')}] for ride ${rideId}`);

    // Schedule the next check
    await this.rideQueue.add(
      'check-timeout',
      { rideId, longitude, latitude, attempt: nextAttempt, radius: newRadius },
      { delay: this.TIMEOUT_MS }
    );
  }
}
