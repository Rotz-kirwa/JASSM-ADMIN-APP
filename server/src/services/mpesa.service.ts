import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

class MpesaService {
  private consumerKey = process.env.MPESA_CONSUMER_KEY;
  private consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  private shortCode = process.env.MPESA_SHORTCODE;      // Paybill/Head Office: 6270335
  private tillNumber = process.env.MPESA_TILL_NUMBER || process.env.MPESA_SHORTCODE; // Till: 895858
  private c2bShortCode = process.env.MPESA_C2B_SHORTCODE || process.env.MPESA_TILL_NUMBER || process.env.MPESA_SHORTCODE;
  private passkey = process.env.MPESA_PASSKEY;
  private environment = process.env.MPESA_ENVIRONMENT || 'sandbox';
  private callbackUrl = process.env.MPESA_CALLBACK_URL;

  private get baseUrl() {
    return this.environment === 'sandbox'
      ? 'https://sandbox.safaricom.co.ke'
      : 'https://api.safaricom.co.ke';
  }

  private requireConfig(values: Record<string, string | undefined>) {
    const missing = Object.entries(values)
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      throw new Error(`Missing M-Pesa configuration: ${missing.join(', ')}`);
    }
  }

  private getProviderError(error: any) {
    return error.response?.data?.errorMessage
      || error.response?.data?.error
      || error.response?.data?.message
      || error.response?.data
      || error.message;
  }

  async getAccessToken() {
    this.requireConfig({
      MPESA_CONSUMER_KEY: this.consumerKey,
      MPESA_CONSUMER_SECRET: this.consumerSecret,
    });

    const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
    try {
      const response = await axios.get(
        `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        { headers: { Authorization: `Basic ${auth}` } }
      );
      return response.data.access_token;
    } catch (error: any) {
      console.error('Error generating M-Pesa access token:', error.response?.data || error.message);
      throw new Error('Failed to generate M-Pesa access token');
    }
  }

  async stkPush(phoneNumber: string, amount: number, accountReference: string, transactionDesc: string) {
    this.requireConfig({
      MPESA_TILL_NUMBER: this.tillNumber,
      MPESA_PASSKEY: this.passkey,
      MPESA_CALLBACK_URL: this.callbackUrl,
    });

    const accessToken = await this.getAccessToken();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);

    // BUG FIX: For CustomerBuyGoodsOnline, BusinessShortCode = Till Number (895858)
    // Password = Base64(TillNumber + Passkey + Timestamp)
    const password = Buffer.from(`${this.tillNumber}${this.passkey}${timestamp}`).toString('base64');

    const formattedPhone = phoneNumber.startsWith('0')
      ? `254${phoneNumber.slice(1)}`
      : phoneNumber.startsWith('+')
        ? phoneNumber.slice(1)
        : phoneNumber;

    try {
      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
        {
          BusinessShortCode: this.tillNumber,   // BUG FIX: was this.shortCode
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerBuyGoodsOnline',
          Amount: Math.ceil(amount),            // M-Pesa requires whole numbers
          PartyA: formattedPhone,
          PartyB: this.tillNumber,
          PhoneNumber: formattedPhone,
          CallBackURL: this.callbackUrl,
          AccountReference: accountReference,
          TransactionDesc: transactionDesc,
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error in STK Push:', error.response?.data || error.message);
      throw new Error('M-Pesa STK Push failed');
    }
  }

  private async registerC2BUrlsForShortCode(
    accessToken: string,
    shortCode: string,
    validationUrl: string,
    confirmationUrl: string
  ) {
    const registerUrlPath = this.environment === 'production'
      ? '/mpesa/c2b/v2/registerurl'
      : '/mpesa/c2b/v1/registerurl';

    const response = await axios.post(
      `${this.baseUrl}${registerUrlPath}`,
      {
        ShortCode: shortCode,
        ResponseType: 'Completed',
        ConfirmationURL: confirmationUrl,
        ValidationURL: validationUrl,
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return response.data;
  }

  async registerC2BUrls(validationUrl: string, confirmationUrl: string) {
    this.requireConfig({
      MPESA_C2B_SHORTCODE: this.c2bShortCode,
    });

    const accessToken = await this.getAccessToken();

    try {
      return await this.registerC2BUrlsForShortCode(
        accessToken,
        this.c2bShortCode as string,
        validationUrl,
        confirmationUrl
      );
    } catch (error: any) {
      const providerError = this.getProviderError(error);
      console.error('Error registering C2B URLs:', error.response?.data || error.message);

      const canRetryWithMainShortCode = !process.env.MPESA_C2B_SHORTCODE
        && this.shortCode
        && this.shortCode !== this.c2bShortCode
        && String(providerError).toLowerCase().includes('own shortcode');

      if (canRetryWithMainShortCode) {
        try {
          const result = await this.registerC2BUrlsForShortCode(
            accessToken,
            this.shortCode as string,
            validationUrl,
            confirmationUrl
          );

          return {
            ...result,
            registeredShortCode: this.shortCode,
            note: 'Retried with MPESA_SHORTCODE because Safaricom rejected the Till number for this Daraja app.',
          };
        } catch (retryError: any) {
          const retryProviderError = this.getProviderError(retryError);
          console.error('Error registering C2B URLs with MPESA_SHORTCODE:', retryError.response?.data || retryError.message);
          throw new Error(`Failed to register C2B URLs: ${retryProviderError}`);
        }
      }

      throw new Error(`Failed to register C2B URLs: ${providerError}`);
    }
  }
}

export default new MpesaService();
