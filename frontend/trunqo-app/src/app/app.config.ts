import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';

/**
 * appConfig
 *
 * The root application configuration object for Angular's standalone bootstrap API.
 * This replaces the traditional NgModule-based AppModule and defines all
 * application-wide providers in one place.
 *
 * Each provider here is available to every component and service in the app.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    /**
     * Enables Zone.js-based change detection with event coalescing.
     * Event coalescing batches multiple DOM events that fire in the same microtask
     * into a single change-detection cycle, reducing unnecessary re-renders and
     * improving performance in event-heavy UIs.
     */
    provideZoneChangeDetection({ eventCoalescing: true }),

    /**
     * Registers the application router with the route definitions from app.routes.ts.
     * This enables <router-outlet>, routerLink, and programmatic navigation throughout the app.
     */
    provideRouter(routes),

    /**
     * Registers Angular's HttpClient and attaches the authInterceptor to every outgoing request.
     * withInterceptors() is the functional interceptor API (Angular 15+) — it replaces the
     * class-based HTTP_INTERCEPTORS token.  The authInterceptor automatically adds the JWT
     * Bearer token and handles 401 responses globally.
     */
    provideHttpClient(withInterceptors([authInterceptor])),

    /**
     * Enables Angular Material animations using the async provider.
     * The async variant lazy-loads the animations module only when needed,
     * reducing the initial bundle size compared to provideAnimations().
     */
    provideAnimationsAsync()
  ]
};
