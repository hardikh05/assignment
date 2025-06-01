"use strict";
// Dummy Vendor API Service for simulating message delivery
Object.defineProperty(exports, "__esModule", { value: true });
class VendorApiService {
    constructor() { }
    static getInstance() {
        if (!VendorApiService.instance) {
            VendorApiService.instance = new VendorApiService();
        }
        return VendorApiService.instance;
    }
    async sendMessage(to, message) {
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
        }
        else {
            return {
                success: false,
                error: 'Failed to deliver message'
            };
        }
    }
}
const vendorApi = VendorApiService.getInstance();
exports.default = vendorApi;
