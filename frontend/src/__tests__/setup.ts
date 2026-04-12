import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock react-to-print
vi.mock('react-to-print', () => ({
  useReactToPrint: () => vi.fn(),
}));

// Mock axios client to avoid real HTTP calls
vi.mock('../api/client', () => ({
  default: {
    get:    vi.fn(),
    post:   vi.fn(),
    put:    vi.fn(),
    patch:  vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request:  { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));
