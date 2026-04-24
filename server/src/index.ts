import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import paymentRoutes from './routes/payment.routes';
import smsRoutes from './routes/sms.routes';
import customerRoutes from './routes/customer.routes';
import settingRoutes from './routes/setting.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
