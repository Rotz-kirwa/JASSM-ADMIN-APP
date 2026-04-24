import { Request, Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import mpesaService from '../services/mpesa.service';
import smsService from '../services/sms.service';

const prisma = new PrismaClient();

const MPESA_ACCEPTED = { ResultCode: 0, ResultDesc: 'Accepted' };

const isDuplicateTransactionError = (error: unknown) => {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
};

const parseMpesaDate = (value: unknown) => {
  if (!value) return new Date();

  const dateStr = String(value);
  if (dateStr.length !== 14) return new Date();

  const year = dateStr.slice(0, 4);
  const month = dateStr.slice(4, 6);
  const day = dateStr.slice(6, 8);
  const hour = dateStr.slice(8, 10);
  const minute = dateStr.slice(10, 12);
  const second = dateStr.slice(12, 14);

  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+03:00`);
};

const getCallbackItemValue = (items: any[] = [], name: string) => {
  return items.find((item) => item.Name === name)?.Value;
};

const normalizePhoneNumber = (phoneNumber: unknown) => {
  const digits = String(phoneNumber || '').replace(/\D/g, '');

  if (digits.startsWith('0')) return `254${digits.slice(1)}`;
  if (digits.startsWith('254')) return digits;
  if (digits.length === 9) return `254${digits}`;

  return digits;
};

const normalizeCallbackBody = (body: unknown) => {
  if (typeof body !== 'string') return body || {};

  const trimmed = body.trim();
  if (!trimmed) return {};

  try {
    return JSON.parse(trimmed);
  } catch {
    const params = new URLSearchParams(trimmed);
    const parsed = Object.fromEntries(params.entries());
    return Object.keys(parsed).length > 0 ? parsed : { rawBody: trimmed };
  }
};

const sendPaymentSms = async (
  phoneNumber: string,
  amount: number,
  transactionCode: string,
  paidAt: Date
) => {
  try {
    const customer = await prisma.customer.findUnique({ where: { phoneNumber } });
    const template = await prisma.sMSTemplate.findFirst({ where: { isActive: true } });

    if (!template || !customer) return;

    const message = smsService.parseTemplate(template.content, {
      name: customer.name || 'Customer',
      amount: String(amount),
      transaction_code: transactionCode,
      date: paidAt.toLocaleDateString('en-KE'),
      business_name: process.env.BUSINESS_NAME || 'JASSM PAY',
    });

    await smsService.sendSms(customer.phoneNumber, message);
  } catch (smsError) {
    console.error(`Failed to send SMS for payment ${transactionCode}:`, smsError);
  }
};

const createCallbackEvent = async (
  eventType: string,
  payload: unknown,
  transactionCode?: string
) => {
  try {
    return await prisma.paymentCallbackEvent.create({
      data: {
        eventType,
        transactionCode,
        payload: (payload ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error(`Failed to record ${eventType} callback event:`, error);
    return null;
  }
};

const updateCallbackEvent = async (
  id: string | undefined,
  status: 'PROCESSED' | 'FAILED',
  transactionCode?: string,
  error?: unknown
) => {
  if (!id) return;

  try {
    await prisma.paymentCallbackEvent.update({
      where: { id },
      data: {
        status,
        transactionCode,
        error: error ? String(error instanceof Error ? error.message : error).slice(0, 2000) : undefined,
        processedAt: new Date(),
      },
    });
  } catch (eventError) {
    console.error('Failed to update payment callback event:', eventError);
  }
};

const recordSuccessfulPayment = async ({
  transactionCode,
  phoneNumber,
  amount,
  paidAt,
  source,
  customerName,
  rawCallback,
}: {
  transactionCode: string;
  phoneNumber: string;
  amount: number;
  paidAt: Date;
  source: string;
  customerName?: string;
  rawCallback: Prisma.InputJsonValue;
}) => {
  const existingPayment = await prisma.payment.findUnique({
    where: { transactionCode },
  });

  if (existingPayment) return existingPayment;

  const payment = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: { phoneNumber },
      update: {
        totalPaid: { increment: amount },
        lastPaidAt: paidAt,
        name: customerName || undefined,
      },
      create: {
        phoneNumber,
        name: customerName,
        totalPaid: amount,
        lastPaidAt: paidAt,
      },
    });

    return tx.payment.create({
      data: {
        transactionCode,
        phoneNumber,
        customerName,
        amount,
        status: 'SUCCESS',
        source,
        paidAt,
        customerId: customer.id,
        rawCallback,
      },
    });
  });

  void sendPaymentSms(phoneNumber, amount, transactionCode, paidAt);

  return payment;
};

const processC2BPayload = async (payload: any, eventId?: string) => {
  const {
    TransID,
    TransAmount,
    MSISDN,
    PhoneNumber,
    FirstName,
    MiddleName,
    LastName,
    TransTime,
    BillRefNumber,
    BusinessShortCode,
    InvoiceNumber,
    ThirdPartyTransID,
  } = payload;

  const transactionCode = String(TransID || ThirdPartyTransID || '').trim();
  const amount = Number(TransAmount);
  const phoneNumber = normalizePhoneNumber(MSISDN || PhoneNumber);

  if (!transactionCode || !Number.isFinite(amount) || amount <= 0 || !phoneNumber) {
    throw new Error('C2B confirmation missing transaction code, amount, or phone number');
  }

  const paidAt = parseMpesaDate(TransTime);
  const customerName = [FirstName, MiddleName, LastName].filter(Boolean).join(' ');

  const payment = await recordSuccessfulPayment({
    transactionCode,
    phoneNumber,
    customerName,
    amount,
    source: 'C2B_TILL',
    paidAt,
    rawCallback: {
      ...payload,
      BillRefNumber,
      BusinessShortCode,
      InvoiceNumber,
    } as Prisma.InputJsonValue,
  });

  await updateCallbackEvent(eventId, 'PROCESSED', transactionCode);
  return payment;
};

export const getPayments = async (req: Request, res: Response) => {
  const { page = 1, limit = 10, search, startDate, endDate } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  try {
    const where: any = {};
    if (search) {
      where.OR = [
        { transactionCode: { contains: String(search), mode: 'insensitive' } },
        { phoneNumber: { contains: String(search) } },
        { customerName: { contains: String(search), mode: 'insensitive' } },
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

export const getCallbackEvents = async (req: Request, res: Response) => {
  const { limit = 20 } = req.query;

  try {
    const events = await prisma.paymentCallbackEvent.findMany({
      take: Math.min(Number(limit) || 20, 100),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        eventType: true,
        transactionCode: true,
        status: true,
        error: true,
        createdAt: true,
        processedAt: true,
      },
    });

    res.json({ events });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching callback events' });
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
  const body = normalizeCallbackBody(req.body) as any;

  if (!body?.Body?.stkCallback && (body?.TransID || body?.ThirdPartyTransID)) {
    const event = await createCallbackEvent('C2B_GENERIC_CALLBACK', body, body.TransID || body.ThirdPartyTransID);

    try {
      await processC2BPayload(body, event?.id);
      return res.json(MPESA_ACCEPTED);
    } catch (error) {
      if (isDuplicateTransactionError(error)) {
        await updateCallbackEvent(event?.id, 'PROCESSED', body.TransID || body.ThirdPartyTransID);
        return res.json(MPESA_ACCEPTED);
      }

      await updateCallbackEvent(event?.id, 'FAILED', body.TransID || body.ThirdPartyTransID, error);
      console.error('Generic callback C2B processing error:', error);
      return res.status(500).json({ ResultCode: 1, ResultDesc: 'Internal Error' });
    }
  }

  const callbackData = body?.Body?.stkCallback;
  
  if (!callbackData) {
    return res.status(400).json({ ResultCode: 1, ResultDesc: 'Invalid Payload' });
  }

  const event = await createCallbackEvent('STK_CALLBACK', callbackData);

  try {
    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callbackData;

    if (ResultCode === 0 && CallbackMetadata) {
      const items = CallbackMetadata.Item;
      const amount = Number(getCallbackItemValue(items, 'Amount'));
      const mpesaReceiptNumber = getCallbackItemValue(items, 'MpesaReceiptNumber');
      const transactionDate = getCallbackItemValue(items, 'TransactionDate');
      const phoneNumber = normalizePhoneNumber(getCallbackItemValue(items, 'PhoneNumber'));

      if (!mpesaReceiptNumber || !amount || !phoneNumber) {
        console.error('STK callback missing required payment fields:', callbackData);
        await updateCallbackEvent(event?.id, 'FAILED', undefined, 'STK callback missing required payment fields');
        return res.json({ ResultCode: 0, ResultDesc: 'Accepted but missing receipt' });
      }

      // 2. Parse Date Safely (Format: YYYYMMDDHHmmss)
      const parsedDate = parseMpesaDate(transactionDate);

      await recordSuccessfulPayment({
        transactionCode: String(mpesaReceiptNumber),
        phoneNumber,
        amount,
        source: 'STK_PUSH',
        paidAt: parsedDate,
        rawCallback: callbackData as Prisma.InputJsonValue,
      });

      await updateCallbackEvent(event?.id, 'PROCESSED', String(mpesaReceiptNumber));
    } else {
      console.log('STK Push Failed or Cancelled:', ResultDesc);
      await updateCallbackEvent(event?.id, 'PROCESSED');
    }

    res.json(MPESA_ACCEPTED);
  } catch (error) {
    if (isDuplicateTransactionError(error)) {
      console.log('Duplicate STK callback accepted.');
      await updateCallbackEvent(event?.id, 'PROCESSED');
      return res.json(MPESA_ACCEPTED);
    }

    await updateCallbackEvent(event?.id, 'FAILED', undefined, error);
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

// C2B Endpoints
export const handleC2BValidation = async (req: Request, res: Response) => {
  // Always accept the payment for this use case
  const body = normalizeCallbackBody(req.body);
  console.log('C2B Validation Payload:', body);
  await createCallbackEvent('C2B_VALIDATION', body);
  res.json(MPESA_ACCEPTED);
};

export const handleC2BConfirmation = async (req: Request, res: Response) => {
  const body = normalizeCallbackBody(req.body) as any;
  console.log('C2B Confirmation Payload:', body);
  const transactionCode = String(body?.TransID || body?.ThirdPartyTransID || '').trim();
  const event = await createCallbackEvent('C2B_CONFIRMATION', body, transactionCode || undefined);

  try {
    await processC2BPayload(body, event?.id);
    res.json(MPESA_ACCEPTED);
  } catch (error) {
    if (isDuplicateTransactionError(error)) {
      console.log(`Duplicate C2B confirmation accepted for ${transactionCode}.`);
      await updateCallbackEvent(event?.id, 'PROCESSED', transactionCode || undefined);
      return res.json(MPESA_ACCEPTED);
    }

    await updateCallbackEvent(event?.id, 'FAILED', transactionCode || undefined, error);
    console.error('C2B Confirmation error:', error);
    res.status(500).json({ ResultCode: 1, ResultDesc: 'Internal Error' });
  }
};

export const registerC2B = async (req: Request, res: Response) => {
  try {
    const baseUrl = String(req.body.baseUrl || process.env.PUBLIC_API_BASE_URL || `${req.protocol}://${req.get('host')}`)
      .replace(/\/$/, '');
    
    const validationUrl = `${baseUrl}/api/payments/c2b/validation`;
    const confirmationUrl = `${baseUrl}/api/payments/c2b/confirmation`;

    const result = await mpesaService.registerC2BUrls(validationUrl, confirmationUrl);
    res.json({ message: 'C2B URLs registered successfully', result });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
