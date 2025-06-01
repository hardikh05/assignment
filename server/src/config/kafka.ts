import { Kafka, Producer, Consumer } from 'kafkajs';

let producer: Producer | null = null;
let consumer: Consumer | null = null;

export function initializeKafka() {
  if (process.env.KAFKA_BROKERS) {
    console.log('Initializing Kafka with brokers:', process.env.KAFKA_BROKERS);
    const kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || 'mini-crm-server',
      brokers: [process.env.KAFKA_BROKERS],
      retry: {
        initialRetryTime: 100,
        retries: 3
      }
    });

    producer = kafka.producer();
    consumer = kafka.consumer({ groupId: process.env.KAFKA_GROUP_ID || 'mini-crm-group' });
    console.log('Kafka producer and consumer created');
    return true;
  } else {
    console.log('KAFKA_BROKERS not set, skipping Kafka initialization');
    return false;
  }
}

export { producer, consumer };

export async function setupKafka() {
  if (!process.env.KAFKA_BROKERS) {
    console.log('Kafka disabled - KAFKA_BROKERS not set');
    return;
  }

  if (!producer || !consumer) {
    console.log('Kafka not initialized - producer or consumer is null');
    return;
  }

  try {
    console.log('Connecting to Kafka...');
    await producer.connect();
    console.log('Producer connected');
    await consumer.connect();
    console.log('Consumer connected');
    
    // Subscribe to topics
    await consumer.subscribe({ topic: 'campaign-events', fromBeginning: true });
    await consumer.subscribe({ topic: 'customer-events', fromBeginning: true });
    console.log('Subscribed to topics');
    
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
    
    console.log('Connected to Kafka successfully');
  } catch (error) {
    console.error('Failed to connect to Kafka:', error);
    console.log('Continuing without Kafka...');
  }
} 