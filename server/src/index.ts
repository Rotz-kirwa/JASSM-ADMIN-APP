import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import authRoutes from './routes/auth.routes';
import paymentRoutes from './routes/payment.routes';
import smsRoutes from './routes/sms.routes';
import customerRoutes from './routes/customer.routes';
import settingRoutes from './routes/setting.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const prisma = new PrismaClient();

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'secret')) {
  throw new Error('JWT_SECRET must be set to a strong value in production');
}

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/settings', settingRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'UP', timestamp: new Date() });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Auto-seed: create roles and admin user if they don't exist
async function seedIfEmpty() {
  try {
    const roleCount = await prisma.role.count();
    if (roleCount === 0) {
      console.log('==> No roles found. Running initial seed...');
      const roles = [
        { name: 'SUPER_ADMIN', permissions: ['*'] },
        { name: 'ADMIN', permissions: ['read', 'write'] },
        { name: 'FINANCE', permissions: ['read:payments'] },
        { name: 'SUPPORT', permissions: ['read:customers', 'read:sms'] },
      ];
      for (const role of roles) {
        await prisma.role.upsert({ where: { name: role.name }, update: {}, create: role });
      }

      const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL;
      const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD;
      const allowDevAdmin = process.env.NODE_ENV !== 'production';
      const adminEmail = initialAdminEmail || (allowDevAdmin ? 'eliudkirwa451@gmail.com' : undefined);
      const adminPassword = initialAdminPassword || (allowDevAdmin ? 'admin123' : undefined);

      const superAdminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
      if (superAdminRole && adminEmail && adminPassword) {
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        await prisma.user.upsert({
          where: { email: adminEmail },
          update: {},
          create: {
            email: adminEmail,
            name: 'Super Admin',
            password: hashedPassword,
            roleId: superAdminRole.id,
          },
        });
      }

      await prisma.sMSTemplate.upsert({
        where: { name: 'Payment Received' },
        update: {},
        create: {
          name: 'Payment Received',
          content: 'Hi {{name}}, we received your payment of KES {{amount}}. Code: {{transaction_code}}. Thank you - {{business_name}}',
          isActive: true,
        },
      });

      if (adminEmail) {
        console.log(`==> Seed completed. Initial admin: ${adminEmail}`);
      } else {
        console.log('==> Seed completed. Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD to create an initial admin.');
      }
    }
  } catch (err) {
    console.error('Auto-seed error:', err);
  }
}

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  await seedIfEmpty();
});
