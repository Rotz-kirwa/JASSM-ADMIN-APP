import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

class MpesaService {
  private consumerKey = process.env.MPESA_CONSUMER_KEY;
  private consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  private shortCode = process.env.MPESA_SHORTCODE;      // Paybill/Head Office: 6270335
  private tillNumber = process.env.MPESA_TILL_NUMBER || process.env.MPESA_SHORTCODE; // Till: 895858
  private passkey = process.env.MPESA_PASSKEY;
  private environment = process.env.MPESA_ENVIRONMENT || 'sandbox';
  private callbackUrl = process.env.MPESA_CALLBACK_URL;

  private get baseUrl() {
    return this.environment === 'sandbox'
      ? 'https://sandbox.safaricom.co.ke'
      : 'https://api.safaricom.co.ke';
  }

  async getAccessToken() {
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

  async registerC2BUrls(validationUrl: string, confirmationUrl: string) {
    const accessToken = await this.getAccessToken();

    try {
      // BUG FIX: Use tillNumber (895858) not shortCode (6270335) for Buy Goods C2B
      const response = await axios.post(
        `${this.baseUrl}/mpesa/c2b/v1/registerurl`,
        {
          ShortCode: this.tillNumber,   // BUG FIX: was this.shortCode
          ResponseType: 'Completed',
          ConfirmationURL: confirmationUrl,
          ValidationURL: validationUrl,
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error registering C2B URLs:', error.response?.data || error.message);
      throw new Error('Failed to register C2B URLs');
    }
  }
}

export default new MpesaService();
