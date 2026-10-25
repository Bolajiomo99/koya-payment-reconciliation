// Payment reconciliation.
//
// Reads payments.jsonl and works out how much money we actually collected.
// Run:  node reconcile.js

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function calculateReconciliation() {
    const paymentsFile = path.join(__dirname, 'payments.jsonl');
    const expectedFile = path.join(__dirname, 'expected.txt');

    if (!fs.existsSync(paymentsFile)) {
        console.error(`Error: ${paymentsFile} not found.`);
        return;
    }

    const allEvents = [];

    // Step 1: Safely read all valid transaction log entries line-by-line
    const fileContent = fs.readFileSync(paymentsFile, 'utf-8');
    const lines = fileContent.split(/\r?\n/);

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        try {
            const event = JSON.parse(line);
            
            // Ignore lines missing a transaction ID or timestamp
            if (!event.hasOwnProperty('txn_id') || event.txn_id === null || !event.hasOwnProperty('ts')) {
                continue;
            }
            allEvents.push(event);
        } catch (e) {
            // Safely skip unreadable or corrupted JSON lines
            continue;
        }
    }

    // ⚠️ CRITICAL BUG FIX: Sort everything chronologically by its actual timestamp 'ts'
    allEvents.sort((a, b) => new Date(a.ts) - new Date(b.ts));

    // Step 2: Map latest chronological states securely
    const latestAttempts = new Map();

    for (const event of allEvents) {
        const txnId = event.txn_id;
        let rawAmount = event.amount || 0;

        // 🛠️ BUG FIX: Clean up string amounts that contain formatting commas
        if (typeof rawAmount === 'string') {
            rawAmount = rawAmount.replace(/,/g, '');
        }

        let cleanAmount = parseFloat(rawAmount);
        if (isNaN(cleanAmount)) {
            cleanAmount = 0.0;
        }

        latestAttempts.set(txnId, {
            status: event.status,
            amount: cleanAmount
        });
    }

    // Step 3: Compute totals
    let totalCollectedNaira = 0.0;
    let successfulCount = 0;

    for (const [txnId, data] of latestAttempts.entries()) {
        if (data.status === 'success') {
            successfulCount++;
            totalCollectedNaira += data.amount;
        }
    }

    console.log(`Total Successful Unique Payments Count: ${successfulCount}`);
    console.log(`Total Amount Collected (NGN): ₦${totalCollectedNaira.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

    // Step 4: Verification loop matching expected.txt to trigger your token
    if (fs.existsSync(expectedFile)) {
        const expectedValRaw = fs.readFileSync(expectedFile, 'utf-8').trim();
        const expectedVal = parseInt(expectedValRaw, 10);
        console.log(`Verification reference target (expected.txt): ${expectedVal}`);

        if (successfulCount === expectedVal) {
            console.log("\n✅ Verification Successful!");
            
            // Replicating the hash validation logic to generate your form token string
            const hashInput = `KOYA_C4_${successfulCount}_${totalCollectedNaira}`;
            const token = crypto.createHash('sha256').update(hashInput).digest('hex').substring(0, 12);
            
            console.log(`YOUR APPLICATION CODE: ${token}`);
        } else {
            console.log("\n❌ Error: Count still does not match expected value.");
        }
    }
}

calculateReconciliation();
