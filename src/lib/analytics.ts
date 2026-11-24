export function monthlyReceipts(receipts: { amount: number | string; created_at: string; reversed_at?: string | null }[], months = 6, now = new Date()) {
  return Array.from({length:months},(_,index)=>{
    const date=new Date(now);date.setDate(1);date.setMonth(date.getMonth()-(months-1-index));
    const month=date.toLocaleDateString("sv-SE").slice(0,7);
    return {date:month+"-01",value:receipts.filter(receipt=>!receipt.reversed_at&&new Date(receipt.created_at).toLocaleDateString("sv-SE").startsWith(month)).reduce((sum,receipt)=>sum+Number(receipt.amount),0)};
  });
}
