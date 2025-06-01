// Dummy Vendor API Service for simulating message delivery

export interface VendorMessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

class VendorApiService {
  private static instance: VendorApiService;

  private constructor() {}

  public static getInstance(): VendorApiService {
    if (!VendorApiService.instance) {
      VendorApiService.instance = new VendorApiService();
    }
    return VendorApiService.instance;
  }

  public async sendMessage(to: string, message: string): Promise<VendorMessageResponse> {
    // Simulate random network/API delay (500ms to 2000ms)
    const delay = Math.floor(Math.random() * 1500) + 500;
    await new Promise(resolve => setTimeout(resolve, delay));

    // Simulate 90% success, 10% failure
    const success = Math.random() < 0.9;
    if (success) {
      return {
        success: true,
        messageId: Math.random().toString(36).substring(2, 10)
      };
    } else {
      return {
        success: false,
        error: 'Failed to deliver message'
      };
    }
  }
}

const vendorApi = VendorApiService.getInstance();
export default vendorApi;
