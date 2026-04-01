import { toSlug } from './index';

describe('toSlug', () => {
  describe('basic conversion', () => {
    it('should convert spaces to hyphens', () => {
      expect(toSlug('Living Room')).toBe('living-room');
    });

    it('should convert to lowercase', () => {
      expect(toSlug('MODERN SOFA')).toBe('modern-sofa');
    });

    it('should trim leading and trailing whitespace', () => {
      expect(toSlug('  couch  ')).toBe('couch');
    });

    it('should handle single word', () => {
      expect(toSlug('Furniture')).toBe('furniture');
    });
  });

  describe('special characters', () => {
    it('should remove special characters', () => {
      expect(toSlug('Café & Bar!')).toBe('caf-bar');
    });

    it('should remove non-ascii characters', () => {
      expect(toSlug('naïve résumé')).toBe('nave-rsum');
    });

    it('should preserve existing hyphens', () => {
      expect(toSlug('well-known product')).toBe('well-known-product');
    });

    it('should collapse multiple hyphens into one', () => {
      expect(toSlug('hello---world')).toBe('hello-world');
    });

    it('should collapse multiple spaces into single hyphen', () => {
      expect(toSlug('too  many   spaces')).toBe('too-many-spaces');
    });

    it('should remove leading hyphens after trim', () => {
      expect(toSlug('!hello world')).toBe('hello-world');
    });
  });

  describe('numbers', () => {
    it('should preserve numbers', () => {
      expect(toSlug('Product 42')).toBe('product-42');
    });

    it('should handle name starting with number', () => {
      expect(toSlug('3 seater sofa')).toBe('3-seater-sofa');
    });
  });
});
