import { describe, expect, it } from 'vitest';
import {
  formatAnswers,
  hasProblemSigns,
  isEchoOfExamples,
  isNoneAnswer,
  normalizeAnswer,
  parseConditionName,
  parseHealth,
  parseName,
  parsePlantName,
  parseSigns,
  parseYesNo,
  shouldAskCondition,
} from './parse-answers';

const a = (text: string, truncated = false) => ({ text, truncated });

describe('answer normalisation', () => {
  it('trims whitespace, quotes, prefixes and trailing punctuation', () => {
    expect(normalizeAnswer('  "Answer: Brown spots."  ')).toBe('Brown spots');
  });

  it('parses yes/no answers and rejects ambiguity', () => {
    expect(parseYesNo(' Yes.')).toBe('yes');
    expect(parseYesNo('No')).toBe('no');
    expect(parseYesNo('There is a leaf')).toBe('yes');
    expect(parseYesNo('Possibly')).toBeNull();
  });

  it('parses health answers, preferring "unclear" and "diseased" over a bare "healthy"', () => {
    expect(parseHealth('Healthy.')).toBe('healthy');
    expect(parseHealth('Diseased')).toBe('diseased');
    expect(parseHealth('It is not healthy')).toBe('diseased');
    expect(parseHealth('Unclear.')).toBe('unclear');
    expect(parseHealth('banana')).toBeNull();
  });

  it('parses names and treats unknown-style answers as null', () => {
    expect(parseName('Tomato.').value).toBe('Tomato');
    expect(parseName('it is a maple').value).toBe('Maple');
    expect(parseName('Unknown').value).toBeNull();
    expect(parseName("I don't know").value).toBeNull();
    const long = parseName('This plant appears to be some kind of leafy green that grows in gardens');
    expect(long.value).toBeNull();
    expect(long.warning).toMatch(/long answer/);
  });

  it('rejects generic plant names', () => {
    expect(parsePlantName('Plant.').value).toBeNull();
    expect(parsePlantName('A leaf').value).toBeNull();
    expect(parsePlantName('Basil').value).toBe('Basil');
  });

  it('drops condition answers that contain treatment instructions or doses', () => {
    const unsafe = parseConditionName('Spray 5 ml copper fungicide per litre');
    expect(unsafe.value).toBeNull();
    expect(unsafe.warning).toMatch(/treatment instructions/);
    expect(parseConditionName('Powdery mildew').value).toBe('Powdery mildew');
  });

  it('splits sign descriptions and recognises "none"', () => {
    expect(parseSigns('Brown spots and yellowing edges, small holes.')).toEqual(['Brown spots', 'Yellowing edges', 'Small holes']);
    expect(parseSigns('None.')).toEqual([]);
    expect(parseSigns('No visible symptoms')).toEqual([]);
    expect(isNoneAnswer('0.')).toBe(true);
    expect(hasProblemSigns(['Brown spots'])).toBe(true);
    expect(hasProblemSigns(['Green and shiny'])).toBe(false);
  });

  it('detects answers that echo the question’s examples (recorded SmolVLM-256M output)', () => {
    expect(isEchoOfExamples(' Brown spots, yellowing, black circles/holes, wilting, mold or white powder.')).toBe(true);
    expect(isEchoOfExamples('Brown spots.')).toBe(false);
  });

  it('formats a bounded transcript and marks cut-off answers', () => {
    expect(formatAnswers({ isPlant: a('Yes.'), signs: a('Brown sp', true) })).toBe('isPlant: Yes.\nsigns: Brown sp [cut off]');
  });
});

describe('shouldAskCondition', () => {
  it('asks only when a problem is suspected', () => {
    expect(shouldAskCondition({ isPlant: a('Yes'), health: a('Unclear'), signs: a('Brown spots') })).toBe(true);
    expect(shouldAskCondition({ isPlant: a('Yes'), health: a('Healthy'), signs: a('None') })).toBe(false);
    expect(shouldAskCondition({ isPlant: a('No') })).toBe(false);
  });
});
