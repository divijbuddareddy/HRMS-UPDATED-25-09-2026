import { recordRawAttendancePunch } from '../attendance/engine';
import { prisma } from '../prisma';

export interface RawBiometricLog {
  deviceSerial: string;
  biometricUserId: string; // Employee code or badge ID
  timestamp: string; // ISO or YYYY-MM-DD HH:mm:ss
  punchState: 'CHECK_IN' | 'CHECK_OUT' | 'AUTO';
  ipAddress?: string;
  terminalName?: string;
}

export interface BiometricSyncResult {
  totalProcessed: number;
  successfulPunches: number;
  unmappedUsers: string[];
  errors: string[];
}

export interface BiometricDeviceAdapter {
  normalizePunchLog(rawLog: any): RawBiometricLog;
  syncPunchLogs(tenantId: string, logs: RawBiometricLog[]): Promise<BiometricSyncResult>;
}

export class GenericBiometricAdapter implements BiometricDeviceAdapter {
  normalizePunchLog(rawLog: any): RawBiometricLog {
    return {
      deviceSerial: rawLog.device_serial || rawLog.DeviceSerial || 'ZKT-BIO-01',
      biometricUserId: String(rawLog.user_id || rawLog.BadgeNumber || rawLog.employee_code).trim(),
      timestamp: rawLog.timestamp || rawLog.LogTime || new Date().toISOString(),
      punchState: (rawLog.state === '0' || rawLog.punchState === 'CHECK_IN') ? 'CHECK_IN' : 'CHECK_OUT',
      ipAddress: rawLog.ip || '10.0.0.50',
      terminalName: rawLog.terminal_name || 'Main Reception Biometric Gate',
    };
  }

  async syncPunchLogs(tenantId: string, logs: RawBiometricLog[]): Promise<BiometricSyncResult> {
    const result: BiometricSyncResult = {
      totalProcessed: logs.length,
      successfulPunches: 0,
      unmappedUsers: [],
      errors: [],
    };

    for (const log of logs) {
      try {
        // Find employee by employeeCode or workEmail
        const employee = await prisma.employee.findFirst({
          where: {
            tenantId,
            OR: [
              { employeeCode: log.biometricUserId },
              { workEmail: { startsWith: log.biometricUserId } },
            ],
          },
        });

        if (!employee) {
          result.unmappedUsers.push(log.biometricUserId);
          continue;
        }

        const punchTime = new Date(log.timestamp);
        await recordRawAttendancePunch({
          tenantId,
          employeeId: employee.id,
          punchType: log.punchState === 'AUTO' ? 'CHECK_IN' : log.punchState,
          deviceType: 'BIOMETRIC',
          ipAddress: log.ipAddress,
          timestamp: punchTime,
        });

        result.successfulPunches += 1;
      } catch (err: any) {
        result.errors.push(`Error syncing log for user ${log.biometricUserId}: ${err.message}`);
      }
    }

    return result;
  }
}

export const defaultBiometricAdapter = new GenericBiometricAdapter();
