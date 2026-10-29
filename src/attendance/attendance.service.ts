import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { CheckInDto } from './check-in.dto';

const ATTENDANCE_TIME_ZONE = 'Africa/Nairobi';
const MAX_LOCATION_AGE_MS = 2 * 60 * 1000;
const MAX_FUTURE_LOCATION_MS = 30 * 1000;
const MAX_ACCURACY_METERS = 100;

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getToday(user: AuthenticatedUser) {
    const { employment, station, workDate } = await this.currentWorkSite(user);
    const attendance = await this.prisma.attendanceRecord.findUnique({
      where: { employmentId_workDate: { employmentId: employment.id, workDate } },
      select: {
        id: true,
        checkInAt: true,
        locationCapturedAt: true,
        accuracyMeters: true,
        distanceMeters: true,
        mockLocationReported: true,
        station: { select: { id: true, code: true, name: true } },
      },
    });

    return {
      workDate: workDate.toISOString().slice(0, 10),
      employment: {
        id: employment.id,
        employmentNumber: employment.employmentNumber,
      },
      station: station
        ? {
            id: station.id,
            code: station.code,
            name: station.name,
            geofenceRadius: Number(station.geofenceRadius),
            configured: true,
          }
        : null,
      attendance,
    };
  }

  async checkIn(dto: CheckInDto, user: AuthenticatedUser) {
    if (dto.mockLocationDetected === true) {
      try {
        await this.auditService.record({
          actorUserId: user.id,
          action: 'POST /attendance/me/check-in rejected',
          entityType: 'attendance_check_in_attempt',
          metadata: {
            reason: 'mock_location_reported',
            accuracyMeters: dto.accuracyMeters,
            locationCapturedAt: dto.locationCapturedAt,
          },
        });
      } catch (error) {
        this.logger.error('Could not record a mock-location attendance attempt', error);
      }
      throw new ForbiddenException(
        'Android reported that this GPS reading is simulated. Turn off mock-location apps and try again with a fresh location.',
      );
    }

    const now = new Date();
    const locationCapturedAt = new Date(dto.locationCapturedAt);
    const age = now.getTime() - locationCapturedAt.getTime();
    if (age > MAX_LOCATION_AGE_MS || age < -MAX_FUTURE_LOCATION_MS) {
      throw new BadRequestException(
        'Location must be captured just before you mark yourself present',
      );
    }
    if (dto.accuracyMeters > MAX_ACCURACY_METERS) {
      throw new BadRequestException(
        `Location accuracy is too low. Try again outdoors with accuracy better than ${MAX_ACCURACY_METERS} metres.`,
      );
    }

    const { employment, station, workDate } = await this.currentWorkSite(user);
    if (!station) {
      throw new ConflictException(
        'Your assigned station does not have a GPS geofence configured. Contact HR.',
      );
    }

    const distanceMeters = this.distanceInMeters(
      dto.latitude,
      dto.longitude,
      Number(station.latitude),
      Number(station.longitude),
    );
    const radiusMeters = Number(station.geofenceRadius);
    if (distanceMeters > radiusMeters) {
      throw new ConflictException(
        `You are outside the assigned workstation area. Your location is about ${Math.round(distanceMeters)} m from the station; the allowed boundary is ${Math.round(radiusMeters)} m. Move inside the boundary and try again.`,
      );
    }
    if (distanceMeters + dto.accuracyMeters > radiusMeters) {
      throw new ConflictException(
        `Your GPS reading is not precise enough to confirm that you are inside the workstation area. You are about ${Math.round(distanceMeters)} m from the station with ${Math.round(dto.accuracyMeters)} m GPS accuracy; move to an open area and try again.`,
      );
    }

    try {
      return await this.prisma.attendanceRecord.create({
        data: {
          employmentId: employment.id,
          stationId: station.id,
          workDate,
          checkInAt: now,
          locationCapturedAt,
          latitude: dto.latitude,
          longitude: dto.longitude,
          accuracyMeters: dto.accuracyMeters,
          distanceMeters,
          mockLocationReported: dto.mockLocationDetected ?? null,
        },
        select: {
          id: true,
          workDate: true,
          checkInAt: true,
          locationCapturedAt: true,
          accuracyMeters: true,
          distanceMeters: true,
          mockLocationReported: true,
          station: { select: { id: true, code: true, name: true } },
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('You have already marked present today');
      }
      throw error;
    }
  }

  private async currentWorkSite(user: AuthenticatedUser) {
    if (!user.personId) {
      throw new ForbiddenException(
        'Attendance is available only to employee portal accounts',
      );
    }

    const employment = await this.prisma.employment.findFirst({
      where: { personId: user.personId, status: 'ACTIVE' },
      select: {
        id: true,
        employmentNumber: true,
        stationId: true,
      },
    });
    if (!employment) {
      throw new NotFoundException('No active employment record was found');
    }

    const workDate = this.nairobiDate(new Date());
    const effectiveDate = new Date(`${workDate.toISOString().slice(0, 10)}T00:00:00.000Z`);
    const posting = await this.prisma.employmentPosting.findFirst({
      where: {
        employmentId: employment.id,
        effectiveFrom: { lte: effectiveDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveDate } }],
      },
      orderBy: { effectiveFrom: 'desc' },
      select: { stationId: true },
    });
    const stationId = posting ? posting.stationId : employment.stationId;
    const station = stationId
      ? await this.prisma.station.findUnique({
          where: { id: stationId },
          select: {
            id: true,
            code: true,
            name: true,
            latitude: true,
            longitude: true,
            geofenceRadius: true,
          },
        })
      : null;

    const configuredStation =
      station?.latitude !== null &&
      station?.latitude !== undefined &&
      station?.longitude !== null &&
      station?.longitude !== undefined &&
      station?.geofenceRadius !== null &&
      station?.geofenceRadius !== undefined &&
      Number(station.geofenceRadius) > 0
        ? station
        : null;

    return { employment, station: configuredStation, workDate };
  }

  private nairobiDate(now: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: ATTENDANCE_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const part = (type: string) => parts.find((item) => item.type === type)?.value;
    return new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00.000Z`);
  }

  private distanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
    const earthRadius = 6_371_000;
    const deltaLat = toRadians(lat2 - lat1);
    const deltaLon = toRadians(lon2 - lon1);
    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(deltaLon / 2) ** 2;
    return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
