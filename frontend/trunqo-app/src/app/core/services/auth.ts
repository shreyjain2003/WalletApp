import { Injectable } from '@angular/core';
import { ApiService } from './api';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { TokenRefreshService } from './token-refresh';

/**
 * AuthService
 *
 * Single source of truth for authentication state across the app.
 * Handles login, registration, admin login, logout, token persistence,
 * PIN management, and the forgot-password / OTP / reset flow.
 *
 * Session data (JWT token, userId, role, name) is stored in localStorage so
 * it survives page refreshes.  The BehaviorSubject exposes a reactive stream
 * that components can subscribe to for real-time auth state changes.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {

  /**
   * Reactive stream of the current login state.
   * Emits `true` when a valid token exists, `false` after logout.
   * Initialised from localStorage so the state is correct on page load.
   */
  private isLoggedInSubject = new BehaviorSubject<boolean>(this.hasToken());

  /** Public observable — components subscribe to this, not the subject directly. */
  isLoggedIn$ = this.isLoggedInSubject.asObservable();

  constructor(
    private api: ApiService,
    private router: Router,
    private tokenRefresh: TokenRefreshService
  ) { }

  // =========================
  // SESSION HELPERS
  // =========================

  /**
   * Checks whether a JWT token is currently stored in localStorage.
   * Used to initialise the BehaviorSubject on service creation.
   */
  private hasToken(): boolean {
    return !!localStorage.getItem('token');
  }

  /**
   * Persists the session data returned by the backend after a successful login
   * or registration.  Also kicks off the background token-refresh timer so the
   * JWT stays valid without requiring the user to log in again.
   * @param data  The `data` object from the API response (contains token, userId, role, fullName)
   */
  private saveSession(data: any): void {
    // Store the JWT so authInterceptor can attach it to every subsequent request
    localStorage.setItem('token', data.token);
    // userId may come as 'userId' for regular users or 'adminId' for admins
    localStorage.setItem('userId', data.userId ?? data.adminId);
    // Role is used by guards to differentiate user vs admin routes
    localStorage.setItem('role', data.role ?? 'User');
    // Display name shown in the dashboard header
    localStorage.setItem('name', data.fullName);

    // Notify all subscribers that the user is now logged in
    this.isLoggedInSubject.next(true);

    // Start the 15-minute auto-refresh cycle so the token never expires mid-session
    this.tokenRefresh.startAutoRefresh();
  }

  /**
   * Clears all session data and redirects to the login page.
   * Called on explicit logout or when the interceptor receives a 401.
   */
  logout(): void {
    // Stop the background refresh timer to avoid orphaned intervals
    this.tokenRefresh.stopAutoRefresh();
    // Wipe all stored session keys (token, userId, role, name, userStatus)
    localStorage.clear();
    // Notify subscribers that the user is now logged out
    this.isLoggedInSubject.next(false);
    // Redirect to the user login page
    this.router.navigate(['/login']);
  }

  /** Returns the stored role ('User' or 'Admin') — used by route guards. */
  getRole(): string {
    return localStorage.getItem('role') ?? 'User';
  }

  /** Returns the stored display name — shown in the dashboard layout header. */
  getName(): string {
    return localStorage.getItem('name') ?? '';
  }

  /** Returns the stored userId — used when constructing API requests that need the caller's ID. */
  getUserId(): string {
    return localStorage.getItem('userId') ?? '';
  }

  // =========================
  // AUTH APIs
  // =========================

  /**
   * Registers a new user account.
   * On success, automatically saves the session so the user is immediately logged in
   * without a separate login step.
   * Calls POST /api/auth/register
   */
  register(data: any): Observable<any> {
    return this.api.post('/api/auth/register', data).pipe(
      // tap runs a side-effect without altering the stream value
      tap((res: any) => {
        // Only save the session if the backend confirms success
        if (res.success) this.saveSession(res.data);
      })
    );
  }

  /**
   * Authenticates an existing user with email + password.
   * On success, saves the session (token, role, name) and starts the refresh timer.
   * Calls POST /api/auth/login
   */
  login(data: any): Observable<any> {
    return this.api.post('/api/auth/login', data).pipe(
      tap((res: any) => {
        if (res.success) this.saveSession(res.data);
      })
    );
  }

  /**
   * Authenticates an admin user via the separate admin login endpoint.
   * Normalises the response shape so saveSession works the same way as for regular users
   * (adminId → userId, role forced to 'Admin').
   * Calls POST /api/admin/login
   */
  adminLogin(data: any): Observable<any> {
    return this.api.post('/api/admin/login', data).pipe(
      tap((res: any) => {
        if (res.success) {
          // Remap adminId to userId so saveSession can use a single field name
          const sessionData = {
            ...res.data,
            userId: res.data.adminId,
            role: 'Admin'
          };
          this.saveSession(sessionData);
        }
      })
    );
  }

  /**
   * Exchanges the current JWT for a fresh one before it expires.
   * Called automatically by TokenRefreshService every 15 minutes.
   * Also updates the userStatus field so KYC state stays current.
   * Calls POST /api/auth/refresh
   */
  refreshToken(): Observable<any> {
    return this.api.post('/api/auth/refresh', {}).pipe(
      tap((res: any) => {
        if (res.success && res.data?.token) {
          // Replace the old token with the new one so future requests use it
          localStorage.setItem('token', res.data.token);
          // Persist the latest KYC/account status so the UI reflects it without a full reload
          if (res.data.status) localStorage.setItem('userStatus', res.data.status);
          // Re-confirm logged-in state in case something cleared it
          this.isLoggedInSubject.next(true);
        }
      })
    );
  }

  // =========================
  // PIN APIs
  // =========================

  /**
   * Checks whether the current user has a transaction PIN set.
   * Used by the Transfer and Set-PIN pages to decide which UI to show.
   * Calls GET /api/auth/pin/status
   */
  getPinStatus(): Observable<any> {
    return this.api.get('/api/auth/pin/status');
  }

  /**
   * Creates or changes the transaction PIN.
   * If the user already has a PIN, `currentPin` must be provided for verification.
   * Calls POST /api/auth/pin/set
   */
  setPin(data: { currentPin?: string | null; newPin: string; confirmPin: string }): Observable<any> {
    return this.api.post('/api/auth/pin/set', data);
  }

  /**
   * Removes the transaction PIN entirely, disabling PIN protection on transfers.
   * Requires the current PIN to prevent unauthorised removal.
   * Calls POST /api/auth/pin/remove
   */
  removePin(currentPin: string): Observable<any> {
    return this.api.post('/api/auth/pin/remove', { currentPin });
  }

  // =========================
  // FORGOT PASSWORD APIs
  // =========================

  /**
   * Initiates the password-reset flow by sending a 6-digit OTP to the user's email.
   * Calls POST /api/auth/forgot-password
   */
  forgotPassword(email: string): Observable<any> {
    return this.api.post('/api/auth/forgot-password', { email });
  }

  /**
   * Verifies the OTP entered by the user.
   * On success the backend returns a short-lived `resetToken` that must be passed
   * to resetPassword — this prevents anyone from resetting a password without
   * first proving they received the OTP.
   * Calls POST /api/auth/verify-reset-otp
   */
  verifyOtp(email: string, otp: string): Observable<any> {
    return this.api.post('/api/auth/verify-reset-otp', { email, otp });
  }

  /**
   * Completes the password-reset flow by setting a new password.
   * Requires the `resetToken` from verifyOtp to prove OTP was already validated.
   * Calls POST /api/auth/reset-password
   */
  resetPassword(data: {
    email: string;
    resetToken: string;
    newPassword: string;
    confirmPassword: string;
  }): Observable<any> {
    return this.api.post('/api/auth/reset-password', data);
  }
}
