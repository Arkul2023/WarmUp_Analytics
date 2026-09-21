import dotenv from 'dotenv';

import { connectDatabase } from '../config/database';
import User from '../models/User';
import { hashPassword } from '../services/auth/password.service';

dotenv.config();

async function createTestUser() {
  try {
    await connectDatabase();

    const email = 'devtest@example.com';
    const password = 'DevTest@12345';

    const existingUser = await User.findOne({
      email,
    });

    if (existingUser) {
      console.log('Test user already exists.');
      console.log(`Email: ${email}`);
      console.log(`Password: ${password}`);

      process.exit(0);
    }

    const passwordHash = await hashPassword(password);

    const user = await User.create({
      firstName: 'Dev',
      lastName: 'Test',
      email,
      password_hash: passwordHash,

      /**
       * Mark the development account as already verified
       * so we don't need the email-verification flow.
       */
      emailVerified: true,
      emailVerifiedAt: new Date(),

      /**
       * Login requires an active account.
       */
      status: 'active',
    });

    console.log('Development test user created successfully.');
    console.log('');
    console.log(`Email: ${user.email}`);
    console.log(`Password: ${password}`);
    console.log(`User ID: ${user._id}`);

    process.exit(0);
  } catch (error) {
    console.error('Failed to create test user:', error);
    process.exit(1);
  }
}

createTestUser();