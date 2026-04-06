import { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy, limit, Timestamp } from 'firebase/firestore';
import { Order, OrderStatus, UserProfile } from '../types';
import { CheckCircle2, Clock, Play, Check, Coffee, UserCheck, AlertCircle, ShoppingCart, History, Download, Calendar, Filter, ListChecks, StickyNote } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import POS from './POS';
import * as XLSX from 'xlsx';
import { translations } from '../translations';

export default function Barista({ user, language }: { user: UserProfile, language: 'en' | 'vi' }) {
  const t = translations[language];
  const [orders, setOrders] = useState<Order[]>([]);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [view, setView] = useState<'orders' | 'summary' | 'history'>('orders');
  const [historyFilter, setHistoryFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount).replace('₫', 'đ');
  };

  useEffect(() => {
    if (!auth.currentUser) return;

    const path = 'orders';
    const q = query(
      collection(db, path),
      where('status', 'in', ['pending', 'preparing', 'ready']),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(ords);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    const qHistory = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(500));
    const unsubHistory = onSnapshot(qHistory, (snapshot) => {
      setHistoryOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    return () => {
      unsubscribe();
      unsubHistory();
    };
  }, [user]);

  const filteredHistory = historyOrders.filter(order => {
    if (!order.createdAt) return false;
    const orderDate = order.createdAt.toDate();
    const now = new Date();
    
    if (historyFilter === 'today') {
      return orderDate.toDateString() === now.toDateString();
    }
    if (historyFilter === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      return orderDate >= weekAgo;
    }
    if (historyFilter === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(now.getMonth() - 1);
      return orderDate >= monthAgo;
    }
    return true;
  });

  const exportToExcel = () => {
    const data = filteredHistory.map(o => ({
      [t.barista.history.table.order]: o.orderNumber,
      [t.barista.history.table.date]: o.createdAt?.toDate().toLocaleString(),
      [t.barista.history.table.table]: o.tableNumber,
      [t.barista.history.table.items]: o.items.map(i => `${i.quantity}x ${i.name}`).join(', '),
      [t.barista.history.table.total]: o.totalAmount,
      [t.barista.history.table.status]: o.status,
      [t.barista.history.table.staff]: o.createdByName,
      [t.barista.history.table.paid]: o.paid ? (language === 'en' ? 'Yes' : 'Có') : (language === 'en' ? 'No' : 'Không')
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");
    XLSX.writeFile(workbook, `Barista_History_${historyFilter}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const updateStatus = async (orderId: string, status: OrderStatus) => {
    const path = `orders/${orderId}`;
    try {
      const order = orders.find(o => o.id === orderId);
      const historyEntry = {
        action: `Status updated to ${status}`,
        timestamp: Timestamp.now(),
        user: user.displayName || 'Unknown'
      };
      const newHistory = [...(order?.history || []), historyEntry];
      
      const updateData: any = { 
        status,
        history: newHistory
      };

      if (status === 'ready') {
        updateData.items = order.items.map(item => ({ ...item, done: true }));
      }

      await updateDoc(doc(db, 'orders', orderId), updateData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const updateItemStatus = async (orderId: string, itemIndex: number, done: boolean) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const updatedItems = [...order.items];
    updatedItems[itemIndex] = { ...updatedItems[itemIndex], done };

    // Auto-update order status if all items are done
    const allDone = updatedItems.every(i => i.done);
    const newStatus = allDone ? 'ready' : (order.status === 'pending' ? 'preparing' : order.status);

    const historyEntry = {
      action: `${updatedItems[itemIndex].name} marked as ${done ? 'done' : 'pending'}`,
      timestamp: Timestamp.now(),
      user: user.displayName || 'Unknown'
    };
    const newHistory = [...(order.history || []), historyEntry];

    const path = `orders/${orderId}`;
    try {
      await updateDoc(doc(db, 'orders', orderId), { 
        items: updatedItems,
        status: newStatus,
        history: newHistory
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const markItemTypeDone = async (itemKey: string) => {
    const ordersToUpdate = orders.filter(o => 
      (o.status === 'pending' || o.status === 'preparing') && 
      o.items.some(i => `${i.name} (${formatCurrency(i.price)})` === itemKey && !i.done)
    );

    const historyEntry = {
      action: `All ${itemKey} marked as done`,
      timestamp: Timestamp.now(),
      user: user.displayName || 'Unknown'
    };

    for (const order of ordersToUpdate) {
      const updatedItems = order.items.map(i => 
        `${i.name} (${formatCurrency(i.price)})` === itemKey ? { ...i, done: true } : i
      );
      
      const allDone = updatedItems.every(i => i.done);
      const newStatus = allDone ? 'ready' : (order.status === 'pending' ? 'preparing' : order.status);
      const newHistory = [...(order.history || []), historyEntry];

      const path = `orders/${order.id}`;
      try {
        await updateDoc(doc(db, 'orders', order.id), { 
          items: updatedItems,
          status: newStatus,
          history: newHistory
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }
  };

  // Group items for the summary view
  const itemSummary = orders
    .filter(o => o.status === 'pending' || o.status === 'preparing')
    .reduce((acc, order) => {
      order.items.forEach(item => {
        if (!item.done) {
          const key = `${item.name} (${formatCurrency(item.price)})`;
          acc[key] = (acc[key] || 0) + item.quantity;
        }
      });
      return acc;
    }, {} as Record<string, number>);

  const sortedOrders = [...orders].sort((a, b) => {
    const priorityMap = { high: 0, medium: 1, low: 2 };
    if (priorityMap[a.priority] !== priorityMap[b.priority]) {
      return priorityMap[a.priority] - priorityMap[b.priority];
    }
    return a.createdAt?.seconds - b.createdAt?.seconds;
  });

  const filterLabels = {
    today: language === 'en' ? 'Today' : 'Hôm nay',
    week: language === 'en' ? 'Week' : 'Tuần',
    month: language === 'en' ? 'Month' : 'Tháng',
    all: language === 'en' ? 'All' : 'Tất cả'
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300">
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-lg">
            <Coffee className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.barista.title}</h1>
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl transition-colors duration-300">
          {[
            { id: 'orders', label: `${t.barista.tabs.orders} (${orders.length})` },
            { id: 'summary', label: t.barista.tabs.summary },
            { id: 'history', label: t.barista.tabs.history }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id as any)}
              className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                view === tab.id ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300'
              }`}
            >
              {view === tab.id && (
                <motion.div
                  layoutId="activeBaristaView"
                  className="absolute inset-0 bg-white dark:bg-slate-700 rounded-lg shadow-sm"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {view === 'history' && (
          <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors duration-300">
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                {(['today', 'week', 'month', 'all'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setHistoryFilter(f)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                      historyFilter === f ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600'
                    }`}
                  >
                    {filterLabels[f]}
                  </button>
                ))}
              </div>
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-green-100 dark:shadow-none"
              >
                <Download className="w-4 h-4" /> {t.barista.history.export}
              </button>
            </div>

            <div className="space-y-4">
              {filteredHistory.map(order => (
                <div key={order.id} className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col gap-4 transition-colors duration-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col items-center justify-center min-w-[64px] h-16 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl">
                        <span className="text-[10px] font-bold uppercase opacity-50">{t.barista.history.table.order}</span>
                        <span className="text-xl font-black">#{order.orderNumber}</span>
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {order.items.map(i => `${i.quantity}x ${i.name} (${formatCurrency(i.price)})`).join(', ')}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 mt-1">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {order.createdAt?.toDate().toLocaleDateString()}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {order.createdAt?.toDate().toLocaleTimeString()}</span>
                          <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded text-xs font-bold">{t.barista.orderCard.table} {order.tableNumber}</span>
                          <span>{language === 'en' ? 'Taken by' : 'Người nhận'}: <span className="font-bold text-indigo-600 dark:text-indigo-400">{order.createdByName}</span></span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-slate-900 dark:text-white">
                        {formatCurrency(order.totalAmount)}
                      </div>
                      <div className={`text-[10px] font-bold uppercase tracking-widest ${order.paid ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {order.paid ? (language === 'en' ? 'Paid' : 'Đã thanh toán') : (language === 'en' ? 'Unpaid' : 'Chưa thanh toán')} • {order.status}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {filteredHistory.length === 0 && (
                <div className="text-center py-20 text-slate-300 dark:text-slate-700 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 transition-colors duration-300">
                  <Filter className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="text-xl font-medium">{t.barista.history.noOrders}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {view !== 'history' && (
          <div className="p-6">
            {view === 'orders' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                  {sortedOrders.map(order => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={order.id}
                      className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border-l-8 overflow-hidden flex flex-col transition-colors duration-300 ${
                        order.priority === 'high' ? 'border-red-500' :
                        order.priority === 'medium' ? 'border-amber-500' : 'border-indigo-500'
                      }`}
                    >
                      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start transition-colors duration-300">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="bg-slate-900 dark:bg-slate-800 text-white px-2 py-0.5 rounded text-sm font-bold">#{order.orderNumber}</span>
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t.barista.orderCard.table}</span>
                            <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded text-sm font-bold">{order.tableNumber}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                            <Clock className="w-3 h-3" />
                            {order.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${
                          order.status === 'pending' ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' :
                          order.status === 'preparing' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        }`}>
                          {order.status}
                        </div>
                      </div>

                      <div className="flex-1 p-4 space-y-3">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => updateItemStatus(order.id, idx, !item.done)}
                                className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                  item.done 
                                    ? 'bg-green-500 border-green-500 text-white' 
                                    : 'border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400'
                                }`}
                              >
                                {item.done && <Check className="w-3 h-3" />}
                              </button>
                              <span className={`font-medium ${item.done ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-300'}`}>
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold mr-2">{item.quantity}x</span>
                                {item.name}
                                <span className="ml-2 text-xs text-slate-400 dark:text-slate-500 font-normal">({formatCurrency(item.price)})</span>
                              </span>
                            </div>
                            {item.note && (
                              <div className="ml-8 mt-1 p-2 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 rounded-r-lg flex items-start gap-2">
                                <StickyNote className="w-3 h-3 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                                <span className="text-xs font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wide">
                                  {item.note}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex gap-2 transition-colors duration-300">
                        {order.status === 'pending' && (
                          <button
                            onClick={() => updateStatus(order.id, 'preparing')}
                            className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
                          >
                            <Play className="w-4 h-4" /> {t.barista.orderCard.start}
                          </button>
                        )}
                        {order.status === 'preparing' && (
                          <button
                            onClick={() => updateStatus(order.id, 'ready')}
                            className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
                          >
                            <Check className="w-4 h-4" /> {t.barista.orderCard.ready}
                          </button>
                        )}
                        {order.status === 'ready' && (
                          <button
                            onClick={() => updateStatus(order.id, 'delivered')}
                            className="flex-1 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
                          >
                            <UserCheck className="w-4 h-4" /> {t.barista.orderCard.delivered}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {orders.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-300 dark:text-slate-700">
                    <CheckCircle2 className="w-16 h-16 mb-4" />
                    <p className="text-xl font-medium">{t.barista.orderCard.completed}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden transition-colors duration-300">
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-indigo-600 text-white">
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <AlertCircle className="w-6 h-6" />
                    {t.barista.summary.title}
                  </h2>
                  <p className="text-indigo-100 mt-1">{t.barista.summary.subtitle}</p>
                </div>
                <div className="p-8 space-y-4">
                  {Object.entries(itemSummary).length > 0 ? (
                    Object.entries(itemSummary).map(([name, qty]) => (
                      <div key={name} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors duration-300">
                        <div className="flex flex-col">
                          <span className="text-lg font-semibold text-slate-800 dark:text-slate-200">{name}</span>
                          <span className="text-sm text-slate-500 dark:text-slate-400">{language === 'en' ? 'Total' : 'Tổng'}: {qty} {language === 'en' ? 'units' : 'đơn vị'}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => markItemTypeDone(name)}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-sm"
                          >
                            <CheckCircle2 className="w-4 h-4" /> {t.barista.summary.markAllDone}
                          </button>
                          <span className="w-12 h-12 flex items-center justify-center bg-indigo-600 text-white rounded-full font-bold text-xl shadow-lg shadow-indigo-200 dark:shadow-none">
                            {qty}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-slate-400 dark:text-slate-600">
                      <p>{t.barista.summary.noItems}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
