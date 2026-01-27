import { logger, LogLevel } from '@/lib/logger';

// Mock console methods
const originalConsole = { ...console };

describe('Logger', () => {
  beforeEach(() => {
    // Reset console mocks
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    console.debug = jest.fn();
  });

  afterEach(() => {
    // Restore original console
    Object.assign(console, originalConsole);
  });

  describe('log levels', () => {
    it('should log info messages', () => {
      logger.info('Test info message');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Test info message')
      );
    });

    it('should log error messages', () => {
      logger.error('Test error message');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]')
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Test error message')
      );
    });

    it('should log warning messages', () => {
      logger.warn('Test warning message');
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('[WARN]')
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Test warning message')
      );
    });

    it('should log debug messages in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      logger.debug('Test debug message');
      expect(console.debug).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG]')
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('log with metadata', () => {
    it('should include metadata in log output', () => {
      logger.info('Test message', { key: 'value', number: 123 });
      const logCall = (console.log as jest.Mock).mock.calls[0][0];
      expect(logCall).toContain('Test message');
      expect(logCall).toContain('"key":"value"');
      expect(logCall).toContain('"number":123');
    });
  });

  describe('logError', () => {
    it('should log error objects with stack trace', () => {
      const error = new Error('Test error');
      logger.logError(error, { context: 'test' });

      expect(console.error).toHaveBeenCalled();
      const logCall = (console.error as jest.Mock).mock.calls[0][0];
      expect(logCall).toContain('Test error');
      expect(logCall).toContain('context');
    });

    it('should handle non-Error objects', () => {
      logger.logError('String error', { context: 'test' });
      expect(console.error).toHaveBeenCalled();
    });
  });
});
