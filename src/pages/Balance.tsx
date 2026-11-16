import { useState } from 'react';
import { useStore } from '../store';
import { Card, Empty, Field, MoneyInput, Stat } from '../components/ui';
import { fmt } from '../lib/format';
import { fmtDate } from '../lib/dates';
import * as ops from '../lib/ops';

export default function Balance() {
  const { data, state, run } = useStore();
  const [init, setInit] = useState(data.initialBalance);
  const [target, setTarget] = useState(state.balance);
  const [reason, setReason] = useState('');
  const hist = data.history.filter((h) => h.kind === 'adjust-balance' || h.kind === 'initial-balance').sort((a, b) => b.at - a.at);
  const series = [...state.series].reverse().slice(0, 60);
  return (
    <div className="stack-lg">
      <Card title="Số dư hiện tại">
        <div className="grid-stats sm">
          <Stat label="Dư hiện tại" value={state.balance} tone="balance" size="lg" />
          <Stat label="Tổng thu" value={state.totalIncome} tone="income" />
          <Stat label="Chi từ số dư" value={state.totalSpendBalance} tone="expense" />
          <Stat label="Đã trả nợ" value={state.totalRepaid} tone="debt" />
        </div>
        <p className="muted">Dư hiện tại = dư ban đầu + tổng thu − chi từ số dư − tiền trả nợ (± điều chỉnh có lý do). Chi bằng nguồn nợ không làm giảm số dư.</p>
      </Card>
      <div className="grid-2">
        <Card title="Dư ban đầu">
          <Field label="Dư ban đầu (₫)" hint="Số tiền bạn đang có trước giao dịch đầu tiên."><MoneyInput value={init} onChange={setInit} /></Field>
          <button className="btn primary" disabled={init === data.initialBalance} onClick={() => run((d) => ops.setInitialBalance(d, init), 'Đã lưu dư ban đầu.')}>Lưu dư ban đầu</button>
        </Card>
        <Card title="Điều chỉnh số dư">
          <Field label="Số dư mới (₫)"><MoneyInput value={target} onChange={setTarget} /></Field>
          <Field label="Lý do (bắt buộc)"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ví dụ: đối chiếu với ví thực tế" /></Field>
          <button className="btn primary" onClick={() => { if (run((d) => ops.adjustBalance(d, target, reason), 'Đã điều chỉnh số dư.')) setReason(''); }}>Điều chỉnh</button>
        </Card>
      </div>
      <Card title="Lịch sử điều chỉnh">
        {hist.length === 0 ? <Empty>Chưa có điều chỉnh nào.</Empty> : <ul className="log">{hist.map((h) => <li key={h.id}><b>{new Date(h.at).toLocaleString('vi-VN')}</b> {h.description}</li>)}</ul>}
      </Card>
      <Card title="Số dư theo từng ngày có biến động (60 ngày gần nhất)">
        {series.length === 0 ? <Empty>Chưa có biến động.</Empty> : <div className="table-wrap"><table><thead><tr><th>Ngày</th><th className="r">Số dư cuối ngày</th></tr></thead><tbody>{series.map((p) => <tr key={p.date}><td>{fmtDate(p.date)}</td><td className="r num">{fmt(p.balance)}</td></tr>)}</tbody></table></div>}
      </Card>
    </div>
  );
}
