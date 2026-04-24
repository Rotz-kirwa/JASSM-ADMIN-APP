import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const auditLog = (action: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id;
    if (!userId) return next();

    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action,
          details: JSON.stringify({
            method: req.method,
            path: req.path,
            params: req.params,
            body: req.method !== 'GET' ? req.body : undefined,
          }),
        },
      });
      next();
    } catch (error) {
      console.error('Audit log error:', error);
      next(); // Don't block the request if audit logging fails
    }
  };
};
