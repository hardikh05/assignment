import { Kafka, Producer, Consumer } from 'kafkajs';

const kafka = new Kafka({
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
        console.log('Received message:', {
          topic,
          partition,
          value: message.value?.toString(),
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
  } catch (error) {
    console.error('Error:', error);
  }
}

runTest(); 