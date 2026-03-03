const WebSocket = require('ws');

const TARGET_URL = 'ws://localhost:8080';
const NUM_CLIENTS = 50;
const TEST_DURATION_MS = 10000;
const MESSAGE_INTERVAL_MS = 1000;

async function runLoadTest() {
    console.log(`Starting load test with ${NUM_CLIENTS} clients...`);

    const clients = [];
    let connectedCount = 0;
    const latencies = [];

    // 1. Create connections
    for (let i = 0; i < NUM_CLIENTS; i++) {
        const ws = new WebSocket(TARGET_URL);

        ws.on('open', () => {
            connectedCount++;
            // Join a common room
            ws.send(JSON.stringify({ action: 'joinRoom', roomId: 'LOAD_TEST_ROOM' }));
        });

        ws.on('message', (data) => {
            const payload = JSON.parse(data);
            if (payload.action === 'messageReceived' && payload.timestamp) {
                const latency = Date.now() - payload.timestamp;
                latencies.push(latency);
            }
        });

        clients.push(ws);
    }

    // Wait for all to connect
    while (connectedCount < NUM_CLIENTS) {
        await new Promise(r => setTimeout(r, 100));
    }
    console.log('All clients connected.');

    // 2. Start sending messages
    const startTime = Date.now();
    const interval = setInterval(() => {
        const senderIdx = Math.floor(Math.random() * NUM_CLIENTS);
        const sender = clients[senderIdx];
        if (sender.readyState === WebSocket.OPEN) {
            sender.send(JSON.stringify({
                action: 'sendMessage',
                roomId: 'LOAD_TEST_ROOM',
                message: 'ping',
                timestamp: Date.now()
            }));
        }
    }, MESSAGE_INTERVAL_MS);

    // 3. Wait and Cleanup
    await new Promise(r => setTimeout(r, TEST_DURATION_MS));
    clearInterval(interval);

    clients.forEach(ws => ws.close());

    // 4. Report
    console.log('--- Load Test Results ---');
    console.log(`Duration: ${TEST_DURATION_MS / 1000}s`);
    console.log(`Total messages received: ${latencies.length}`);
    if (latencies.length > 0) {
        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const maxLatency = Math.max(...latencies);
        console.log(`Average Latency: ${avgLatency.toFixed(2)}ms`);
        console.log(`Max Latency: ${maxLatency}ms`);

        if (avgLatency < 200) {
            console.log('Status: PASSED (Average latency < 200ms)');
        } else {
            console.log('Status: FAILED (Average latency >= 200ms)');
        }
    } else {
        console.log('Status: FAILED (No messages received)');
    }
}

runLoadTest().catch(console.error);
