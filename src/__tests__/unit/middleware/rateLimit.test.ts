import { describe, it, expect, vi } from 'vitest';
import { apiLimiter, strictLimiter, readLimiter } from '../../../api/middleware/rateLimit';

// Mock logger
vi.mock('../../../utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Rate Limit Middleware', () => {

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
});
