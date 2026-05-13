import { Injectable, OnDestroy, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth';

/**
 * TokenRefreshService
 *
 * Runs a background timer that silently refreshes the JWT every 15 minutes.
 * This keeps the user's session alive without requiring them to log in again,
 * as long as they remain active within the refresh window.
 *
 * Why use Injector instead of injecting AuthService directly?
 * AuthService depends on TokenRefreshService (to call startAutoRefresh after login),
 * and TokenRefreshService depends on AuthService (to call refreshToken).
 * Angular's DI system cannot resolve circular dependencies at construction time,
 * so we break the cycle by lazily resolving AuthService on first use via Injector.
 */
@Injectable({ providedIn: 'root' })
export class TokenRefreshService implements OnDestroy {

  /** Reference to the setInterval handle so we can cancel it on logout or destroy. */
  private refreshInterval: any;

  /** How often to refresh the token — 15 minutes in milliseconds. */
  private readonly REFRESH_EVERY_MS = 15 * 60 * 1000; // 15 minutes

  /**
   * Lazily resolved AuthService reference.
   * Not injected in the constructor to avoid the circular dependency.
   */
  private auth!: AuthService;

  /**
   * Injector is used to lazily resolve AuthService after construction,
   * breaking the circular dependency between AuthService ↔ TokenRefreshService.
   */
  constructor(private injector: Injector, private router: Router) { }

  /**
   * Lazily resolves and caches the AuthService instance.
   * Called on first use rather than at construction time to avoid the circular DI issue.
   */
  private getAuthService(): AuthService {
    if (!this.auth) {
      // Resolve AuthService from the injector the first time it is needed
      this.auth = this.injector.get(AuthService);
    }
    return this.auth;
  }

  /**
   * Starts the background token-refresh timer.
   * Clears any existing timer first to prevent duplicate intervals if called multiple times
   * (e.g., if the user logs out and back in within the same session).
   * Called by AuthService.saveSession() immediately after a successful login.
   */
  startAutoRefresh(): void {
    // Cancel any previously running interval before starting a new one
    this.stopAutoRefresh();

    this.refreshInterval = setInterval(() => {
      // Only attempt a refresh if a token actually exists — avoids unnecessary API calls
      const token = localStorage.getItem('token');
      if (!token) return;

      // Calls POST /api/auth/refresh and updates the stored token on success
      this.getAuthService().refreshToken().subscribe({
        next: (res: any) => {
          if (res.success && res.data?.token) {
            // Overwrite the old token with the fresh one
            localStorage.setItem('token', res.data.token);
            // Keep the userStatus field current so KYC state is always fresh
            if (res.data.status) localStorage.setItem('userStatus', res.data.status);
          }
        },
        error: () => {
          // Silently ignore refresh failures — the auth interceptor handles 401s globally
          // by clearing the session and redirecting to login
        }
      });
    }, this.REFRESH_EVERY_MS);
  }

  /**
   * Cancels the background refresh timer.
   * Called on logout to prevent the timer from firing after the session is cleared,
   * and in ngOnDestroy to clean up if the service is ever destroyed.
   */
  stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Triggers an immediate token refresh outside the normal 15-minute cycle.
   * Useful after a KYC status change so the new status is reflected in the token
   * without waiting for the next scheduled refresh.
   */
  refreshNow(): void {
    // Guard: do nothing if there is no active session
    const token = localStorage.getItem('token');
    if (!token) return;

    // Calls POST /api/auth/refresh and updates the stored token on success
    this.getAuthService().refreshToken().subscribe({
      next: (res: any) => {
        if (res.success && res.data?.token) {
          localStorage.setItem('token', res.data.token);
          if (res.data.status) localStorage.setItem('userStatus', res.data.status);
        }
      },
      error: () => {
        // Silently ignore — the interceptor handles 401s globally
      }
    });
  }

  /**
   * Angular lifecycle hook — cleans up the interval when the service is destroyed.
   * Prevents memory leaks and ghost timers in test environments.
   */
  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }
}
