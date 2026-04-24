import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class SmsService {
  private apiKey = process.env.SMS_API_KEY;
  private username = process.env.SMS_USERNAME;
  private senderId = process.env.SMS_SENDER_ID;
  private provider = process.env.SMS_PROVIDER || 'africastalking';

  async sendSms(phoneNumber: string, message: string) {
    try {
      let response;
      if (this.provider === 'africastalking') {
        response = await this.sendAfricaTalking(phoneNumber, message);
      } else {
        throw new Error('Unsupported SMS provider');
      }

      // Log the SMS
      await prisma.sMSLog.create({
        data: {
          phoneNumber,
          message,
          status: 'SENT',
          providerResponse: response,
        },
      });

      return response;
    } catch (error: any) {
      console.error('Error sending SMS:', error.message);
      
      await prisma.sMSLog.create({
        data: {
          phoneNumber,
          message,
          status: 'FAILED',
          providerResponse: error.response?.data || { error: error.message },
        },
      });
      
      throw error;
    }
  }

  private async sendAfricaTalking(phoneNumber: string, message: string) {
    const url = 'https://api.africastalking.com/version1/messaging';
    const params = new URLSearchParams();
    params.append('username', this.username || '');
    params.append('to', phoneNumber);
    params.append('message', message);
    if (this.senderId) {
      params.append('from', this.senderId);
    }

    const response = await axios.post(url, params, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'apiKey': this.apiKey || '',
      },
    });

    return response.data;
  }

  parseTemplate(template: string, variables: Record<string, string>) {
    let message = template;
    for (const [key, value] of Object.entries(variables)) {
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return message;
  }
}

export default new SmsService();
