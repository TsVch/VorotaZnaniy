import { ConfigService } from '@nestjs/config';
import { ConsoleEmailService, ResendEmailService } from '../utils/email.service';

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

describe('ConsoleEmailService — Advanced Methods', () => {
  let service: ConsoleEmailService;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    service = new ConsoleEmailService(createMockConfig());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('sendPasswordChanged', () => {
    it('should log password change without throwing', async () => {
      await expect(
        service.sendPasswordChanged('user@example.com', 'password'),
      ).resolves.toBeUndefined();
    });

    it('should log email change without throwing', async () => {
      await expect(
        service.sendPasswordChanged('user@example.com', 'email'),
      ).resolves.toBeUndefined();
    });
  });

  describe('sendNewDeviceLogin', () => {
    it('should log new device login without throwing', async () => {
      await expect(
        service.sendNewDeviceLogin('user@example.com', {
          userAgent: 'Chrome 120 / Windows 10',
          ipAddress: '192.168.1.1',
          timestamp: '2026-07-24T12:00:00.000Z',
        }),
      ).resolves.toBeUndefined();
    });

    it('should handle missing optional fields', async () => {
      await expect(
        service.sendNewDeviceLogin('user@example.com', {
          timestamp: '2026-07-24T12:00:00.000Z',
        }),
      ).resolves.toBeUndefined();
    });
  });
});

// ── ResendEmailService ─────────────────────────────────────────────────────

describe('ResendEmailService — Advanced Methods', () => {
  describe('without API key', () => {
    let service: ResendEmailService;

    beforeEach(() => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      service = new ResendEmailService(createMockConfig());
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('sendPasswordChanged: should log without throwing', async () => {
      await expect(
        service.sendPasswordChanged('user@example.com', 'password'),
      ).resolves.toBeUndefined();
    });

    it('sendNewDeviceLogin: should log without throwing', async () => {
      await expect(
        service.sendNewDeviceLogin('user@example.com', {
          userAgent: 'Firefox',
          ipAddress: '10.0.0.1',
          timestamp: new Date().toISOString(),
        }),
      ).resolves.toBeUndefined();
    });
  });
});

// ── Template Integration ───────────────────────────────────────────────────

describe('Advanced Email Templates', () => {
  it('password-changed template renders with change type', () => {
    const { renderPasswordChangedTemplate } = require('../templates/password-changed.template');
    const html = renderPasswordChangedTemplate('password', '2026-07-24T12:00:00.000Z');
    expect(html).toContain('Пароль изменён');
    expect(html).toContain('Пароль был изменён');
    expect(html).toContain('восстановите');
    expect(html).toContain('доступ через форму входа');
  });

  it('password-changed template renders with email type', () => {
    const { renderPasswordChangedTemplate } = require('../templates/password-changed.template');
    const html = renderPasswordChangedTemplate('email', '2026-07-24T12:00:00.000Z');
    expect(html).toContain('Email изменён');
    expect(html).toContain('Email был изменён');
  });

  it('new-device-login template renders with device info', () => {
    const { renderNewDeviceLoginTemplate } = require('../templates/new-device-login.template');
    const html = renderNewDeviceLoginTemplate(
      'Mozilla/5.0 Chrome 120',
      '203.0.113.42',
      '2026-07-24T12:00:00.000Z',
    );
    expect(html).toContain('Вход с нового устройства');
    expect(html).toContain('Mozilla/5.0 Chrome 120');
    expect(html).toContain('203.0.113.42');
    expect(html).toContain('смените');
    expect(html).toContain('пароль в настройках аккаунта');
  });

  it('new-device-login template escapes HTML special chars', () => {
    const { renderNewDeviceLoginTemplate } = require('../templates/new-device-login.template');
    const html = renderNewDeviceLoginTemplate(
      '<script>alert("xss")</script>',
      '10.0.0.1',
      '2026-07-24T12:00:00.000Z',
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
