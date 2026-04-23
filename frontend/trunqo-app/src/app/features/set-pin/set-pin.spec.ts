import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SetPin } from './set-pin';

describe('SetPin', () => {
  let component: SetPin;
  let fixture: ComponentFixture<SetPin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetPin],
    }).compileComponents();

    fixture = TestBed.createComponent(SetPin);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
