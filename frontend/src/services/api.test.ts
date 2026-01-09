import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isApiError,
  setAuthToken,
  getAuthToken,
  clearAuthToken,
  isAuthenticated,
  type ApiError,
} from "./api";

describe("API utilities", () => {
  describe("isApiError", () => {
    it("should return true for valid ApiError objects", () => {
      const error: ApiError = {
        message: "Not found",
        statusCode: 404,
      };
      expect(isApiError(error)).toBe(true);
    });

    it("should return true for ApiError with code", () => {
      const error: ApiError = {
        message: "Not found",
        code: "EVENT_NOT_FOUND",
        statusCode: 404,
      };
      expect(isApiError(error)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isApiError(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isApiError(undefined)).toBe(false);
    });

    it("should return false for regular Error", () => {
      expect(isApiError(new Error("test"))).toBe(false);
    });

    it("should return false for objects missing required properties", () => {
      expect(isApiError({ message: "test" })).toBe(false);
      expect(isApiError({ statusCode: 404 })).toBe(false);
    });

    it("should return false for strings", () => {
      expect(isApiError("error")).toBe(false);
    });

    it("should return false for numbers", () => {
      expect(isApiError(404)).toBe(false);
    });
  });

  describe("auth token management", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    afterEach(() => {
      localStorage.clear();
    });

    it("should set and get auth token", () => {
      setAuthToken("test-token-123");
      expect(getAuthToken()).toBe("test-token-123");
    });

    it("should return null when no token is set", () => {
      expect(getAuthToken()).toBeNull();
    });

    it("should clear auth token", () => {
      setAuthToken("test-token-123");
      clearAuthToken();
      expect(getAuthToken()).toBeNull();
    });

    it("should correctly report authentication status", () => {
      expect(isAuthenticated()).toBe(false);
      setAuthToken("test-token-123");
      expect(isAuthenticated()).toBe(true);
      clearAuthToken();
      expect(isAuthenticated()).toBe(false);
    });
  });
});
