import { describe, it, expect, vi } from 'vitest';
import { CreateCallsAndEventsSchema1754950000000 } from '../src/infrastructure/database/migrations/1754950000000-CreateCallsAndEventsSchema';

describe('E6-T1: Migration CreateCallsAndEventsSchema', () => {
  it('should execute up and down migration queries cleanly for calls and call events tables', async () => {
    const migration = new CreateCallsAndEventsSchema1754950000000();
    const queryRunnerMock = {
      query: vi.fn().mockResolvedValue([]),
    } as any;

    await migration.up(queryRunnerMock);
    expect(queryRunnerMock.query).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS calls'));
    expect(queryRunnerMock.query).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS call_events'));
    expect(queryRunnerMock.query).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS call_recordings'));
    expect(queryRunnerMock.query).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS call_transcripts'));
    expect(queryRunnerMock.query).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS transcript_segments'));

    await migration.down(queryRunnerMock);
    expect(queryRunnerMock.query).toHaveBeenCalledWith('DROP TABLE IF EXISTS transcript_segments');
    expect(queryRunnerMock.query).toHaveBeenCalledWith('DROP TABLE IF EXISTS call_transcripts');
    expect(queryRunnerMock.query).toHaveBeenCalledWith('DROP TABLE IF EXISTS call_recordings');
    expect(queryRunnerMock.query).toHaveBeenCalledWith('DROP TABLE IF EXISTS call_events');
    expect(queryRunnerMock.query).toHaveBeenCalledWith('DROP TABLE IF EXISTS calls');
  });
});
