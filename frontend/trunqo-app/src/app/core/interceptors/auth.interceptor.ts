import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

/**
 * authInterceptor
 *
 * A functional HTTP interceptor that runs on every outgoing HTTP request.
 * It serves two purposes:
 *
 * 1. **Token injection** — Reads the JWT from localStorage and attaches it as
 *    an `Authorization: Bearer <token>` header so the backend can authenticate
 *    the caller without each service needing to manage headers manually.
 *
 * 2. **Global 401 handling** — If the backend returns a 401 Unauthorized response
 *    (e.g., the token has expired and the refresh cycle missed it), the interceptor
 *    clears the session and redirects to the appropriate login page.  This means
 *    individual components never need to handle auth expiry themselves.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Inject Router lazily — functional interceptors use inject() instead of constructor DI
  const router = inject(Router);

  // Read the current JWT from localStorage on every request so we always use the latest token
  const token = localStorage.getItem('token');

  // Clone the request and attach the Authorization header only if a token exists.
  // We clone because HttpRequest objects are immutable — we cannot modify them in place.
  const authReq = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      })
    : req; // If no token exists (unauthenticated routes), pass the request through unchanged

  // Forward the (possibly modified) request and intercept any errors in the response stream
  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // 401 means the token is missing, expired, or invalid on the backend
      if (error.status === 401) {
        // Read the role before clearing storage so we know where to redirect
        const role = localStorage.getItem('role');

        // Wipe all session data — token, userId, role, name, userStatus
        localStorage.clear();

        // Redirect to the correct login page based on the user's role
        if (role === 'Admin') {
          // Admin sessions go to the admin login page, not the user login page
          router.navigate(['/admin/login']);
        } else {
          // Regular users are sent to the standard login page
          router.navigate(['/login']);
        }
      }

      // Re-throw the error so individual components can still handle it if needed
      return throwError(() => error);
    })
  );
};
