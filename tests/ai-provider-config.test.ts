import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { encryptApiKey, decryptApiKey, maskApiKey } from '../src/lib/security/encryption';
import {
  saveTenantAiConfig,
  getTenantAiConfig,
  deleteTenantAiConfig,
  testAiProviderConnection,
  resolveTenantAiCredentials,
} from '../src/lib/ai/config';
import { processAIAssistantQuery } from '../src/lib/ai/gateway';
import { AuthUser } from '../src/lib/types';

describe('AI Provider API Key Configuration — Security, Multi-Tenancy & RAG', () => {
  let tenantAId: string;
  let tenantBId: string;

  const adminActorA: AuthUser = {
    userId: 'usr-admin-tenant-a',
    tenantId: '',
    email: 'admin@tenanta.com',
    roles: ['COMPANY_ADMIN'],
    permissions: [{ permissionKey: 'organization:manage', dataScope: 'ENTIRE_TENANT', isSensitive: false }],
  };

  const employeeActorA: AuthUser = {
    userId: 'usr-emp-tenant-a',
    tenantId: '',
    email: 'emp@tenanta.com',
    roles: ['EMPLOYEE'],
    permissions: [{ permissionKey: 'employee:read', dataScope: 'OWN', isSensitive: false }],
  };

  const adminActorB: AuthUser = {
    userId: 'usr-admin-tenant-b',
    tenantId: '',
    email: 'admin@tenantb.com',
    roles: ['COMPANY_ADMIN'],
    permissions: [{ permissionKey: 'organization:manage', dataScope: 'ENTIRE_TENANT', isSensitive: false }],
  };

  beforeAll(async () => {
    // 1. Fetch Tenant A
    const tenantA = await prisma.tenant.findFirst({ where: { slug: 'ai-automation-labs' } });
    tenantAId = tenantA!.id;
    adminActorA.tenantId = tenantAId;
    employeeActorA.tenantId = tenantAId;

    // 2. Ensure Tenant B exists
    let tenantB = await prisma.tenant.findFirst({ where: { slug: 'acme-corp' } });
    if (!tenantB) {
      tenantB = await prisma.tenant.create({
        data: {
          name: 'Acme Corporation',
          slug: 'acme-corp',
          status: 'ACTIVE',
          plan: 'GROWTH',
        },
      });
    }
    tenantBId = tenantB.id;
    adminActorB.tenantId = tenantBId;

    // Cleanup any existing AI configurations for clean test run
    await prisma.aIProviderConfiguration.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
  });

  afterAll(async () => {
    // Clean up test configs
    await prisma.aIProviderConfiguration.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
  });

  describe('1. Cryptographic Security & AES-256 Storage', () => {
    it('should encrypt the API key and never store plaintext in database', async () => {
      const plaintextKey = 'sk-test-openai-secret-key-1234567890abcdef';
      const encrypted = encryptApiKey(plaintextKey);

      expect(encrypted).not.toEqual(plaintextKey);
      expect(encrypted).not.toContain(plaintextKey);
      expect(encrypted.split(':').length).toBe(3); // iv : encrypted : authTag

      const decrypted = decryptApiKey(encrypted);
      expect(decrypted).toEqual(plaintextKey);
    });

    it('should mask API keys for client display without leaking characters', () => {
      const masked = maskApiKey('sk-live-1234567890abcdef');
      expect(masked).toBe('••••••••••••••••••••');
      expect(masked).not.toContain('sk-');
      expect(masked).not.toContain('abcdef');
    });
  });

  describe('2. Multi-Tenant Configuration & Isolation', () => {
    it('should allow Tenant A admin to save AI configuration for Google Gemini', async () => {
      const geminiKey = 'AIzaSy-test-gemini-key-tenant-a';
      const saveResult = await saveTenantAiConfig({
        tenantId: tenantAId,
        provider: 'GEMINI',
        apiKey: geminiKey,
        model: 'gemini-1.5-flash',
        actor: adminActorA,
      });

      expect(saveResult.success).toBe(true);
      expect(saveResult.connectionStatus).toBe('CONNECTED');

      // Verify in database: encrypted, not plaintext
      const dbRecord = await prisma.aIProviderConfiguration.findUnique({
        where: { tenantId: tenantAId },
      });
      expect(dbRecord).not.toBeNull();
      expect(dbRecord?.provider).toBe('GEMINI');
      expect(dbRecord?.encryptedApiKey).not.toEqual(geminiKey);
      expect(dbRecord?.encryptedApiKey).not.toContain(geminiKey);

      // Verify safe retrieval
      const safeConfig = await getTenantAiConfig(tenantAId);
      expect(safeConfig.configured).toBe(true);
      expect(safeConfig.provider).toBe('GEMINI');
      expect(safeConfig.maskedApiKey).toBe('••••••••••••••••••••');
      expect((safeConfig as any).apiKey).toBeUndefined();
      expect((safeConfig as any).encryptedApiKey).toBeUndefined();
    });

    it('should strictly isolate Tenant A and Tenant B AI configurations', async () => {
      const openAiKeyB = 'sk-test-openai-key-tenant-b';
      await saveTenantAiConfig({
        tenantId: tenantBId,
        provider: 'OPENAI',
        apiKey: openAiKeyB,
        model: 'gpt-4o-mini',
        actor: adminActorB,
      });

      // Tenant A config check
      const configA = await getTenantAiConfig(tenantAId);
      expect(configA.provider).toBe('GEMINI');
      expect(configA.model).toBe('gemini-1.5-flash');

      // Tenant B config check
      const configB = await getTenantAiConfig(tenantBId);
      expect(configB.provider).toBe('OPENAI');
      expect(configB.model).toBe('gpt-4o-mini');

      // Tenant A resolved credentials should resolve Tenant A's key only
      const credsA = await resolveTenantAiCredentials(tenantAId);
      expect(credsA?.provider).toBe('GEMINI');
      expect(credsA?.apiKey).toBe('AIzaSy-test-gemini-key-tenant-a');
      expect(credsA?.source).toBe('TENANT_CONFIG');

      // Tenant B resolved credentials should resolve Tenant B's key only
      const credsB = await resolveTenantAiCredentials(tenantBId);
      expect(credsB?.provider).toBe('OPENAI');
      expect(credsB?.apiKey).toBe('sk-test-openai-key-tenant-b');
      expect(credsB?.source).toBe('TENANT_CONFIG');
    });
  });

  describe('3. Connection Testing & Validation', () => {
    it('should return connection successful for valid test key', async () => {
      const testRes = await testAiProviderConnection('OPENAI', 'sk-test-valid-key-xyz', 'gpt-4o-mini');
      expect(testRes.success).toBe(true);
      expect(testRes.status).toBe('CONNECTED');
      expect(testRes.message).toContain('Successfully connected to OpenAI');
    });

    it('should return connection failure for invalid test key', async () => {
      const testRes = await testAiProviderConnection('OPENAI', 'sk-test-invalid-fail-key', 'gpt-4o-mini');
      expect(testRes.success).toBe(false);
      expect(testRes.status).toBe('CONNECTION_FAILED');
      expect(testRes.message).toContain('Authentication failed');
    });

    it('should reject unsupported AI providers with clear error', async () => {
      await expect(
        saveTenantAiConfig({
          tenantId: tenantAId,
          provider: 'UNSUPPORTED_PROVIDER',
          apiKey: 'key',
          actor: adminActorA,
        })
      ).rejects.toThrow(/Unsupported AI Provider/);
    });
  });

  describe('4. Audit Logging & Security Sanitization', () => {
    it('should create audit logs for AI config operations without logging the API key', async () => {
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          tenantId: tenantAId,
          action: 'AI_PROVIDER_CONFIG_SAVED',
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog?.entityType).toBe('AI_CONFIG');

      const state = JSON.parse(auditLog?.afterState || '{}');
      expect(state.provider).toBe('GEMINI');
      expect(state.isEncrypted).toBe(true);
      expect(state.apiKey).toBeUndefined();
      expect(state.encryptedApiKey).toBeUndefined();
      expect(JSON.stringify(auditLog)).not.toContain('AIzaSy-test-gemini-key');
    });
  });

  describe('5. RAG Integration & Seamless AI Assistant Continuity', () => {
    it('should ensure existing AI Copilot continues to answer Policy Q&A with tenant config active', async () => {
      const queryRes = await processAIAssistantQuery({
        tenantId: tenantAId,
        role: 'EMPLOYEE',
        query: 'What is the sandwich rule for leave calculations?',
      });

      expect(queryRes.response).toContain('Sandwich Rule');
      expect(queryRes.response).toContain('leave');
    });

    it('should allow deletion of tenant AI configuration and fallback to environment', async () => {
      const delResult = await deleteTenantAiConfig(tenantAId, adminActorA);
      expect(delResult.success).toBe(true);

      const safeConfig = await getTenantAiConfig(tenantAId);
      expect(safeConfig.configured).toBe(false);
      expect(safeConfig.connectionStatus).toBe('NOT_CONFIGURED');

      // AI assistant still operates safely
      const queryRes = await processAIAssistantQuery({
        tenantId: tenantAId,
        role: 'EMPLOYEE',
        query: 'Explain the new tax regime exemptions',
      });
      expect(queryRes.response).toContain('New Tax Regime');
    });
  });
});
