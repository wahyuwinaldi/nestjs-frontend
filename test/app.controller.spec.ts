import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from '../src/app.controller';

describe('AppController', () => {
  let app: TestingModule;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();
  });

  describe('health', () => {
    it('returns an "up" status wrapped in the standard envelope', () => {
      const appController = app.get(AppController);
      const result = appController.health();
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('up');
      expect(result.data?.timestamp).toEqual(expect.any(String));
    });
  });
});
