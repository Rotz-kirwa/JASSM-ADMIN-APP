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

const toJsonValue = (value: unknown): Prisma.InputJsonValue => {
  return JSON.parse(JSON.stringify(value ?? {}));
};

const getSafeHeaders = (req: Request) => {
  const allowedHeaders = [
    'host',
    'user-agent',
    'content-type',
    'content-length',
    'x-forwarded-for',
    'x-real-ip',
    'x-request-id',
  ];

  return allowedHeaders.reduce<Record<string, string>>((headers, key) => {
    const value = req.headers[key];
    if (typeof value === 'string') headers[key] = value;
    if (Array.isArray(value)) headers[key] = value.join(', ');
    return headers;
  }, {});
};

const logCallbackActivity = async (
  callbackEventId: string | undefined,
  stage: string,
  message: string,
  details?: unknown,
  level: 'INFO' | 'WARN' | 'ERROR' = 'INFO'
) => {
  if (!callbackEventId) return;

  try {
    await prisma.paymentActivityLog.create({
      data: {
        callbackEventId,
        level,
        stage,
        message,
        details: details === undefined ? undefined : toJsonValue(details),
      },
    });
  } catch (error) {
    console.error('Failed to record payment activity log:', error);
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
  transactionCode?: string,
  req?: Request
) => {
  try {
    const event = await prisma.paymentCallbackEvent.create({
      data: {
        eventType,
        transactionCode,
        method: req?.method,
        path: req?.originalUrl || req?.path,
        contentType: req?.headers['content-type'],
        userAgent: req?.headers['user-agent'],
        ip: req?.ip,
        headers: req ? toJsonValue(getSafeHeaders(req)) : undefined,
        query: req ? toJsonValue(req.query) : undefined,
        rawBody: req ? (req as any).rawBody : undefined,
        payload: toJsonValue(payload),
      },
    });

    await logCallbackActivity(event.id, 'received', `${eventType} received`, {
      contentType: req?.headers['content-type'],
      method: req?.method,
      path: req?.originalUrl || req?.path,
      hasRawBody: Boolean(req && (req as any).rawBody),
      payloadKeys: payload && typeof payload === 'object' ? Object.keys(payload as Record<string, unknown>) : [],
    });

    return event;
  } catch (error) {
    console.error(`Failed to record ${eventType} callback event:`, error);
    return null;
  }
};

const updateCallbackEvent = async (
  id: string | undefined,
  status: 'PROCESSED' | 'FAILED',
  transactionCode?: string,
  error?: unknown,
  paymentId?: string
) => {
  if (!id) return;

  try {
    await prisma.paymentCallbackEvent.update({
      where: { id },
      data: {
        status,
        transactionCode,
        paymentId,
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
  await logCallbackActivity(eventId, 'parse', 'Parsing C2B payload', {
    payloadKeys: payload && typeof payload === 'object' ? Object.keys(payload) : [],
  });

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

  const rawTransID = String(TransID || '').trim();
  // ThirdPartyTransID is '0' for standard Buy Goods — never use it as a primary key
  const rawThirdParty = String(ThirdPartyTransID || '').trim();
  const thirdPartyCode = rawThirdParty && /^[^0]\d*$|^[A-Za-z]/.test(rawThirdParty) ? rawThirdParty : '';
  const transactionCode = rawTransID || thirdPartyCode;
  const amount = Number(TransAmount);
  const phoneNumber = normalizePhoneNumber(MSISDN || PhoneNumber);

  if (!transactionCode || !Number.isFinite(amount) || amount <= 0 || !phoneNumber) {
    await logCallbackActivity(eventId, 'validation_failed', 'C2B payload is missing required fields', {
      transactionCode,
      amount,
      phoneNumber,
      rawTransAmount: TransAmount,
      rawPhone: MSISDN || PhoneNumber,
    }, 'ERROR');
    throw new Error('C2B confirmation missing transaction code, amount, or phone number');
  }

  await logCallbackActivity(eventId, 'validated', 'C2B payload validated', {
    transactionCode,
    amount,
    phoneNumber,
  });

  const paidAt = parseMpesaDate(TransTime);
  const customerName = [FirstName, MiddleName, LastName].filter(Boolean).join(' ');

  await logCallbackActivity(eventId, 'recording_payment', 'Creating or reusing payment record', {
    transactionCode,
    source: 'C2B_TILL',
  });

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

  await logCallbackActivity(eventId, 'recorded', 'Payment processing completed', {
    paymentId: payment.id,
    transactionCode: payment.transactionCode,
    amount: payment.amount,
  });
  await updateCallbackEvent(eventId, 'PROCESSED', transactionCode, undefined, payment.id);
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
        method: true,
        path: true,
        contentType: true,
        paymentId: true,
        createdAt: true,
        processedAt: true,
        _count: {
          select: { logs: true },
        },
      },
    });

    res.json({ events });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching callback events' });
  }
};

export const getCallbackEventById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const event = await prisma.paymentCallbackEvent.findUnique({
      where: { id },
      include: {
        logs: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!event) {
      return res.status(404).json({ message: 'Callback event not found' });
    }

    res.json(event);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching callback event' });
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
    const event = await createCallbackEvent('C2B_GENERIC_CALLBACK', body, body.TransID || body.ThirdPartyTransID, req);

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

  const event = await createCallbackEvent('STK_CALLBACK', callbackData, undefined, req);

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

// Returns midnight EAT (UTC+3) as a UTC Date so Prisma comparisons align with Kenya calendar days.
const eatMidnight = (utcDate: Date): Date => {
  const EAT_MS = 3 * 60 * 60 * 1000;
  const eatDate = new Date(utcDate.getTime() + EAT_MS);
  return new Date(
    Date.UTC(eatDate.getUTCFullYear(), eatDate.getUTCMonth(), eatDate.getUTCDate()) - EAT_MS
  );
};

export const getSummary = async (_req: Request, res: Response) => {
  try {
    const now = new Date();

    const todayStart = eatMidnight(now);

    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

    const thisWeekStart = (() => {
      const eat = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      return new Date(todayStart.getTime() - eat.getUTCDay() * 24 * 60 * 60 * 1000);
    })();

    const thisMonthStart = (() => {
      const eat = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      return new Date(Date.UTC(eat.getUTCFullYear(), eat.getUTCMonth(), 1) - 3 * 60 * 60 * 1000);
    })();

    const thisYearStart = (() => {
      const eat = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      return new Date(Date.UTC(eat.getUTCFullYear(), 0, 1) - 3 * 60 * 60 * 1000);
    })();

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
  const DAY_MS = 24 * 60 * 60 * 1000;

  const todayEat = eatMidnight(now);
  const tomorrowEat = new Date(todayEat.getTime() + DAY_MS);

  let startDate = todayEat;
  let endDate = tomorrowEat;

  if (range === 'today') {
    // defaults are fine
  } else if (range === 'yesterday') {
    startDate = new Date(todayEat.getTime() - DAY_MS);
    endDate = todayEat;
  } else if (range === 'last7days') {
    startDate = new Date(todayEat.getTime() - 6 * DAY_MS);
    endDate = tomorrowEat;
  } else if (range === 'thismonth') {
    const eatNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    startDate = new Date(Date.UTC(eatNow.getUTCFullYear(), eatNow.getUTCMonth(), 1) - 3 * 60 * 60 * 1000);
    endDate = new Date(Date.UTC(eatNow.getUTCFullYear(), eatNow.getUTCMonth() + 1, 1) - 3 * 60 * 60 * 1000);
  } else if (range === 'thisyear') {
    const eatNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    startDate = new Date(Date.UTC(eatNow.getUTCFullYear(), 0, 1) - 3 * 60 * 60 * 1000);
    endDate = new Date(Date.UTC(eatNow.getUTCFullYear() + 1, 0, 1) - 3 * 60 * 60 * 1000);
  }

  // Shift a UTC Date into EAT so UTC getters return EAT values.
  const toEat = (d: Date) => new Date(d.getTime() + 3 * 60 * 60 * 1000);

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
        for (let i = 0; i < 24; i++) {
          result[`${i}:00`] = 0;
        }
        payments.forEach(p => {
          const hour = toEat(p.paidAt).getUTCHours();
          result[`${hour}:00`] += p.amount;
        });
      } else if (range === 'last7days') {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (let i = 6; i >= 0; i--) {
          const d = toEat(new Date(endDate.getTime() - (i + 1) * DAY_MS));
          result[days[d.getUTCDay()]] = 0;
        }
        payments.forEach(p => {
          result[days[toEat(p.paidAt).getUTCDay()]] += p.amount;
        });
      } else if (range === 'thismonth') {
        const eatNow = toEat(now);
        const daysInMonth = new Date(Date.UTC(eatNow.getUTCFullYear(), eatNow.getUTCMonth() + 1, 0)).getUTCDate();
        for (let i = 1; i <= daysInMonth; i++) {
          result[`${i}`] = 0;
        }
        payments.forEach(p => {
          result[`${toEat(p.paidAt).getUTCDate()}`] += p.amount;
        });
      } else if (range === 'thisyear') {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        months.forEach(m => result[m] = 0);
        payments.forEach(p => {
          result[months[toEat(p.paidAt).getUTCMonth()]] += p.amount;
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
  await createCallbackEvent('C2B_VALIDATION', body, undefined, req);
  res.json(MPESA_ACCEPTED);
};

export const handleC2BConfirmation = async (req: Request, res: Response) => {
  const body = normalizeCallbackBody(req.body) as any;
  console.log('C2B Confirmation Payload:', body);
  const transactionCode = String(body?.TransID || body?.ThirdPartyTransID || '').trim();
  const event = await createCallbackEvent('C2B_CONFIRMATION', body, transactionCode || undefined, req);

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

export const handleUnknownPaymentWebhook = async (req: Request, res: Response) => {
  const body = normalizeCallbackBody(req.body) as any;
  const transactionCode = String(body?.TransID || body?.ThirdPartyTransID || '').trim();
  const event = await createCallbackEvent('UNKNOWN_PAYMENT_WEBHOOK', body, transactionCode || undefined, req);

  if (body?.Body?.stkCallback) {
    await logCallbackActivity(event?.id, 'reroute', 'Unknown payment webhook looked like an STK callback; routing to STK handler');
    return handleCallback(req, res);
  }

  if (body?.TransID || body?.ThirdPartyTransID) {
    try {
      await logCallbackActivity(event?.id, 'reroute', 'Unknown payment webhook looked like C2B; attempting C2B processing');
      await processC2BPayload(body, event?.id);
      return res.json(MPESA_ACCEPTED);
    } catch (error) {
      if (isDuplicateTransactionError(error)) {
        await updateCallbackEvent(event?.id, 'PROCESSED', transactionCode || undefined);
        return res.json(MPESA_ACCEPTED);
      }

      await updateCallbackEvent(event?.id, 'FAILED', transactionCode || undefined, error);
      console.error('Unknown payment webhook processing error:', error);
      return res.status(500).json({ ResultCode: 1, ResultDesc: 'Internal Error' });
    }
  }

  await logCallbackActivity(event?.id, 'unrecognized', 'Unknown payment webhook did not match STK or C2B payload fields', {
    payloadKeys: body && typeof body === 'object' ? Object.keys(body) : [],
  }, 'WARN');
  await updateCallbackEvent(event?.id, 'FAILED', transactionCode || undefined, 'Unrecognized payment webhook payload');

  return res.json(MPESA_ACCEPTED);
};

export const registerC2B = async (req: Request, res: Response) => {
  try {
    const baseUrl = String(req.body.baseUrl || process.env.PUBLIC_API_BASE_URL || `${req.protocol}://${req.get('host')}`)
      .replace(/\/$/, '');
    
    const validationUrl = `${baseUrl}/api/payments/c2b/validation`;
    const confirmationUrl = `${baseUrl}/api/payments/c2b/confirmation`;

    const result = await mpesaService.registerC2BUrls(validationUrl, confirmationUrl);
    const message = (result as any).alreadyRegistered
      ? 'C2B URLs are already registered with Safaricom — callbacks are active'
      : 'C2B URLs registered successfully';
    res.json({ message, result });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
