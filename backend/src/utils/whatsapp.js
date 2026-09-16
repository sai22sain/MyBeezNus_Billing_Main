const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

class WhatsAppService {
  constructor() {
    this.apiUrl = process.env.WHATSAPP_API_URL;
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  }

  async sendMessage(to, message) {
    try {
      const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;
      const response = await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: { body: message }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('WhatsApp send message error:', error.response?.data || error.message);
      throw error;
    }
  }

  async uploadMedia(filePath) {
    try {
      const url = `${this.apiUrl}/${this.phoneNumberId}/media`;
      const formData = new FormData();
      formData.append('messaging_product', 'whatsapp');
      formData.append('file', fs.createReadStream(filePath), {
        filename: 'bill.pdf',
        contentType: 'application/pdf'
      });

      const response = await axios.post(url, formData, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          ...formData.getHeaders()
        }
      });
      return response.data.id;
    } catch (error) {
      console.error('WhatsApp upload media error:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendDocument(to, mediaId, caption) {
    try {
      const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;
      const response = await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          to: to,
          type: 'document',
          document: {
            id: mediaId,
            caption: caption,
            filename: 'bill.pdf'
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('WhatsApp send document error:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendBill(to, customerName, totalAmount, pdfPath) {
    try {
      const businessName = process.env.BUSINESS_NAME || process.env.SALON_NAME || 'Our Business';
      const message = `Hello ${customerName},\n\nThank you for choosing ${businessName}.\n\nYour bill amount is ₹${totalAmount}.\n\nBill copy attached.`;
      
      // Upload PDF
      const mediaId = await this.uploadMedia(pdfPath);
      
      // Send document with caption
      await this.sendDocument(to, mediaId, message);
      
      return { success: true, message: 'Bill sent successfully' };
    } catch (error) {
      console.error('Error sending bill:', error);
      throw error;
    }
  }
}

module.exports = new WhatsAppService();
