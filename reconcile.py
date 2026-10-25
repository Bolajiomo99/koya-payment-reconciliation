#!/usr/bin/env python3
"""Payment reconciliation.

Reads payments.jsonl and works out how much money we actually collected.
Run:  python3 reconcile.py
"""
import json
import os

def calculate_reconciliation():
    payments_file = "payments.jsonl"
    expected_file = "expected.txt"
    
    if not os.path.exists(payments_file):
        print(f"Error: {payments_file} not found.")
        return

    all_events = []

    # Step 1: Safely read all valid transaction log entries
    with open(payments_file, "r", encoding="utf-8") as file:
        for line in file:
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
                # Ignore lines missing a transaction ID or structural fields
                if "txn_id" not in event or event["txn_id"] is None or "ts" not in event:
                    continue
                all_events.append(event)
            except (json.JSONDecodeError, ValueError, TypeError):
                continue

    # Sort everything chronologically by its actual timestamp 'ts'
    all_events.sort(key=lambda x: x["ts"])

    # Step 2: Map latest chronological states securely
    latest_attempts = {}
    for event in all_events:
        txn_id = event["txn_id"]
        
        # 🛠️ BUG FIX: Sanitize amount strings containing commas before parsing
        raw_amount = event.get("amount", 0)
        if isinstance(raw_amount, str):
            raw_amount = raw_amount.replace(",", "")
        
        try:
            clean_amount = float(raw_amount)
        except (ValueError, TypeError):
            clean_amount = 0.0

        latest_attempts[txn_id] = {
            "status": event.get("status"),
            "amount": clean_amount
        }

    # Step 3: Compute totals
    total_collected_naira = 0.0
    successful_count = 0

    for txn_id, data in latest_attempts.items():
        if data["status"] == "success":
            successful_count += 1
            total_collected_naira += data["amount"]

    print(f"Total Successful Unique Payments Count: {successful_count}")
    print(f"Total Amount Collected (NGN): ₦{total_collected_naira:,.2f}")

    # Step 4: Verification loop triggering your validation code string output
    if os.path.exists(expected_file):
        with open(expected_file, "r") as exp_f:
            expected_val = int(exp_f.read().strip())
            print(f"Verification reference target (expected.txt): {expected_val}")
            
            if successful_count == expected_val:
                print("\n✅ Verification Successful!")
                # Generating validation hash block
                import hashlib
                token = hashlib.sha256(f"KOYA_C4_{successful_count}_{total_collected_naira}".encode()).hexdigest()[:12]
                print(f"YOUR APPLICATION CODE: {token}")
            else:
                print("\n❌ Error: Count still does not match expected value.")

if __name__ == "__main__":
    calculate_reconciliation()
