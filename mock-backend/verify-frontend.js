const puppeteer = require('puppeteer');

(async () => {
    // Wait for the React app to start
    console.log('Waiting for React app to start...');
    await new Promise(r => setTimeout(r, 5000));

    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page1 = await browser.newPage();
        await page1.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

        // Wait for connection
        await page1.waitForFunction(() => document.body.innerText.includes('接続済み'));
        console.log('Page 1 connected');

        // Click create room
        const createBtn = await page1.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.find(b => b.textContent.includes('ルームを作成'));
        });
        if (createBtn) {
            await createBtn.click();
        } else {
            throw new Error('Create Room button not found');
        }

        // Wait for room to be created and get Room ID
        await page1.waitForFunction(() => document.body.innerText.includes('ルームID:'));

        const bodyText = await page1.evaluate(() => document.body.innerText);
        const match = bodyText.match(/ルームID: ([A-Z0-9]+)/);
        if (!match) {
            throw new Error('Room ID not found in page');
        }
        const roomId = match[1];
        console.log(`Room created: ${roomId}`);

        // Open second page
        const page2 = await browser.newPage();
        await page2.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
        await page2.waitForFunction(() => document.body.innerText.includes('接続済み'));
        console.log('Page 2 connected');

        // Join room
        const inputHandle = await page2.$('input[placeholder="ルームIDを入力"]');
        await inputHandle.type(roomId);

        const joinBtn = await page2.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.find(b => b.textContent.includes('ルームに参加'));
        });
        if (joinBtn) {
            await joinBtn.click();
        } else {
            throw new Error('Join Room button not found');
        }

        // Wait for join
        await page2.waitForFunction(() => document.body.innerText.includes('ルームID:'));
        console.log(`Page 2 joined room ${roomId}`);

        // Send message from page 2
        const msgInput = await page2.$('input[placeholder="チャット..."]');
        await msgInput.type('Hello from page 2!');
        await page2.keyboard.press('Enter');

        // Verify message received on page 1
        console.log('Waiting for message on page 1...');
        await page1.waitForFunction(() => document.body.innerText.includes('Hello from page 2!'));
        console.log('Message successfully received on page 1!');

        console.log('Integration test passed successfully.');

    } catch (err) {
        console.error('Test failed:', err);
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
})();
