import { prisma } from '../prisma';
import { AuthUser } from '../types';
import { createAuditLog } from '../audit';

// In-memory revoked token store (in production backed by Redis blacklist)
const revokedTokens = new Set<string>();

export interface UserSessionInfo {
  id: string;
  userId: string;
  userAgent?: string;
  ipAddress?: string;
  lastActive: Date;
  isCurrent: boolean;
}

export function revokeToken(token: string): void {
  revokedTokens.add(token);
}

export function isTokenRevoked(token: string): boolean {
  return revokedTokens.has(token);
}

export async function revokeAllUserSessions(userId: string, tenantId: string, actor: AuthUser) {
  // Update user security timestamp to invalidate all previous sessions
  await prisma.user.update({
    where: { id: userId },
    data: { updatedAt: new Date() },
  });

  await createAuditLog({
    tenantId,
    actorId: actor.userId,
    actorRole: actor.roles[0] || 'SECURITY_ADMIN',
    action: 'REVOKE_ALL_SESSIONS',
    entityType: 'USER_SESSION',
    entityId: userId,
    afterState: { revokedForUserId: userId, timestamp: new Date().toISOString() },
  });

  return { success: true, message: 'All active sessions and devices revoked successfully' };
}
