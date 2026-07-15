import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Ride } from './ride.entity';
import { RideService } from './ride.service';
import { RideController } from './ride.controller';
import { DriverModule } from '../driver/driver.module';
import { RideProcessor } from './ride.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ride]),
    DriverModule,
    BullModule.registerQueue({
      name: 'ride-allocation', // queue name
    }),
  ],
  providers: [RideService, RideProcessor],
  controllers: [RideController],
  exports: [RideService],
})
export class RideModule {}
