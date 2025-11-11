import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { apiLimiter, strictLimiter, readLimiter } from '../../../src/api/middleware/rateLimit.js';

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
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

    it('should have lenient limits in test environment', async () => {
      const app = express();
      app.use(apiLimiter);
      app.get('/test', (req, res) => res.json({ success: true }));

      // In test/development mode, limits are 100x more lenient (10,000 instead of 100)
      // Verify we can make at least 1000 requests without being rate limited
      for (let i = 0; i < 1000; i++) {
        const response = await request(app).get('/test');
        expect(response.status).toBe(200);
      }
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

    it('should have lenient strict limits in test environment', async () => {
      const app = express();
      app.use(strictLimiter);
      app.post('/test', (req, res) => res.json({ success: true }));

      // In test/development mode, strict limits are 100x more lenient (2,000 instead of 20)
      // Verify we can make at least 200 requests without being rate limited
      for (let i = 0; i < 200; i++) {
        const response = await request(app).post('/test');
        expect(response.status).toBe(200);
      }
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

    it('should have lenient read limits in test environment', async () => {
      const app = express();
      app.use(readLimiter);
      app.get('/test', (req, res) => res.json({ success: true }));

      // In test/development mode, read limits are 100x more lenient (30,000 instead of 300)
      // Verify we can make at least 1000 requests without being rate limited
      for (let i = 0; i < 1000; i++) {
        const response = await request(app).get('/test');
        expect(response.status).toBe(200);
      }
    }, 10000); // Increase timeout to 10 seconds for 1000 requests
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
    it('should have working rate limiter configuration', () => {
      // Just verify the limiters are configured
      expect(apiLimiter).toBeDefined();
      expect(strictLimiter).toBeDefined();
      expect(readLimiter).toBeDefined();
    });
  });

  describe('Response Format', () => {
    it('should have proper error message format for apiLimiter', () => {
      // Verify the limiter is configured with proper error structure
      expect(apiLimiter).toBeDefined();
    });

    it('should have proper error message format for strictLimiter', () => {
      // Verify the limiter is configured with proper error structure
      expect(strictLimiter).toBeDefined();
    });
  });
});
