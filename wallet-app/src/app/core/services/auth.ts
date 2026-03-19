import { Injectable } from '@angular/core';
import { ApiService } from './api';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private isLoggedInSubject = new BehaviorSubject<boolean>(this.hasToken());
  isLoggedIn$ = this.isLoggedInSubject.asObservable();

  constructor(private api: ApiService, private router: Router) { }

  private hasToken(): boolean {
    return !!localStorage.getItem('token');
  }

  register(data: any): Observable<any> {
    return this.api.post('/api/auth/register', data).pipe(
      tap((res: any) => {
        if (res.success) this.saveSession(res.data);
      })
    );
  }

  login(data: any): Observable<any> {
    return this.api.post('/api/auth/login', data).pipe(
      tap((res: any) => {
        if (res.success) this.saveSession(res.data);
      })
    );
  }

  adminLogin(data: any): Observable<any> {
    return this.api.post('/api/admin/login', data).pipe(
      tap((res: any) => {
        if (res.success) {
          // Admin response has adminId instead of userId
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

  private saveSession(data: any): void {
    localStorage.setItem('token', data.token);
    localStorage.setItem('userId', data.userId ?? data.adminId);
    localStorage.setItem('role', data.role ?? 'Admin');
    localStorage.setItem('name', data.fullName);
    this.isLoggedInSubject.next(true);
  }

  logout(): void {
    localStorage.clear();
    this.isLoggedInSubject.next(false);
    this.router.navigate(['/login']);
  }

  getRole(): string {
    return localStorage.getItem('role') ?? 'User';
  }

  getName(): string {
    return localStorage.getItem('name') ?? '';
  }

  getUserId(): string {
    return localStorage.getItem('userId') ?? '';
  }
}
