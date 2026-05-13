import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * authGuard
 *
 * Protects all routes inside the authenticated dashboard layout.
 * A user may only access these routes if they have a valid JWT token AND
 * their role is 'User'.  This prevents admin tokens from accidentally
 * accessing user-facing pages and vice versa.
 *
 * If the check fails, the guard redirects to /login.
 * If an admin token is found (stale from a previous admin session), it is
 * cleared before redirecting so the login page starts with a clean state.
 */
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);

  // Read the stored token and role to determine access
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  // Allow access only when a token exists AND the role is exactly 'User'
  if (token && role === 'User') return true;

  // If an admin token is lingering (e.g., user navigated directly to a user route
  // while logged in as admin), clear it to avoid a confusing mixed state
  if (role === 'Admin') {
    localStorage.clear();
  }

  // Redirect unauthenticated or wrong-role visitors to the user login page
  router.navigate(['/login']);
  return false;
};

/**
 * adminGuard
 *
 * Protects all admin-only routes (/admin/kyc, /admin/tickets, etc.).
 * A visitor may only access these routes if they have a valid JWT token AND
 * their role is 'Admin'.  Regular user tokens are rejected.
 *
 * If the check fails, the guard redirects to /admin/login rather than /login
 * so the admin is taken to the correct login form.
 */
export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);

  // Read the stored token and role to determine access
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  // Allow access only when a token exists AND the role is exactly 'Admin'
  if (token && role === 'Admin') return true;

  // Redirect non-admin visitors to the admin login page
  router.navigate(['/admin/login']);
  return false;
};
