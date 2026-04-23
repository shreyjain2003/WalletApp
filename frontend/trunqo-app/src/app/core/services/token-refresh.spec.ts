import { TestBed } from '@angular/core/testing';
import { TokenRefreshService } from './token-refresh';
import { Router } from '@angular/router';
import { Injector } from '@angular/core';

describe('TokenRefreshService', () => {
  let service: TokenRefreshService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TokenRefreshService,
        { provide: Router, useValue: {} },
        { provide: Injector, useValue: { get: () => ({}) } }
      ]
    });

    service = TestBed.inject(TokenRefreshService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
