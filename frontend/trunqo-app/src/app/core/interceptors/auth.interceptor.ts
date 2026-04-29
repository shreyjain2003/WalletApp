import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

/**
 * Auth Interceptor
 *
 * Automatically attaches the JWT Bearer token to every outgoing HTTP request.
 * Also handles 401 Unauthorized responses globally by clearing the session
 * and redirecting to the appropriate login page.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = localStorage.getItem('token');

  // Clone the request and attach the Authorization header if a token exists
  const authReq = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Token expired or invalid — clear session and redirect
        const role = localStorage.getItem('role');
        localStorage.clear();

        if (role === 'Admin') {
          router.navigate(['/admin/login']);
        } else {
          router.navigate(['/login']);
        }
      }
      return throwError(() => error);
    })
  );
};
