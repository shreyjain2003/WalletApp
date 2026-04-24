import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { SetPinComponent } from './set-pin';

describe('SetPinComponent', () => {
  let component: SetPinComponent;
  let fixture: ComponentFixture<SetPinComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetPinComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(SetPinComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
