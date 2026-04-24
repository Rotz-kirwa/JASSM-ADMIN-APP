import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getCustomers = async (req: Request, res: Response) => {
  const { page = 1, limit = 10, search } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  try {
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { phoneNumber: { contains: String(search) } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { totalPaid: 'desc' },
        include: {
          _count: {
            select: { payments: true }
          }
        }
      }),
      prisma.customer.count({ where }),
    ]);

    res.json({
      customers,
      pagination: {
        total,
        pages: Math.ceil(total / Number(limit)),
        page: Number(page),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching customers' });
  }
};

export const getCustomerById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        payments: {
          orderBy: { paidAt: 'desc' },
          take: 10
        }
      }
    });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching customer details' });
  }
};
