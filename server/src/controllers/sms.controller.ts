import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import smsService from '../services/sms.service';

const prisma = new PrismaClient();

export const getTemplates = async (req: Request, res: Response) => {
  try {
    const templates = await prisma.sMSTemplate.findMany();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching templates' });
  }
};

export const createTemplate = async (req: Request, res: Response) => {
  const { name, content, isActive } = req.body;

  try {
    if (isActive) {
      await prisma.sMSTemplate.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    const template = await prisma.sMSTemplate.create({
      data: { name, content, isActive: !!isActive },
    });
    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({ message: 'Error creating template' });
  }
};

export const updateTemplate = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, content, isActive } = req.body;

  try {
    if (isActive) {
      await prisma.sMSTemplate.updateMany({
        where: { NOT: { id }, isActive: true },
        data: { isActive: false },
      });
    }

    const template = await prisma.sMSTemplate.update({
      where: { id },
      data: { name, content, isActive },
    });
    res.json(template);
  } catch (error) {
    res.status(500).json({ message: 'Error updating template' });
  }
};

export const getLogs = async (req: Request, res: Response) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  try {
    const [logs, total] = await Promise.all([
      prisma.sMSLog.findMany({
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.sMSLog.count(),
    ]);

    res.json({
      logs,
      pagination: {
        total,
        pages: Math.ceil(total / Number(limit)),
        page: Number(page),
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching logs' });
  }
};

export const retrySms = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const log = await prisma.sMSLog.findUnique({ where: { id } });
    if (!log) return res.status(404).json({ message: 'Log not found' });

    const result = await smsService.sendSms(log.phoneNumber, log.message);
    await prisma.sMSLog.update({
      where: { id },
      data: { retryCount: { increment: 1 } },
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Retry failed' });
  }
};
