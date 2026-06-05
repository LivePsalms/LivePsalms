import { describe, it, expect } from 'vitest';
import { targetDimensions, grayscaleContrastInPlace } from './image-preprocess';

describe('targetDimensions', () => {
  it('downscales the long edge to the cap, preserving aspect', () => {
    expect(targetDimensions(3000, 2000, 1500)).toEqual({ width: 1500, height: 1000 });
  });
  it('downscales when height is the long edge', () => {
    expect(targetDimensions(2000, 3000, 1500)).toEqual({ width: 1000, height: 1500 });
  });
  it('leaves small images unchanged', () => {
    expect(targetDimensions(800, 600, 1500)).toEqual({ width: 800, height: 600 });
  });
});

describe('grayscaleContrastInPlace', () => {
  it('makes R=G=B (grayscale) for every pixel', () => {
    const data = new Uint8ClampedArray([10, 200, 90, 255, 60, 60, 60, 255]);
    grayscaleContrastInPlace(data);
    expect(data[0]).toBe(data[1]);
    expect(data[1]).toBe(data[2]);
    expect(data[4]).toBe(data[5]);
    expect(data[5]).toBe(data[6]);
  });
  it('preserves the alpha channel', () => {
    const data = new Uint8ClampedArray([10, 200, 90, 128]);
    grayscaleContrastInPlace(data);
    expect(data[3]).toBe(128);
  });
  it('stretches contrast so the darkest pixel→0 and brightest→255', () => {
    const data = new Uint8ClampedArray([80, 80, 80, 255, 160, 160, 160, 255]);
    grayscaleContrastInPlace(data);
    expect(data[0]).toBe(0);
    expect(data[4]).toBe(255);
  });
});
