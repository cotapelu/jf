import { describe, it, expect } from 'vitest';
import { substitutePromptArgs, parseCommandArgs } from './prompt-hook-extension.js';

describe('substitutePromptArgs', () => {
  it('should substitute positional args $1, $2, $3', () => {
    const content = '$1-$2-$3';
    const args = ['a', 'b', 'c'];
    expect(substitutePromptArgs(content, args)).toBe('a-b-c');
  });

  it('should return empty string for missing positional args (no default)', () => {
    const content = '$1-$2-$3';
    const args = ['a'];
    // $2 and $3 missing -> empty strings
    expect(substitutePromptArgs(content, args)).toBe('a--');
  });

  it('should substitute $@ and $ARGUMENTS with all args joined', () => {
    const content = 'args: $@, all: $ARGUMENTS';
    const args = ['x', 'y', 'z'];
    expect(substitutePromptArgs(content, args)).toBe('args: x y z, all: x y z');
  });

  it('should substitute ${N:-default} with default when arg missing', () => {
    const content = '${1:-default1} ${2:-default2}';
    const args: string[] = [];
    expect(substitutePromptArgs(content, args)).toBe('default1 default2');
  });

  it('should substitute ${N:-default} with arg when present', () => {
    const content = '${1:-default1} ${2:-default2}';
    const args = ['val1', 'val2'];
    expect(substitutePromptArgs(content, args)).toBe('val1 val2');
  });

  it('should use default for ${N:-default} when arg is empty string', () => {
    const content = '${1:-default1}';
    const args = [''];
    expect(substitutePromptArgs(content, args)).toBe('default1');
  });

  it('should handle mixed substitutions', () => {
    const content = '$1 ${2:-missing} $@ ${3:-def}';
    const args = ['first', 'second'];
    // $1->first, ${2:-missing}->second, $@->'first second', ${3:-def}->'def'
    expect(substitutePromptArgs(content, args)).toBe('first second first second def');
  });

  it('should support ${@:N} slice from N (1-indexed)', () => {
    const content = '${@:2}';
    const args = ['a', 'b', 'c', 'd'];
    expect(substitutePromptArgs(content, args)).toBe('b c d');
  });

  it('should support ${@:N:L} slice with length', () => {
    const content = '${@:2:2}';
    const args = ['a', 'b', 'c', 'd'];
    expect(substitutePromptArgs(content, args)).toBe('b c');
  });

  it('should handle ${@:1} returns all args', () => {
    const content = '${@:1}';
    const args = ['a', 'b', 'c'];
    expect(substitutePromptArgs(content, args)).toBe('a b c');
  });

  it('should return original content when no patterns match', () => {
    const content = 'Hello world, no substitutions';
    const args = ['a', 'b'];
    expect(substitutePromptArgs(content, args)).toBe(content);
  });
});

describe('parseCommandArgs', () => {
  it('should split input by whitespace respecting quotes', () => {
    expect(parseCommandArgs('one two "three four" five')).toEqual(['one', 'two', 'three four', 'five']);
  });

  it('should handle single quotes', () => {
    expect(parseCommandArgs("cmd 'arg with spaces' other")).toEqual(['cmd', 'arg with spaces', 'other']);
  });

  it('should trim and collapse multiple spaces', () => {
    expect(parseCommandArgs('  one   two  three  ')).toEqual(['one', 'two', 'three']);
  });

  it('should return empty array for empty string', () => {
    expect(parseCommandArgs('')).toEqual([]);
  });

  it('should handle quotes without spaces', () => {
    expect(parseCommandArgs('"single"')).toEqual(['single']);
  });
});
