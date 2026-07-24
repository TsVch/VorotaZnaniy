import { ConfigService } from '@nestjs/config';
import { ConsoleEmailService, ResendEmailService } from '../utils/email.service';

// ── Mock ConfigService ─────────────────────────────────────────────────────

function createMockConfig(overrides: Record<string, string> = {}): ConfigService {
  return {
    get: jest.fn((key: string) => {
      const defaults: Record<string, string> = {
        FRONTEND_URL: 'http://localhost:3001',
        EMAIL_FROM: 'noreply@knowledgevault.com',
        RESEND_API_KEY: '',
        ...overrides,
      };
      return defaults[key];
    }),
  } as unknown as ConfigService;
}

// ── ConsoleEmailService ────────────────────────────────────────────────────

describe('ConsoleEmailService', () => {
  let service: ConsoleEmailService;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    service = new ConsoleEmailService(createMockConfig());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sendMagicLink: should log magic link without throwing', async () => {
    await expect(
      service.sendMagicLink('test@example.com', 'mock-token-123'),
    ).resolves.toBeUndefined();
  });

  it('sendPurchaseConfirmation: should log confirmation without throwing', async () => {
    await expect(
      service.sendPurchaseConfirmation(
        'test@example.com',
        'Test Document',
        'http://localhost:3001/viewer/doc-123',
      ),
    ).resolves.toBeUndefined();
  });

  it('sendSessionTerminated: should log alert without throwing', async () => {
    await expect(
      service.sendSessionTerminated(
        'test@example.com',
        'Test Document',
        'Chrome on Windows',
      ),
    ).resolves.toBeUndefined();
  });
});

// ── ResendEmailService ─────────────────────────────────────────────────────

describe('ResendEmailService', () => {
  describe('without API key', () => {
    let service: ResendEmailService;

    beforeEach(() => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      service = new ResendEmailService(createMockConfig());
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('sendMagicLink: should log without throwing when no API key', async () => {
      await expect(
        service.sendMagicLink('test@example.com', 'mock-token'),
      ).resolves.toBeUndefined();
    });

    it('sendPurchaseConfirmation: should log without throwing when no API key', async () => {
      await expect(
        service.sendPurchaseConfirmation(
          'test@example.com',
          'Test Doc',
          'http://localhost:3001/viewer/doc-1',
        ),
      ).resolves.toBeUndefined();
    });

    it('sendSessionTerminated: should log without throwing when no API key', async () => {
      await expect(
        service.sendSessionTerminated(
          'test@example.com',
          'Test Doc',
          'Firefox on macOS',
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should not throw if Resend.send fails (AC-4)', async () => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const config = createMockConfig({ RESEND_API_KEY: 're_mock-key-123' });
      const service = new ResendEmailService(config);

      // Without SDK installed, this should be caught gracefully
      await expect(
        service.sendMagicLink('test@example.com', 'token'),
      ).resolves.toBeUndefined();

      jest.restoreAllMocks();
    });
  });
});

// ── Template Integration ───────────────────────────────────────────────────

describe('Email Templates', () => {
  it('magic-link template renders with link and expiry', () => {
    const { renderMagicLinkTemplate } = require('../templates/magic-link.template');
    const html = renderMagicLinkTemplate('https://example.com/verify?token=abc', 15);
    expect(html).toContain('https://example.com/verify?token=abc');
    expect(html).toContain('15 минут');
    expect(html).toContain('KnowledgeVault');
  });

  it('purchase-confirmation template renders with document title', () => {
    const { renderPurchaseConfirmationTemplate } = require('../templates/purchase-confirmation.template');
    const html = renderPurchaseConfirmationTemplate(
      'My Report.pdf',
      'https://example.com/viewer/doc-1',
    );
    expect(html).toContain('My Report.pdf');
    expect(html).toContain('Secure Viewer');
    expect(html).toContain('Pro');
  });

  it('session-terminated template renders with device info and warning', () => {
    const { renderSessionTerminatedTemplate } = require('../templates/session-terminated.template');
    const html = renderSessionTerminatedTemplate(
      'Confidential.pdf',
      'Chrome 120 / Windows 10',
    );
    expect(html).toContain('Confidential.pdf');
    expect(html).toContain('Chrome 120 / Windows 10');
    expect(html).toContain('Сессия завершена');
    expect(html).toContain('смените пароль');
  });
});
