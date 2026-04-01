import { faker } from '@faker-js/faker';

import { NUMERIC } from '@/common/constants';

import { resolvePagination } from './index';

const { PAGE_MIN, LIMIT_DEFAULT } = NUMERIC;

describe('resolvePagination', () => {
  describe('defaults', () => {
    it('should use PAGE_MIN when page is not provided', () => {
      const result = resolvePagination({ limit: 10 });
      expect(result.page).toBe(PAGE_MIN);
    });

    it('should use LIMIT_DEFAULT when limit is not provided', () => {
      const result = resolvePagination({ page: 1 });
      expect(result.limit).toBe(LIMIT_DEFAULT);
    });

    it('should use both defaults when dto is empty', () => {
      const result = resolvePagination({});
      expect(result.page).toBe(PAGE_MIN);
      expect(result.limit).toBe(LIMIT_DEFAULT);
    });
  });

  describe('with explicit values', () => {
    it('should return provided page and limit', () => {
      const result = resolvePagination({ page: 3, limit: 15 });
      expect(result.page).toBe(3);
      expect(result.limit).toBe(15);
    });

    it('should compute correct offset for page 1', () => {
      const result = resolvePagination({ page: 1, limit: 20 });
      expect(result.offset).toBe(0);
    });

    it('should compute correct offset for page 2', () => {
      const result = resolvePagination({ page: 2, limit: 20 });
      expect(result.offset).toBe(20);
    });

    it('should compute correct offset for page 3', () => {
      const result = resolvePagination({ page: 3, limit: 10 });
      expect(result.offset).toBe(20);
    });

    it('should compute offset correctly for random page and limit', () => {
      const page = faker.number.int({ min: 1, max: 100 });
      const limit = faker.number.int({ min: 1, max: 100 });
      const result = resolvePagination({ page, limit });
      expect(result.offset).toBe((page - 1) * limit);
    });
  });
});
