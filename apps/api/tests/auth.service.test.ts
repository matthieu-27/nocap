import { beforeEach, describe, expect, it } from 'bun:test';
import { resetDb } from '../src/db/testSetup';
import { authenticate, createUser } from '../src/services/auth.service';
import {
  createSession,
  deleteSession,
  getUserBySessionToken,
} from '../src/services/session.service';

const userInput = () => ({
  username: 'tracker',
  email: 'tracker@example.com',
  password: 'correct-horse-battery',
});

describe('auth service', () => {
  beforeEach(resetDb);

  it('signup creates user and login accepts valid password', async () => {
    const created = await createUser(userInput());
    expect(created.username).toBe('tracker');
    expect(created.role).toBe('user');

    const loggedIn = await authenticate(
      'tracker@example.com',
      'correct-horse-battery',
    );
    expect(loggedIn.id).toBe(created.id);
  });

  it('login rejects wrong password with 401 error', async () => {
    await createUser(userInput());
    try {
      await authenticate('tracker@example.com', 'wrong-password');
      throw new Error('expected authenticate to throw');
    } catch (error) {
      expect((error as { status: number }).status).toBe(401);
    }
  });

  it('signup rejects duplicate username with 409 error', async () => {
    await createUser(userInput());
    try {
      await createUser({ ...userInput(), email: 'other@example.com' });
      throw new Error('expected createUser to throw');
    } catch (error) {
      expect((error as { status: number }).status).toBe(409);
    }
  });

  it('signup rejects short password with 400 error', async () => {
    try {
      await createUser({ ...userInput(), password: 'short' });
      throw new Error('expected createUser to throw');
    } catch (error) {
      expect((error as { status: number }).status).toBe(400);
    }
  });

  it('session token resolves to user and disappears after logout', async () => {
    const user = await createUser(userInput());
    const { token } = await createSession(user.id);
    const byToken = await getUserBySessionToken(token);
    expect(byToken?.username).toBe('tracker');

    await deleteSession(token);
    const afterLogout = await getUserBySessionToken(token);
    expect(afterLogout).toBeNull();
  });
});
