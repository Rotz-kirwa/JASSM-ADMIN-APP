import assert from 'assert';

type JsonRecord = Record<string, any>;

class PrismaClientKnownRequestError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

const db = {
  payments: [] as JsonRecord[],
  customers: [] as JsonRecord[],
  callbackEvents: [] as JsonRecord[],
  activityLogs: [] as JsonRecord[],
  smsMessages: [] as JsonRecord[],
};

const nextId = (prefix: string, list: JsonRecord[]) => `${prefix}_${list.length + 1}`;

const paymentModel = {
  async findUnique({ where }: JsonRecord) {
    return db.payments.find((payment) => payment.transactionCode === where.transactionCode) || null;
  },
  async create({ data }: JsonRecord) {
    if (db.payments.some((payment) => payment.transactionCode === data.transactionCode)) {
      throw new PrismaClientKnownRequestError('Unique constraint failed', 'P2002');
    }

    const payment = { id: nextId('payment', db.payments), ...data };
    db.payments.push(payment);
    return payment;
  },
};

const customerModel = {
  async findUnique({ where }: JsonRecord) {
    return db.customers.find((customer) => customer.phoneNumber === where.phoneNumber) || null;
  },
  async upsert({ where, update, create }: JsonRecord) {
    const existing = db.customers.find((customer) => customer.phoneNumber === where.phoneNumber);

    if (existing) {
      if (update.totalPaid?.increment) existing.totalPaid += update.totalPaid.increment;
      if (update.lastPaidAt) existing.lastPaidAt = update.lastPaidAt;
      if (update.name !== undefined) existing.name = update.name;
      return existing;
    }

    const customer = { id: nextId('customer', db.customers), ...create };
    db.customers.push(customer);
    return customer;
  },
};

const prisma = {
  payment: paymentModel,
  customer: customerModel,
  sMSTemplate: {
    async findFirst() {
      return {
        id: 'template_1',
        name: 'Payment Received',
        content: 'Hi {{name}}, we received KES {{amount}}. Code {{transaction_code}}.',
        isActive: true,
      };
    },
  },
  paymentCallbackEvent: {
    async create({ data }: JsonRecord) {
      const event = {
        id: nextId('event', db.callbackEvents),
        status: 'RECEIVED',
        createdAt: new Date(),
        ...data,
      };
      db.callbackEvents.push(event);
      return event;
    },
    async update({ where, data }: JsonRecord) {
      const event = db.callbackEvents.find((item) => item.id === where.id);
      assert(event, `Expected callback event ${where.id} to exist`);
      Object.assign(event, data);
      return event;
    },
    async findMany() {
      return db.callbackEvents;
    },
    async findUnique({ where }: JsonRecord) {
      return db.callbackEvents.find((event) => event.id === where.id) || null;
    },
  },
  paymentActivityLog: {
    async create({ data }: JsonRecord) {
      const log = { id: nextId('log', db.activityLogs), createdAt: new Date(), ...data };
      db.activityLogs.push(log);
      return log;
    },
  },
  async $transaction<T>(callback: (tx: any) => Promise<T>) {
    return callback({ customer: customerModel, payment: paymentModel });
  },
};

class FakePrismaClient {
  constructor() {
    return prisma as any;
  }
}

const Module = require('module');
const originalLoad = Module._load;

Module._load = function loadWithMocks(request: string, parent: any, isMain: boolean) {
  if (request === '@prisma/client') {
    return {
      PrismaClient: FakePrismaClient,
      Prisma: { PrismaClientKnownRequestError },
    };
  }

  if (request.includes('sms.service')) {
    return {
      __esModule: true,
      default: {
        parseTemplate(template: string, variables: Record<string, string>) {
          return Object.entries(variables).reduce(
            (message, [key, value]) => message.replace(new RegExp(`{{${key}}}`, 'g'), value),
            template
          );
        },
        async sendSms(phoneNumber: string, message: string) {
          db.smsMessages.push({ phoneNumber, message });
          return { status: 'mocked' };
        },
      },
    };
  }

  if (request.includes('mpesa.service')) {
    return {
      __esModule: true,
      default: {
        async stkPush() {
          return { ResponseCode: '0' };
        },
        async registerC2BUrls() {
          return { ResponseCode: '0' };
        },
      },
    };
  }

  return originalLoad(request, parent, isMain);
};

const {
  handleC2BConfirmation,
  handleCallback,
} = require('../src/controllers/payment.controller');

const createResponse = () => {
  const res: JsonRecord = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };

  return res;
};

const createRequest = (body: JsonRecord) => ({
  body,
  method: 'POST',
  originalUrl: '/api/payments/c2b/confirmation',
  path: '/c2b/confirmation',
  headers: {
    'content-type': 'application/json',
    'user-agent': 'payment-recording-test',
  },
  query: {},
  ip: '127.0.0.1',
});

async function postC2B(transactionCode: string, amount: number, phoneNumber = '0712345678') {
  const req = createRequest({
    TransID: transactionCode,
    TransAmount: String(amount),
    MSISDN: phoneNumber,
    FirstName: 'Test',
    LastName: 'Customer',
    TransTime: '20260424123045',
    BusinessShortCode: '895858',
  });
  const res = createResponse();

  await handleC2BConfirmation(req, res);
  return res;
}

async function postStk(transactionCode: string, amount: number, phoneNumber = 254798765432) {
  const req = createRequest({
    Body: {
      stkCallback: {
        MerchantRequestID: 'merchant_1',
        CheckoutRequestID: 'checkout_1',
        ResultCode: 0,
        ResultDesc: 'The service request is processed successfully.',
        CallbackMetadata: {
          Item: [
            { Name: 'Amount', Value: amount },
            { Name: 'MpesaReceiptNumber', Value: transactionCode },
            { Name: 'TransactionDate', Value: 20260424124530 },
            { Name: 'PhoneNumber', Value: phoneNumber },
          ],
        },
      },
    },
  });
  const res = createResponse();

  await handleCallback(req, res);
  return res;
}

async function run() {
  const first = await postC2B('TILL001', 250);
  assert.equal(first.statusCode, 200);
  assert.deepEqual(first.body, { ResultCode: 0, ResultDesc: 'Accepted' });
  assert.equal(db.payments.length, 1);
  assert.equal(db.payments[0].transactionCode, 'TILL001');
  assert.equal(db.payments[0].amount, 250);
  assert.equal(db.payments[0].phoneNumber, '254712345678');
  assert.equal(db.payments[0].source, 'C2B_TILL');
  assert.equal(db.customers[0].totalPaid, 250);
  assert.equal(db.callbackEvents[0].status, 'PROCESSED');
  assert.equal(db.callbackEvents[0].paymentId, 'payment_1');
  assert.equal(db.smsMessages.length, 1);

  const duplicate = await postC2B('TILL001', 250);
  assert.equal(duplicate.statusCode, 200);
  assert.equal(db.payments.length, 1);
  assert.equal(db.customers[0].totalPaid, 250);
  assert.equal(db.smsMessages.length, 1);

  await postC2B('TILL002', 100);
  await postC2B('TILL003', 75);
  assert.equal(db.payments.length, 3);
  assert.equal(db.customers[0].totalPaid, 425);

  const stk = await postStk('STK001', 50);
  assert.equal(stk.statusCode, 200);
  assert.equal(db.payments.length, 4);
  assert.equal(db.payments[3].transactionCode, 'STK001');
  assert.equal(db.payments[3].source, 'STK_PUSH');

  const failed = await postC2B('BROKEN001', 0);
  assert.equal(failed.statusCode, 500);
  assert.equal(db.payments.some((payment) => payment.transactionCode === 'BROKEN001'), false);
  assert.equal(db.callbackEvents.at(-1)?.status, 'FAILED');

  console.log('Payment recording regression test passed');
  console.log(`Recorded payments: ${db.payments.length}`);
  console.log(`Customer total for 254712345678: KES ${db.customers[0].totalPaid}`);
  console.log(`Callback events captured: ${db.callbackEvents.length}`);
  console.log(`Activity logs captured: ${db.activityLogs.length}`);
}

run()
  .catch((error) => {
    console.error('Payment recording regression test failed');
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    Module._load = originalLoad;
  });
