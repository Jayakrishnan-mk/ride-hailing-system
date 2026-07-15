import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum RideState {
  REQUESTED = 'REQUESTED',
  SEARCHING = 'SEARCHING',
  ASSIGNED = 'ASSIGNED',
  TIMEOUT = 'TIMEOUT',
}

@Entity()
export class Ride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'float' })
  pickupLongitude: number;

  @Column({ type: 'float' })
  pickupLatitude: number;

  @Column({ type: 'enum', enum: RideState, default: RideState.REQUESTED })
  state: RideState;

  @Column({ type: 'varchar', nullable: true })
  assignedDriverId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
