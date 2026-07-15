import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { DriverService } from './driver.service';

@Controller('drivers')
export class DriverController {
  constructor(private readonly driverService: DriverService) {}

  @Post('location')
  async updateLocation(
    @Body() body: { driverId: string; longitude: number; latitude: number }
  ) {
    await this.driverService.updateLocation(body.driverId, body.longitude, body.latitude);
    return { success: true, message: 'Driver location updated successfully' };
  }

  @Get('nearby')
  async getNearbyDrivers(
    @Query('longitude') longitude: number,
    @Query('latitude') latitude: number,
    @Query('radius') radius?: number
  ) {
    const drivers = await this.driverService.findNearbyDrivers(
      Number(longitude),
      Number(latitude),
      radius ? Number(radius) : 5
    );
    return { success: true, drivers };
  }
}
