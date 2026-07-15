import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ride, RideState } from './ride.entity';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RideService {
  private readonly logger = new Logger(RideService.name);

  constructor(
    @InjectRepository(Ride)
    private readonly rideRepository: Repository<Ride>,
    private readonly redisService: RedisService,
  ) {}

  async createRideRequest(longitude: number, latitude: number): Promise<Ride> {
    const ride = this.rideRepository.create({
      pickupLongitude: longitude,
      pickupLatitude: latitude,
      state: RideState.SEARCHING, // Start in SEARCHING state
    });
    return this.rideRepository.save(ride);
  }

  // CORE CONCURRENCY LOGIC
  async acceptRide(rideId: string, driverId: string): Promise<{ success: boolean; message: string }> {
    const client = this.redisService.getClient();
    const assignmentKey = `ride:${rideId}:assignment`;

    // 1. ATOMIC OPERATION: Set Only if Not Exists (NX)
    // We add an Expiration (EX) of 24 hours to prevent orphaned keys in Redis.
    // If the key already exists, Redis returns null. This makes it naturally idempotent.
    const acquired = await client.set(assignmentKey, driverId, 'EX', 86400, 'NX');

    if (!acquired) {
      // Another driver beat them to it, or they already accepted it.
      // We check who won to return a better message (helps with Idempotency)
      const winningDriver = await client.get(assignmentKey);
      if (winningDriver === driverId) {
        return { success: true, message: 'You have already accepted this ride' };
      }
      this.logger.log(`Driver ${driverId} rejected for ride ${rideId} (Race condition lost)`);
      return { success: false, message: 'Ride already accepted by another driver' };
    }

    // 2. We won the race! Safe to update Postgres.
    const ride = await this.rideRepository.findOne({ where: { id: rideId } });
    
    if (!ride) {
      await client.del(assignmentKey); // Rollback Redis if DB is inconsistent
      return { success: false, message: 'Ride not found' };
    }

    if (ride.state !== RideState.SEARCHING) {
      await client.del(assignmentKey); // Rollback Redis
      return { success: false, message: `Ride is no longer available (State: ${ride.state})` };
    }

    // Update state to ASSIGNED
    ride.state = RideState.ASSIGNED;
    ride.assignedDriverId = driverId;
    await this.rideRepository.save(ride);

    this.logger.log(`Driver ${driverId} successfully assigned to ride ${rideId}`);
    return { success: true, message: 'Ride successfully assigned' };
  }
}
