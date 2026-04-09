import { TestBed } from '@angular/core/testing';

import { Contacts } from './contacts';

describe('Contacts', () => {
  let service: Contacts;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Contacts);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
