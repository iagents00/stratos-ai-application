import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterPlatformUsers, isMarketingUser, isProtectedPlatformUser, platformUserChanged,
  platformUserDraft, validatePlatformUserDraft,
} from '../src/app/features/Admin/platform-users.mjs';

const organizations = [{ id: 'duke', name: 'Duque', active: true }, { id: 'new', name: 'Nueva', active: true }, { id: 'off', name: 'Inactiva', active: false }];
const user = { id: 'u1', name: 'Álex Velázquez', email: 'alex@example.com', organization_id: 'duke', role: 'super_admin', active: true, is_marketing_admin: true };

test('global list includes inactive users and Marketing includes a flagged superadministrator', () => {
  const users = [user, { ...user, id: 'u2', active: false, role: 'marketing', is_marketing_admin: false }, { ...user, id: 'u3', role: 'asesor', is_marketing_admin: false }];
  assert.equal(filterPlatformUsers(users, organizations).length, 3);
  assert.equal(filterPlatformUsers(users, organizations, { marketing: true }).length, 2);
  assert.equal(isMarketingUser(user), true);
  assert.equal(filterPlatformUsers(users, organizations, { status: 'inactive' })[0].id, 'u2');
});

test('search combines name, email and company without accents and filters organization and role', () => {
  const users = [user, { ...user, id: 'other', organization_id: 'new' }];
  assert.deepEqual(filterPlatformUsers(users, organizations, { query: 'alex duque' }).map(item => item.id), ['u1']);
  assert.equal(filterPlatformUsers(users, organizations, { query: 'example.com', organizationId: 'new', role: 'super_admin' })[0].id, 'other');
  assert.equal(filterPlatformUsers(users, organizations, { role: 'asesor' }).length, 0);
  assert.equal(filterPlatformUsers([{ ...user, organization_id: null }], organizations, { organizationId: 'unassigned' }).length, 1);
});

test('moving a user requires an explicit destination and separate confirmation', () => {
  const draft = { ...platformUserDraft(user), organization_id: 'new' };
  assert.match(validatePlatformUserDraft(draft, user, organizations, 'root'), /Confirma/);
  assert.equal(validatePlatformUserDraft({ ...draft, confirm_move: true }, user, organizations, 'root'), '');
  assert.match(validatePlatformUserDraft({ ...draft, organization_id: '', confirm_move: true }, user, organizations, 'root'), /destino/);
  assert.match(validatePlatformUserDraft({ ...draft, organization_id: 'off', confirm_move: true }, user, organizations, 'root'), /Activa/);
  assert.equal(platformUserChanged(draft, user), true);
  assert.equal(platformUserChanged({ ...platformUserDraft(user), confirm_move: true }, user), false);
});

test('platform operators and own account cannot be moved, downgraded or disabled through the editor', () => {
  for (const protectedUser of [user, { ...user, id: 'operator', platform_admin: { active: true } }, { ...user, id: 'protected', protected_from_access_changes: true }]) {
    assert.equal(isProtectedPlatformUser(protectedUser, user.id), true);
    assert.equal(validatePlatformUserDraft({ ...platformUserDraft(protectedUser), name: 'Nuevo nombre', area: 'Dirección' }, protectedUser, organizations, user.id), '');
    for (const patch of [{ organization_id: 'new', confirm_move: true }, { active: false }, { role: 'marketing' }, { is_marketing_admin: false }, { crm_only: true, is_marketing_admin: false }]) {
      assert.match(validatePlatformUserDraft({ ...platformUserDraft(protectedUser), ...patch }, protectedUser, organizations, user.id), /protegida/);
    }
  }
});

test('draft validation follows supported roles and Marketing access combinations', () => {
  assert.match(validatePlatformUserDraft({ ...platformUserDraft(user), name: ' ' }, user, organizations, 'root'), /nombre/);
  assert.match(validatePlatformUserDraft({ ...platformUserDraft(user), role: 'contabilidad' }, user, organizations, 'root'), /rol válido/);
  assert.match(validatePlatformUserDraft({ ...platformUserDraft(user), role: 'asesor' }, user, organizations, 'root'), /Marketing/);
  assert.match(validatePlatformUserDraft({ ...platformUserDraft(user), crm_only: true }, user, organizations, 'root'), /Marketing/);
  assert.equal(validatePlatformUserDraft({ ...platformUserDraft(user), role: 'colaborador', is_marketing_admin: false }, user, organizations, 'root'), '');
});

test('orphaned identity or profile remains visible without silently granting a new role', () => {
  const orphan = { id: 'orphan', name: 'Cuenta incompleta', email: 'orphan@example.com', role: null, active: false, organization_id: null, profile_missing: true };
  assert.equal(filterPlatformUsers([orphan], organizations).length, 1);
  assert.equal(platformUserDraft(orphan).role, '');
  assert.match(validatePlatformUserDraft(platformUserDraft(orphan), orphan, organizations, 'root'), /recuperar/);
  assert.match(validatePlatformUserDraft(platformUserDraft(user), { ...user, identity_missing: true }, organizations, 'root'), /recuperar/);
});
