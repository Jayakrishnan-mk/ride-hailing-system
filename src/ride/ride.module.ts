import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ride } from './ride.entity';
import { RideService } from './ride.service';
import { RideController } from './ride.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Ride])],
  providers: [RideService],
  controllers: [RideController],
  exports: [RideService],
})
export class RideModule {}
