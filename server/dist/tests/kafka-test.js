"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const kafkajs_1 = require("kafkajs");
const kafka = new kafkajs_1.Kafka({
    clientId: 'test-client',
    brokers: ['localhost:9092'],
});
const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'test-group' });
async function runTest() {
    try {
        // Connect to Kafka
        await producer.connect();
        await consumer.connect();
        // Subscribe to test topic
        await consumer.subscribe({ topic: 'test-topic', fromBeginning: true });
        // Start consuming messages
        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                var _a;
                console.log('Received message:', {
                    topic,
                    partition,
                    value: (_a = message.value) === null || _a === void 0 ? void 0 : _a.toString(),
                });
            },
        });
        // Send a test message
        await producer.send({
            topic: 'test-topic',
            messages: [
                { value: 'Hello Kafka!' },
            ],
        });
        console.log('Test message sent successfully');
        // Wait for a moment to receive the message
        await new Promise(resolve => setTimeout(resolve, 5000));
        // Disconnect
        await producer.disconnect();
        await consumer.disconnect();
    }
    catch (error) {
        console.error('Error:', error);
    }
}
runTest();
