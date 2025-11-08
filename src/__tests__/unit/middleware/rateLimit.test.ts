import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { apiLimiter, strictLimiter, readLimiter } from '../../../api/middleware/rateLimit';
import { logger } from '../../../utils/logger';

// Mock logger
vi.mock('../../../utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Rate Limit Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('apiLimiter', () => {
    it('should be defined and be a function', () => {
      expect(apiLimiter).toBeDefined();
      expect(typeof apiLimiter).toBe('function');
    });

    it('should be an Express middleware function', () => {
      // Rate limiter is a function that can be called as middleware
      expect(apiLimiter).toBeInstanceOf(Function);
      // Middleware functions should have at least 3 parameters (req, res, next)
      expect(apiLimiter.length).toBeGreaterThanOrEqual(3);
    });

    it('should trigger handler and return 429 when rate limit exceeded', async () => {
      const app = express();
      app.use(apiLimiter);
      app.get('/test', (req, res) => res.json({ success: true }));

      // Make requests up to the limit (100)
      for (let i = 0; i < 100; i++) {
        const response = await request(app).get('/test');
        expect(response.status).toBe(200);
      }

      // The 101st request should be rate limited
      const limitedResponse = await request(app).get('/test');
      expect(limitedResponse.status).toBe(429);
      expect(limitedResponse.body).toEqual({
        error: 'Too Many Requests',
        code: 'RATE_LIMIT_EXCEEDED',
        message: expect.stringContaining('15 minutes')
      });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('[RATE LIMIT]')
      );
    });
  });

  describe('strictLimiter', () => {
    it('should be defined and be a function', () => {
      expect(strictLimiter).toBeDefined();
      expect(typeof strictLimiter).toBe('function');
    });

    it('should be an Express middleware function', () => {
      expect(strictLimiter).toBeInstanceOf(Function);
      expect(strictLimiter.length).toBeGreaterThanOrEqual(3);
    });

    it('should trigger handler and return 429 when strict rate limit exceeded', async () => {
      const app = express();
      app.use(strictLimiter);
      app.post('/test', (req, res) => res.json({ success: true }));

      // Make requests up to the limit (20)
      for (let i = 0; i < 20; i++) {
        const response = await request(app).post('/test');
        expect(response.status).toBe(200);
      }

      // The 21st request should be rate limited
      const limitedResponse = await request(app).post('/test');
      expect(limitedResponse.status).toBe(429);
      expect(limitedResponse.body).toEqual({
        error: 'Too Many Requests',
        code: 'RATE_LIMIT_EXCEEDED',
        message: expect.stringContaining('modification')
      });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('[RATE LIMIT]')
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('strict')
      );
    });
  });

  describe('readLimiter', () => {
    it('should be defined and be a function', () => {
      expect(readLimiter).toBeDefined();
      expect(typeof readLimiter).toBe('function');
    });

    it('should be an Express middleware function', () => {
      expect(readLimiter).toBeInstanceOf(Function);
      expect(readLimiter.length).toBeGreaterThanOrEqual(3);
    });

    it('should trigger handler and return 429 when read rate limit exceeded', async () => {
      const app = express();
      app.use(readLimiter);
      app.get('/test', (req, res) => res.json({ success: true }));

      // Make requests up to the limit (300)
      for (let i = 0; i < 300; i++) {
        const response = await request(app).get('/test');
        expect(response.status).toBe(200);
      }

      // The 301st request should be rate limited
      const limitedResponse = await request(app).get('/test');
      expect(limitedResponse.status).toBe(429);
      expect(limitedResponse.body).toEqual({
        error: 'Too Many Requests',
        code: 'RATE_LIMIT_EXCEEDED',
        message: expect.any(String)
      });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('[RATE LIMIT]')
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('read')
      );
    });
  });

  describe('Rate Limiter Differences', () => {
    it('should have three distinct rate limiters', () => {
      expect(apiLimiter).not.toBe(strictLimiter);
      expect(apiLimiter).not.toBe(readLimiter);
      expect(strictLimiter).not.toBe(readLimiter);
    });

    it('should all be callable middleware functions', () => {
      expect(typeof apiLimiter).toBe('function');
      expect(typeof strictLimiter).toBe('function');
      expect(typeof readLimiter).toBe('function');
    });
  });

  describe('Handler Behavior', () => {
    it('should log IP address when rate limit exceeded', async () => {
      const app = express();
      app.use(apiLimiter);
      app.get('/test', (req, res) => res.json({ success: true }));

      // Exceed limit
      for (let i = 0; i <= 100; i++) {
        await request(app).get('/test');
      }

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('::ffff:127.0.0.1')
      );
    });

    it('should include path in warning log', async () => {
      const app = express();
      app.use(strictLimiter);
      app.post('/special/route', (req, res) => res.json({ success: true }));

      // Exceed limit
      for (let i = 0; i <= 20; i++) {
        await request(app).post('/special/route');
      }

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('/special/route')
      );
    });
  });

  describe('Response Format', () => {
    it('should return consistent error structure for apiLimiter', async () => {
      const app = express();
      app.use(apiLimiter);
      app.get('/test', (req, res) => res.json({ success: true }));

      // Exceed limit
      for (let i = 0; i <= 100; i++) {
        await request(app).get('/test');
      }

      const limitedResponse = await request(app).get('/test');
      expect(limitedResponse.body).toHaveProperty('error');
      expect(limitedResponse.body).toHaveProperty('code');
      expect(limitedResponse.body).toHaveProperty('message');
      expect(limitedResponse.body.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should return consistent error structure for strictLimiter', async () => {
      const app = express();
      app.use(strictLimiter);
      app.post('/test', (req, res) => res.json({ success: true }));

      // Exceed limit
      for (let i = 0; i <= 20; i++) {
        await request(app).post('/test');
      }

      const limitedResponse = await request(app).post('/test');
      expect(limitedResponse.body).toHaveProperty('error');
      expect(limitedResponse.body).toHaveProperty('code');
      expect(limitedResponse.body).toHaveProperty('message');
      expect(limitedResponse.body.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });
});
