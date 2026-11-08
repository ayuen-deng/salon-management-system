import { describe, it, expect } from 'vitest';
import { getRoleHome, usernameToSyntheticEmail } from './roles';
import { ROLE_NAVIGATION } from './navigation';

describe('Roles and Routing Model', () => {
  it('maps each role to its dedicated role home', () => {
    expect(getRoleHome('owner')).toBe('/owner');
    expect(getRoleHome('manager')).toBe('/manager');
    expect(getRoleHome('hr')).toBe('/hr');
    expect(getRoleHome('receptionist')).toBe('/reception');
    expect(getRoleHome('staff')).toBe('/staff');
  });

  it('converts usernames and aliases to correct synthetic emails', () => {
    expect(usernameToSyntheticEmail('owner')).toBe('owner@mzuri.salon');
    expect(usernameToSyntheticEmail('manager')).toBe('manager@mzuri.salon');
    expect(usernameToSyntheticEmail('hr')).toBe('hr@mzuri.salon');
    expect(usernameToSyntheticEmail('reception')).toBe('mary@staff.mzuri.salon');
    expect(usernameToSyntheticEmail('mary')).toBe('mary@staff.mzuri.salon');
    expect(usernameToSyntheticEmail('staff')).toBe('grace@staff.mzuri.salon');
    expect(usernameToSyntheticEmail('grace')).toBe('grace@staff.mzuri.salon');
    expect(usernameToSyntheticEmail('sarah')).toBe('sarah@staff.mzuri.salon');
    expect(usernameToSyntheticEmail('peter')).toBe('peter@staff.mzuri.salon');
    expect(usernameToSyntheticEmail('rose')).toBe('rose@staff.mzuri.salon');
  });

  it('provides dedicated navigation items for each role without empty links or hash anchors', () => {
    for (const [role, items] of Object.entries(ROLE_NAVIGATION)) {
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.href).toMatch(/^\/[a-z0-9\/-]+$/);
        expect(item.href).not.toContain('#');
      }
    }
  });
});
