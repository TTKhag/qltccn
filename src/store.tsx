import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppData, emptyData } from './lib/types';
import { compute, State } from './lib/engine';
import { loadData, saveData } from './lib/storage';
import { Result } from './lib/ops';
import { todayStr } from './lib/dates';

interface Toast { id: number; msg: string; kind: 'ok' | 'err' }
interface Ctx {
  data: AppData;
  state: State;
  today: string;
  /** Chạy một thao tác; nếu hợp lệ thì lưu ngay vào IndexedDB. Trả về true nếu thành công. */
  run: (fn: (d: AppData) => Result, okMsg?: string) => boolean;
  replaceAll: (d: AppData, msg: string) => void;
  notify: (msg: string, kind?: 'ok' | 'err') => void;
  toasts: Toast[];
}
const C = createContext<Ctx>(null as unknown as Ctx);
export const useStore = () => useContext(C);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const ref = useRef<AppData>(emptyData());
  const today = todayStr();

  const notify = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'err' ? 6000 : 3000);
  }, []);

  useEffect(() => {
    loadData()
      .then((d) => { const v = d ?? emptyData(); ref.current = v; setData(v); })
      .catch(() => { notify('Không mở được IndexedDB. Dữ liệu sẽ không được lưu trong phiên này.', 'err'); setData(emptyData()); });
  }, [notify]);

  const persist = useCallback((d: AppData) => {
    ref.current = d;
    setData(d);
    saveData(d).catch(() => notify('Không lưu được dữ liệu vào trình duyệt.', 'err'));
  }, [notify]);

  const run = useCallback((fn: (d: AppData) => Result, okMsg?: string) => {
    const r = fn(ref.current);
    if (!r.ok) { notify(r.error, 'err'); return false; }
    persist(r.data);
    if (okMsg) notify(okMsg);
    return true;
  }, [notify, persist]);

  const replaceAll = useCallback((d: AppData, msg: string) => { persist(d); notify(msg); }, [notify, persist]);

  const state = useMemo(() => compute(data ?? emptyData(), today), [data, today]);
  if (!data) return <div className="boot">Đang tải dữ liệu…</div>;
  return <C.Provider value={{ data, state, today, run, replaceAll, notify, toasts }}>{children}</C.Provider>;
}
