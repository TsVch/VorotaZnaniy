import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { HealthController } from '../health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should return status ok with timestamp', () => {
      const result = controller.check();

      expect(result).toBeDefined();
      expect(result.status).toBe('ok');
      expect(typeof result.timestamp).toBe('number');
    });

    it('should return a timestamp close to current time', () => {
      const before = Date.now();
      const result = controller.check();
      const after = Date.now();

      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(after);
    });
  });
});
