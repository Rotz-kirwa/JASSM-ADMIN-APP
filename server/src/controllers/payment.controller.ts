import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import mpesaService from '../services/mpesa.service';
import smsService from '../services/sms.service';

const prisma = new PrismaClient();

export const getPayments = async (req: Request, res: Response) => {
  const { page = 1, limit = 10, search, startDate, endDate } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  try {
    const where: any = {};
    if (search) {
      where.OR = [
        { transactionCode: { contains: String(search), mode: 'insensitive' } },
        { phoneNumber: { contains: String(search) } },
      ];
    }
    if (startDate && endDate) {
      where.paidAt = {
        gte: new Date(String(startDate)),
        lte: new Date(String(endDate)),
      };
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { paidAt: 'desc' },
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({
      payments,
      pagination: {
        total,
        pages: Math.ceil(total / Number(limit)),
        page: Number(page),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching payments' });
  }
};

export const triggerStkPush = async (req: Request, res: Response) => {
  const { phoneNumber, amount, accountReference } = req.body;

  try {
    const result = await mpesaService.stkPush(
      phoneNumber,
      amount,
      accountReference || 'PAYMENT',
      'Payment for services'
    );
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const handleCallback = async (req: Request, res: Response) => {
  const callbackData = req.body?.Body?.stkCallback;
  
  if (!callbackData) {
    return res.status(400).json({ ResultCode: 1, ResultDesc: 'Invalid Payload' });
  }

  try {
    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callbackData;

    if (ResultCode === 0 && CallbackMetadata) {
      const items = CallbackMetadata.Item;
      const amount = items.find((i: any) => i.Name === 'Amount')?.Value;
      const mpesaReceiptNumber = items.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value;
      const transactionDate = items.find((i: any) => i.Name === 'TransactionDate')?.Value;
      const phoneNumber = items.find((i: any) => i.Name === 'PhoneNumber')?.Value;

      if (!mpesaReceiptNumber) {
        console.error('Callback missing receipt number:', callbackData);
        return res.json({ ResultCode: 0, ResultDesc: 'Accepted but missing receipt' });
      }

      // 1. Deduplication Check
      const existingPayment = await prisma.payment.findUnique({
        where: { transactionCode: String(mpesaReceiptNumber) },
      });

      if (existingPayment) {
        console.log(`Payment ${mpesaReceiptNumber} already processed.`);
        return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
      }

      // 2. Parse Date Safely (Format: YYYYMMDDHHmmss)
      let parsedDate = new Date();
      if (transactionDate) {
        const dateStr = String(transactionDate);
        if (dateStr.length === 14) {
          const year = dateStr.slice(0, 4);
          const month = dateStr.slice(4, 6);
          const day = dateStr.slice(6, 8);
          const hour = dateStr.slice(8, 10);
          const minute = dateStr.slice(10, 12);
          const second = dateStr.slice(12, 14);
          parsedDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+03:00`);
        }
      }

      // 3. Atomic Database Transaction
      await prisma.$transaction(async (tx) => {
        const customer = await tx.customer.upsert({
          where: { phoneNumber: String(phoneNumber) },
          update: {
            totalPaid: { increment: Number(amount) },
            lastPaidAt: parsedDate,
          },
          create: {
            phoneNumber: String(phoneNumber),
            totalPaid: Number(amount),
            lastPaidAt: parsedDate,
          },
        });

        await tx.payment.create({
          data: {
            transactionCode: String(mpesaReceiptNumber),
            phoneNumber: String(phoneNumber),
            amount: parseFloat(String(amount)),
            status: 'SUCCESS',
            source: 'STK_PUSH',
            paidAt: parsedDate,
            customerId: customer.id,
            rawCallback: callbackData,
          },
        });
      });

      // 4. Send SMS Notification (non-blocking)
      try {
        const customer = await prisma.customer.findUnique({ where: { phoneNumber: String(phoneNumber) } });
        const template = await prisma.sMSTemplate.findFirst({ where: { isActive: true } });
        if (template && customer) {
          const message = smsService.parseTemplate(template.content, {
            name: customer.name || 'Customer',
            amount: String(amount),
            transaction_code: String(mpesaReceiptNumber),
            date: parsedDate.toLocaleDateString(),
            business_name: process.env.BUSINESS_NAME || 'MOBOSOFT',
          });
          await smsService.sendSms(customer.phoneNumber, message);
        }
      } catch (smsError) {
        console.error('Failed to send SMS for successful payment:', smsError);
      }
    } else {
      console.log('STK Push Failed or Cancelled:', ResultDesc);
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('Callback processing error:', error);
    res.status(500).json({ ResultCode: 1, ResultDesc: 'Internal Error' });
  }
};

export const getSummary = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    
    const thisWeekStart = new Date(todayStart);
    thisWeekStart.setDate(todayStart.getDate() - todayStart.getDay());
    
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const thisYearStart = new Date(now.getFullYear(), 0, 1);

    const [today, yesterday, thisWeek, thisMonth, thisYear] = await Promise.all([
      prisma.payment.aggregate({
        where: { status: 'SUCCESS', paidAt: { gte: todayStart } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.payment.aggregate({
        where: { status: 'SUCCESS', paidAt: { gte: yesterdayStart, lt: todayStart } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.payment.aggregate({
        where: { status: 'SUCCESS', paidAt: { gte: thisWeekStart } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.payment.aggregate({
        where: { status: 'SUCCESS', paidAt: { gte: thisMonthStart } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.payment.aggregate({
        where: { status: 'SUCCESS', paidAt: { gte: thisYearStart } },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    res.json({
      today: { amount: today._sum.amount || 0, count: today._count.id },
      yesterday: { amount: yesterday._sum.amount || 0, count: yesterday._count.id },
      thisWeek: { amount: thisWeek._sum.amount || 0, count: thisWeek._count.id },
      thisMonth: { amount: thisMonth._sum.amount || 0, count: thisMonth._count.id },
      thisYear: { amount: thisYear._sum.amount || 0, count: thisYear._count.id },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching summary' });
  }
};

export const getReports = async (req: Request, res: Response) => {
  const { range = 'last7days' } = req.query; 
  const now = new Date();
  
  let startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  if (range === 'today') {
    // defaults are fine
  } else if (range === 'yesterday') {
    startDate.setDate(startDate.getDate() - 1);
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
  } else if (range === 'last7days') {
    startDate.setDate(startDate.getDate() - 6);
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  } else if (range === 'thismonth') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  } else if (range === 'thisyear') {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = new Date(now.getFullYear() + 1, 0, 1);
  }

  try {
    const payments = await prisma.payment.findMany({
      where: {
        paidAt: { gte: startDate, lt: endDate },
        status: 'SUCCESS',
      },
      select: { paidAt: true, amount: true },
      orderBy: { paidAt: 'asc' },
    });

    const formatData = () => {
      const result: Record<string, number> = {};
      
      if (range === 'today' || range === 'yesterday') {
        for(let i=0; i<24; i++) {
          result[`${i}:00`] = 0;
        }
        payments.forEach(p => {
          const hour = p.paidAt.getHours();
          result[`${hour}:00`] += p.amount;
        });
      } else if (range === 'last7days') {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for(let i=6; i>=0; i--) {
          const d = new Date(endDate);
          d.setDate(d.getDate() - 1 - i);
          result[days[d.getDay()]] = 0;
        }
        payments.forEach(p => {
          result[days[p.paidAt.getDay()]] += p.amount;
        });
      } else if (range === 'thismonth') {
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        for(let i=1; i<=daysInMonth; i++) {
          result[`${i}`] = 0;
        }
        payments.forEach(p => {
          result[`${p.paidAt.getDate()}`] += p.amount;
        });
      } else if (range === 'thisyear') {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        months.forEach(m => result[m] = 0);
        payments.forEach(p => {
          result[months[p.paidAt.getMonth()]] += p.amount;
        });
      }

      return Object.keys(result).map(key => ({ name: key, revenue: result[key] }));
    };

    res.json(formatData());
  } catch (error) {
    res.status(500).json({ message: 'Error generating report' });
  }
};
