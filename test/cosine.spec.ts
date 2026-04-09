import { cosineSimilarity } from '../src/modules/engine/algorithms/cosine-similarity';

describe('cosineSimilarity', () => {
  it('should return 1 for identical vectors', () => {
    const v = [0.8, 0.2, 0.5, 0.3, 0.4, 0.6, 0.1, 0.0];
    const result = cosineSimilarity(v, v);
    expect(result).toBeCloseTo(1.0, 5);
  });

  it('should return 0 for orthogonal vectors', () => {
    const a = [1, 0, 0, 0, 0, 0, 0, 0];
    const b = [0, 1, 0, 0, 0, 0, 0, 0];
    const result = cosineSimilarity(a, b);
    expect(result).toBeCloseTo(0, 5);
  });

  it('should return 0 for zero vector (avoid divide by zero)', () => {
    const a = [0.5, 0.3, 0.7, 0.2, 0.4, 0.6, 0.1, 0.0];
    const zero = [0, 0, 0, 0, 0, 0, 0, 0];
    const result = cosineSimilarity(a, zero);
    expect(result).toBe(0);
  });

  it('should return 0 for mismatched lengths', () => {
    const a = [0.5, 0.3];
    const b = [0.5, 0.3, 0.7];
    const result = cosineSimilarity(a, b);
    expect(result).toBe(0);
  });

  it('should return high similarity for similar taste profiles', () => {
    const user = [0.9, 0.1, 0.8, 0.1, 0.5, 0.2, 0.0, 0.0];
    const restaurant = [0.8, 0.1, 0.7, 0.2, 0.4, 0.3, 0.0, 0.0];
    const result = cosineSimilarity(user, restaurant);
    expect(result).toBeGreaterThan(0.95);
  });

  it('should return low similarity for different taste profiles', () => {
    const user = [0.0, 0.3, 0.1, 0.1, 0.0, 0.9, 0.0, 1.0];
    const restaurant = [0.9, 0.0, 0.8, 0.0, 0.8, 0.1, 0.0, 0.0];
    const result = cosineSimilarity(user, restaurant);
    expect(result).toBeLessThan(0.3);
  });
});

/*
npx jest --rootDir=. test/cosine.spec.ts  
*/