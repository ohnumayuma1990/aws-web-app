
async function sendMessageToClient(cid) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 50));
    return `Sent to ${cid}`;
}

const connections = Array.from({ length: 10 }, (_, i) => ({ SK: `CONN#user${i}` }));

async function runSequential() {
    const start = Date.now();
    for (const conn of connections) {
        const cid = conn.SK.replace('CONN#', '');
        await sendMessageToClient(cid);
    }
    const end = Date.now();
    return end - start;
}

async function runParallel() {
    const start = Date.now();
    await Promise.all(connections.map(conn => {
        const cid = conn.SK.replace('CONN#', '');
        return sendMessageToClient(cid);
    }));
    const end = Date.now();
    return end - start;
}

async function main() {
    console.log("Starting benchmark...");
    const seqTime = await runSequential();
    console.log(`Sequential time: ${seqTime}ms`);
    const parTime = await runParallel();
    console.log(`Parallel time: ${parTime}ms`);
    console.log(`Improvement: ${((seqTime - parTime) / seqTime * 100).toFixed(2)}%`);
}

main();
