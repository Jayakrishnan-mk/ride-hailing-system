import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class DriverService {
  private readonly GEO_KEY = 'drivers:locations';

  constructor(private readonly redisService: RedisService) {}

  // 1. Update dynamic driver location
  async updateLocation(driverId: string, longitude: number, latitude: number): Promise<void> {
    const client = this.redisService.getClient();
    // GEOADD key longitude latitude member
    await client.geoadd(this.GEO_KEY, longitude, latitude, driverId);
  }

  // 2. Discover nearby drivers
  async findNearbyDrivers(longitude: number, latitude: number, radiusKm: number = 5): Promise<string[]> {
    const client = this.redisService.getClient();
    
    // Using GEOSEARCH (Requires Redis 6.2+)
    // Returns driver IDs sorted by distance (ASC)
    const drivers = await client.geosearch(
      this.GEO_KEY,
      'FROMLONLAT', longitude, latitude,
      'BYRADIUS', radiusKm, 'km',
      'ASC'
    );
    
    return drivers as string[];
  }
}
