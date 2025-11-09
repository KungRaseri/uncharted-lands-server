import { Router } from 'express';
import { db } from '../../db/index.js';
import { accounts, profiles } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user account
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({
        error: 'Email, password, and username are required',
      });
    }

    // Check if account already exists
    const existingAccount = await db.query.accounts.findFirst({
      where: eq(accounts.email, email),
    });

    if (existingAccount) {
      return res.status(400).json({
        error: 'Account with this email already exists',
      });
    }

    // Note: Password hashing should be done by the client before this point
    // or we need to add bcrypt to the server
    const accountId = createId();
    const userAuthToken = createId();

    // Create account
    await db.insert(accounts).values({
      id: accountId,
      email,
      passwordHash: password, // In production, this should already be hashed
      userAuthToken,
      role: 'MEMBER',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create profile
    await db.insert(profiles).values({
      id: createId(),
      accountId,
      username,
      picture: '', // Default empty picture
    });

    // Fetch the created account with profile
    const newAccount = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
      with: {
        profile: true,
      },
    });

    res.status(201).json({
      success: true,
      account: newAccount,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register account' });
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
      });
    }

    // Find account
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.email, email),
      with: {
        profile: true,
      },
    });

    if (!account) {
      return res.status(401).json({
        error: 'Invalid email or password',
      });
    }

    // Note: Password comparison should be done with bcrypt
    // For now, direct comparison (assuming pre-hashed)
    if (account.passwordHash !== password) {
      return res.status(401).json({
        error: 'Invalid email or password',
      });
    }

    // Generate new auth token
    const newAuthToken = createId();

    await db
      .update(accounts)
      .set({
        userAuthToken: newAuthToken,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, account.id));

    res.json({
      success: true,
      account: {
        ...account,
        userAuthToken: newAuthToken,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

/**
 * POST /api/auth/validate
 * Validate a session token
 */
router.post('/validate', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Token is required',
      });
    }

    const account = await db.query.accounts.findFirst({
      where: eq(accounts.userAuthToken, token),
      with: {
        profile: true,
      },
    });

    if (!account) {
      return res.status(401).json({
        error: 'Invalid token',
      });
    }

    res.json({
      success: true,
      account,
    });
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ error: 'Failed to validate token' });
  }
});

export default router;
