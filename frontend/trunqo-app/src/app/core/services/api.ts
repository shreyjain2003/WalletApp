import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * ApiService
 *
 * Central HTTP client wrapper for the entire application.
 * Every feature service calls this instead of HttpClient directly so that
 * the base URL is defined in one place and can be changed without touching
 * individual features.  JWT auth is injected automatically by authInterceptor —
 * no manual header management is needed here.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {

  /** Base URL of the backend gateway — all endpoints are relative to this. */
  private baseUrl = 'http://localhost:5000';

  /** HttpClient is Angular's built-in HTTP service; injected by DI. */
  constructor(private http: HttpClient) { }

  /**
   * Performs a GET request to the given endpoint.
   * Used for fetching resources (wallet balance, profile, history, etc.).
   * @param endpoint  Path relative to baseUrl, e.g. '/api/wallet'
   */
  get<T>(endpoint: string): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${endpoint}`);
  }

  /**
   * Performs a POST request with a JSON body.
   * Used for creating resources and triggering actions (login, topup, transfer).
   * @param endpoint  Path relative to baseUrl
   * @param body      Request payload — serialised to JSON automatically
   */
  post<T>(endpoint: string, body: any): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${endpoint}`, body);
  }

  /**
   * Performs a PUT request with a JSON body.
   * Used for updating existing resources (wallet balance, user details, lock status).
   * @param endpoint  Path relative to baseUrl
   * @param body      Fields to update
   */
  put<T>(endpoint: string, body: any): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${endpoint}`, body);
  }

  /**
   * Performs a DELETE request.
   * Used for removing resources (deleting a user account from the admin panel).
   * @param endpoint  Path relative to baseUrl
   */
  delete<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${endpoint}`);
  }

  /**
   * Downloads a binary file from the given endpoint and triggers a browser save-as dialog.
   * Used for exporting transaction history as CSV or PDF.
   * @param endpoint   Path relative to baseUrl that returns a binary blob
   * @param fileName   The filename the browser will suggest when saving
   */
  download(endpoint: string, fileName: string): void {
    // Request the file as a Blob so the browser can save it directly
    this.http.get(`${this.baseUrl}${endpoint}`, {
      responseType: 'blob'
    }).subscribe(blob => {
      // Create a temporary object URL so we can trigger a programmatic click
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName; // Tells the browser what to name the saved file
      link.click();
      // Revoke the object URL immediately after the click to free memory
      window.URL.revokeObjectURL(url);
    });
  }
}
