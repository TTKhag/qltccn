export type DebtKey = 'credit' | 'cash';
export type TxType = 'income' | 'expense' | 'repay';
export type Source = 'balance' | DebtKey;
export type Kind = 'regular' | 'incidental';

export const DEBT_LABEL: Record<DebtKey, string> = { credit: 'Nợ tín dụng/ngân hàng', cash: 'Nợ tiền mặt' };
export const SOURCE_LABEL: Record<Source, string> = { balance: 'Số dư', credit: 'Nợ tín dụng/ngân hàng', cash: 'Nợ tiền mặt' };
export const TYPE_LABEL: Record<TxType, string> = { income: 'Thu', expense: 'Chi', repay: 'Trả nợ' };

export interface TxFields {
  type: TxType;
  kind: Kind; // định kỳ / phát sinh (chỉ có ý nghĩa với thu, chi)
  date: string; // YYYY-MM-DD
  amount: number; // VND, số nguyên dương
  source?: Source; // chỉ với chi
  debt?: DebtKey; // chỉ với trả nợ
  category: string;
  content: string;
  note?: string;
}
export interface Tx extends TxFields { id: string; createdAt: number; fromPlanId?: string }
export interface Plan extends TxFields {
  id: string;
  createdAt: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  txId?: string;
}
export interface DebtConfig { rate: number; unit: 'month' | 'year'; start: string; end: string }
export interface DebtAdjustment { id: string; debt: DebtKey; date: string; delta: number; targetActual: number; reason: string; createdAt: number }
export interface BalanceAdjustment { id: string; date: string; delta: number; reason: string; createdAt: number }
export interface HistoryEntry { id: string; at: number; kind: string; debt?: DebtKey; description: string }

export interface AppData {
  schemaVersion: 1;
  initialBalance: number;
  debts: Record<DebtKey, DebtConfig>;
  transactions: Tx[];
  plans: Plan[];
  debtAdjustments: DebtAdjustment[];
  balanceAdjustments: BalanceAdjustment[];
  history: HistoryEntry[];
  categories: { income: string[]; expense: string[] };
}

export const SCHEMA_VERSION = 1 as const;

export function emptyData(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    initialBalance: 0,
    debts: {
      credit: { rate: 0, unit: 'year', start: '', end: '' },
      cash: { rate: 0, unit: 'year', start: '', end: '' },
    },
    transactions: [],
    plans: [],
    debtAdjustments: [],
    balanceAdjustments: [],
    history: [],
    categories: {
      income: ['Tiền lương', 'Tiền thưởng', 'Được tặng', 'Thu nhập ngoài', 'Khác'],
      expense: ['Ăn uống', 'Tiền điện', 'Tiền nước', 'Tiền nhà', 'Xăng xe', 'Mua đồ', 'Giặt giũ', 'Sửa xe', 'Khác'],
    },
  };
}
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
