import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { KycListComponent } from './kyc-list';

describe('KycListComponent', () => {
  let component: KycListComponent;
  let fixture: ComponentFixture<KycListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KycListComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(KycListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
