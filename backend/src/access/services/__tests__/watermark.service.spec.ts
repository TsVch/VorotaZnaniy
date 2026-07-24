import { WatermarkService } from '../watermark.service';

describe('WatermarkService', () => {
  let service: WatermarkService;

  beforeEach(() => {
    service = new WatermarkService();
  });

  describe('generateWatermarkPayload', () => {
    it('AC-3: should return userEmail unchanged', () => {
      const payload = service.generateWatermarkPayload(
        'buyer@example.com',
        '12345678-1234-1234-1234-123456789abc',
      );

      expect(payload.userEmail).toBe('buyer@example.com');
    });

    it('AC-3: should return first 8 characters of sessionId as sessionIdShort', () => {
      const payload = service.generateWatermarkPayload(
        'user@test.com',
        'abcdef12-3456-7890-abcd-ef1234567890',
      );

      expect(payload.sessionIdShort).toBe('abcdef12');
      expect(payload.sessionIdShort.length).toBe(8);
    });

    it('AC-3: should return current date in YYYY-MM-DD format', () => {
      const payload = service.generateWatermarkPayload(
        'user@test.com',
        '12345678-1234-1234-1234-123456789abc',
      );

      expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should handle a short sessionId gracefully (less than 8 chars)', () => {
      const payload = service.generateWatermarkPayload(
        'user@test.com',
        'abc',
      );

      expect(payload.sessionIdShort).toBe('abc');
      expect(payload.sessionIdShort.length).toBe(3);
    });

    it('should handle empty sessionId gracefully', () => {
      const payload = service.generateWatermarkPayload(
        'user@test.com',
        '',
      );

      expect(payload.sessionIdShort).toBe('');
    });

    it('should return the complete payload object with all required fields', () => {
      const payload = service.generateWatermarkPayload(
        'creator@knowledgevault.com',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      );

      expect(payload).toEqual({
        userEmail: 'creator@knowledgevault.com',
        sessionIdShort: 'a1b2c3d4',
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      });
    });
  });
});
