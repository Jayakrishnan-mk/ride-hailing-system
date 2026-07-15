import { Controller, Post, Body, Param } from '@nestjs/common';
import { RideService } from './ride.service';

@Controller('rides')
export class RideController {
  constructor(private readonly rideService: RideService) {}

  @Post()
  async requestRide(@Body() body: { longitude: number; latitude: number }) {
    const ride = await this.rideService.createRideRequest(body.longitude, body.latitude);
    return { success: true, ride };
  }

  @Post(':id/accept')
  async acceptRide(
    @Param('id') rideId: string,
    @Body('driverId') driverId: string,
  ) {
    const result = await this.rideService.acceptRide(rideId, driverId);
    return result;
  }
}
