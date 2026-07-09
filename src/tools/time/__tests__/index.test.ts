import { getTimeTool } from '../index';

describe('get_time tool', () => {
  const originalDate = Date;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:30:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return current time in specified timezone', async () => {
    const params = { timezone: 'UTC' };
    const result = await getTimeTool.execute('call-1', params);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Current time in UTC');
    expect(result.details.timestamp).toBeDefined();
    expect(result.isError).toBeFalsy();
  });

  it('should default to UTC when no timezone provided (branch: falsy)', async () => {
    const result = await getTimeTool.execute('call-2', {});
    expect(result.content[0].text).toContain('Current time in UTC');
  });

  it('should handle timezone Asia/Ho_Chi_Minh', async () => {
    const result = await getTimeTool.execute('call-3', { timezone: 'Asia/Ho_Chi_Minh' });
    expect(result.content[0].text).toContain('Asia/Ho_Chi_Minh');
  });

  it('should catch errors and return error message (branch: catch)', async () => {
    // Cause an error by mocking Date.prototype.toLocaleString to throw
    const spy = vi.spyOn(Date.prototype, 'toLocaleString').mockImplementation(function(this: Date) {
      throw new Error('Locale error');
    });

    const result = await getTimeTool.execute('call-4', { timezone: 'UTC' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error:');

    spy.mockRestore();
  });
});
