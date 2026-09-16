import crypto from 'crypto';

export interface ScanResult {
  isClean: boolean;
  threatName?: string;
  checksumSha256: string;
  scannedAt: Date;
  engine: string;
}

export interface MalwareScannerProvider {
  scanBuffer(buffer: Buffer, filename: string): Promise<ScanResult>;
}

/**
 * Built-in production malware scanner abstraction.
 * Validates file magic headers, disallows dangerous executable extensions, and checks signatures.
 * Pluggable for ClamAV, AWS GuardDuty, or VirusTotal enterprise integrations.
 */
export class SafeUploadMalwareScanner implements MalwareScannerProvider {
  private blockedExtensions = [
    '.exe',
    '.bat',
    '.cmd',
    '.sh',
    '.vbs',
    '.scr',
    '.msi',
    '.dll',
    '.jar',
    '.com',
    '.pif',
    '.ps1',
  ];

  // Signature prefixes for known malicious file headers
  private dangerousMagicSignatures = [
    '4d5a', // MZ (DOS/Windows Executable)
    '7f454c46', // ELF (Linux binary)
    'cafebabe', // Java class / Mach-O universal binary
  ];

  async scanBuffer(buffer: Buffer, filename: string): Promise<ScanResult> {
    const checksumSha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const scannedAt = new Date();
    const ext = filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2).toLowerCase();

    // 1. Check blocked extension
    if (this.blockedExtensions.includes(`.${ext}`)) {
      return {
        isClean: false,
        threatName: `Disallowed executable file extension .${ext}`,
        checksumSha256,
        scannedAt,
        engine: 'BuiltIn-Heuristic-V1',
      };
    }

    // 2. Check magic byte header
    const headerHex = buffer.slice(0, 4).toString('hex').toLowerCase();
    for (const badSig of this.dangerousMagicSignatures) {
      if (headerHex.startsWith(badSig) && !['pdf', 'png', 'jpg', 'jpeg', 'webp', 'xlsx', 'docx'].includes(ext)) {
        return {
          isClean: false,
          threatName: 'Potentially malicious executable binary detected in upload payload',
          checksumSha256,
          scannedAt,
          engine: 'BuiltIn-MagicByte-V1',
        };
      }
    }

    // 3. File is clean
    return {
      isClean: true,
      checksumSha256,
      scannedAt,
      engine: 'BuiltIn-SafeValidator-V1',
    };
  }
}

export const defaultMalwareScanner = new SafeUploadMalwareScanner();
