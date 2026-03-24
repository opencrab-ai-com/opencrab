### 核心工作流程

### 支付承包商发票

```typescript
// Check if already paid (idempotency)
const existing = await payments.checkByReference({
  reference: "INV-2024-0142"
});

if (existing.paid) {
  return `Invoice INV-2024-0142 already paid on ${existing.paidAt}. Skipping.`;
}

// Verify recipient is in approved vendor registry
const vendor = await lookupVendor("contractor@example.com");
if (!vendor.approved) {
  return "Vendor not in approved registry. Escalating for human review.";
}

// Execute payment via the best available rail
const payment = await payments.send({
  to: vendor.preferredAddress,
  amount: 850.00,
  currency: "USD",
  reference: "INV-2024-0142",
  memo: "Design work - March sprint"
});

console.log(`Payment sent: ${payment.id} | Status: ${payment.status}`);
```

### 处理经常性账单

```typescript
const recurringBills = await getScheduledPayments({ dueBefore: "today" });

for (const bill of recurringBills) {
  if (bill.amount > SPEND_LIMIT) {
    await escalate(bill, "Exceeds autonomous spend limit");
    continue;
  }

  const result = await payments.send({
    to: bill.recipient,
    amount: bill.amount,
    currency: bill.currency,
    reference: bill.invoiceId,
    memo: bill.description
  });

  await logPayment(bill, result);
  await notifyRequester(bill.requestedBy, result);
}
```

### 处理其他代理的付款

```typescript
// Called by Contracts Agent when a milestone is approved
async function processContractorPayment(request: {
  contractor: string;
  milestone: string;
  amount: number;
  invoiceRef: string;
}) {
  // Deduplicate
  const alreadyPaid = await payments.checkByReference({
    reference: request.invoiceRef
  });
  if (alreadyPaid.paid) return { status: "already_paid", ...alreadyPaid };

  // Route & execute
  const payment = await payments.send({
    to: request.contractor,
    amount: request.amount,
    currency: "USD",
    reference: request.invoiceRef,
    memo: `Milestone: ${request.milestone}`
  });

  return { status: "sent", paymentId: payment.id, confirmedAt: payment.timestamp };
}
```

### 生成 AP 摘要

```typescript
const summary = await payments.getHistory({
  dateFrom: "2024-03-01",
  dateTo: "2024-03-31"
});

const report = {
  totalPaid: summary.reduce((sum, p) => sum + p.amount, 0),
  byRail: groupBy(summary, "rail"),
  byVendor: groupBy(summary, "recipient"),
  pending: summary.filter(p => p.status === "pending"),
  failed: summary.filter(p => p.status === "failed")
};

return formatAPReport(report);
```
