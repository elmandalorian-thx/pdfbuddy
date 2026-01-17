import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from './useTheme';

describe('useTheme', () => {
  let localStorageMock: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });

    // Reset document class list
    document.documentElement.classList.remove('dark', 'light');
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.documentElement.classList.remove('dark', 'light');
  });

  it('should default to light mode when no preference is stored', () => {
    localStorageMock.getItem.mockReturnValue(null);
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
      writable: true,
    });

    const { result } = renderHook(() => useTheme());

    expect(result.current.isDark).toBe(false);
    expect(result.current.theme).toBe('light');
  });

  it('should use stored theme from localStorage', () => {
    localStorageMock.getItem.mockReturnValue('dark');
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
      writable: true,
    });

    const { result } = renderHook(() => useTheme());

    expect(result.current.isDark).toBe(true);
    expect(result.current.theme).toBe('dark');
  });

  it('should use system preference when no stored theme', () => {
    localStorageMock.getItem.mockReturnValue(null);
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockImplementation((query) => ({
        matches: query === '(prefers-color-scheme: dark)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
      writable: true,
    });

    const { result } = renderHook(() => useTheme());

    expect(result.current.isDark).toBe(true);
    expect(result.current.theme).toBe('dark');
  });

  it('should toggle theme from light to dark', () => {
    localStorageMock.getItem.mockReturnValue('light');
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
      writable: true,
    });

    const { result } = renderHook(() => useTheme());

    expect(result.current.isDark).toBe(false);

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.isDark).toBe(true);
    expect(result.current.theme).toBe('dark');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'dark');
  });

  it('should toggle theme from dark to light', () => {
    localStorageMock.getItem.mockReturnValue('dark');
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
      writable: true,
    });

    const { result } = renderHook(() => useTheme());

    expect(result.current.isDark).toBe(true);

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.isDark).toBe(false);
    expect(result.current.theme).toBe('light');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'light');
  });

  it('should set theme explicitly', () => {
    localStorageMock.getItem.mockReturnValue('light');
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
      writable: true,
    });

    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.isDark).toBe(true);
    expect(result.current.theme).toBe('dark');
  });

  it('should update document class list', () => {
    localStorageMock.getItem.mockReturnValue('light');
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
      writable: true,
    });

    renderHook(() => useTheme());

    // After toggle to dark
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('dark');
    });

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
