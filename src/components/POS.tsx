import { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, orderBy, Timestamp, runTransaction, limit } from 'firebase/firestore';
import { Product, OrderItem, OrderStatus, OrderPriority, UserProfile, Order, Category } from '../types';
import { ShoppingCart, Plus, Minus, Trash2, Send, Coffee, CupSoda, Cake, Utensils, ListChecks, Clock, CheckCircle2, DollarSign, Edit2, Search, X, ChevronDown, Filter, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { translations } from '../translations';

export default function POS({ user, language }: { user: UserProfile, language: 'en' | 'vi' }) {
  const t = translations[language];
  const [activeTab, setActiveTab] = useState<'menu' | 'orders'>('menu');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [tableNumber, setTableNumber] = useState('');
  const [priority, setPriority] = useState<OrderPriority>('low');
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [selectingProduct, setSelectingProduct] = useState<Product | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount).replace('₫', 'đ');
  };

  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(collection(db, 'products'), where('available', '==', true));
    const unsubProducts = onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      // Ensure unique IDs
      const uniqueProds = Array.from(new Map(prods.map(p => [p.id, p])).values());
      setProducts(uniqueProds);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    const qOrders = query(collection(db, 'orders'), where('paid', '==', false), orderBy('createdAt', 'desc'));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const ords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      // Ensure unique IDs
      const uniqueOrds = Array.from(new Map(ords.map(o => [o.id, o])).values());
      setOrders(uniqueOrds);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    const unsubCats = onSnapshot(query(collection(db, 'categories'), orderBy('order', 'asc')), (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      // Ensure unique IDs
      const uniqueCats = Array.from(new Map(cats.map(c => [c.id, c])).values());
      setCategories(uniqueCats);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    });

    return () => {
      unsubProducts();
      unsubOrders();
      unsubCats();
    };
  }, [user]);

  const addToCart = (product: Product, selectedPrice?: number) => {
    const price = selectedPrice !== undefined ? selectedPrice : (Array.isArray(product.price) ? null : product.price);
    
    if (price === null) {
      setSelectingProduct(product);
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id && item.price === price);
      if (existing) {
        return prev.map(item => (item.productId === product.id && item.price === price) ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { productId: product.id, name: product.name, price, quantity: 1, done: false }];
    });
    setSelectingProduct(null);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const placeOrder = async () => {
    if (cart.length === 0 || !tableNumber) return;
    setSubmitting(true);
    
    const today = new Date().toISOString().split('T')[0];
    const counterRef = doc(db, 'counters', `orders_${today}`);
    
    try {
      const historyEntry = {
        action: editingOrderId ? 'Order Updated' : 'Order Placed',
        timestamp: Timestamp.now(),
        user: user.displayName || 'Unknown'
      };

      if (editingOrderId) {
        const order = orders.find(o => o.id === editingOrderId);
        const newHistory = [...(order?.history || []), historyEntry];
        await updateDoc(doc(db, 'orders', editingOrderId), {
          items: cart,
          tableNumber,
          priority,
          totalAmount: total,
          status: 'pending',
          history: newHistory
        });
      } else {
        await runTransaction(db, async (transaction) => {
          const counterDoc = await transaction.get(counterRef);
          let nextNumber = 1;
          
          if (counterDoc.exists()) {
            nextNumber = counterDoc.data().count + 1;
            transaction.update(counterRef, { count: nextNumber });
          } else {
            transaction.set(counterRef, { count: 1 });
          }

          const orderRef = doc(collection(db, 'orders'));
          transaction.set(orderRef, {
            items: cart,
            status: 'pending' as OrderStatus,
            tableNumber,
            priority,
            totalAmount: total,
            createdAt: Timestamp.now(),
            createdBy: user.uid,
            createdByName: user.displayName || 'Unknown',
            paid: false,
            orderNumber: nextNumber,
            history: [historyEntry]
          });
        });
      }
      setCart([]);
      setTableNumber('');
      setPriority('low');
      setEditingOrderId(null);
      setActiveTab('orders');
    } catch (error) {
      handleFirestoreError(error, editingOrderId ? OperationType.UPDATE : OperationType.CREATE, editingOrderId ? `orders/${editingOrderId}` : 'orders');
    } finally {
      setSubmitting(false);
    }
  };

  const editOrder = (order: Order) => {
    setCart(order.items);
    setTableNumber(order.tableNumber);
    setPriority(order.priority);
    setEditingOrderId(order.id);
    setActiveTab('menu');
  };

  const cancelEdit = () => {
    setCart([]);
    setTableNumber('');
    setPriority('low');
    setEditingOrderId(null);
  };

  const markPaid = async (orderId: string) => {
    const path = `orders/${orderId}`;
    try {
      const order = orders.find(o => o.id === orderId);
      const historyEntry = {
        action: 'Payment Collected',
        timestamp: Timestamp.now(),
        user: user.displayName || 'Unknown'
      };
      const newHistory = [...(order?.history || []), historyEntry];
      await updateDoc(doc(db, 'orders', orderId), { 
        paid: true,
        history: newHistory
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesCategory = category === 'All' || p.category === categories.find(c => c.id === category)?.name || p.category === category;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const displayCategories = [
    { id: 'All', label: t.pos.categories.all },
    ...categories.map(cat => ({ id: cat.id, label: cat.name }))
  ];

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-amber-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300">
      {/* Product Section */}
      <div className="flex-1 flex flex-col p-6 relative z-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div className="flex bg-white dark:bg-slate-900 p-1 rounded-2xl shadow-sm border border-amber-100 dark:border-slate-800 transition-colors duration-300">
            <button
              onClick={() => setActiveTab('menu')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 relative overflow-hidden group ${
                activeTab === 'menu' 
                  ? 'bg-amber-700 text-white shadow-lg shadow-amber-200 dark:shadow-none' 
                  : 'text-amber-700 dark:text-amber-500 hover:bg-amber-50 dark:hover:bg-slate-800'
              }`}
            >
              <Utensils className={`w-4 h-4 transition-transform duration-300 ${activeTab === 'menu' ? 'scale-110' : 'group-hover:scale-110'}`} /> 
              {t.pos.menu}
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 relative overflow-hidden group ${
                activeTab === 'orders' 
                  ? 'bg-amber-700 text-white shadow-lg shadow-amber-200 dark:shadow-none' 
                  : 'text-amber-700 dark:text-amber-500 hover:bg-amber-50 dark:hover:bg-slate-800'
              }`}
            >
              <ListChecks className={`w-4 h-4 transition-transform duration-300 ${activeTab === 'orders' ? 'scale-110' : 'group-hover:scale-110'}`} /> 
              {t.barista.tabs.orders} ({orders.length})
            </button>
          </div>
          
          {activeTab === 'menu' && (
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={t.pos.search}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-amber-100 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none dark:text-white transition-all"
                />
              </div>
              <div className="relative">
                <button 
                  onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-amber-100 dark:border-slate-800 rounded-xl text-sm font-bold text-amber-800 dark:text-amber-500 transition-all hover:bg-amber-50 dark:hover:bg-slate-800 shadow-sm"
                >
                  <Filter className="w-4 h-4" />
                  <span>{displayCategories.find(c => c.id === category)?.label || t.pos.categories.all}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                
                <AnimatePresence>
                  {isCategoryDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIsCategoryDropdownOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 sm:left-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-amber-100 dark:border-slate-800 rounded-2xl shadow-xl z-20 overflow-hidden"
                      >
                        <div className="p-2 max-h-64 overflow-y-auto custom-scrollbar">
                          {displayCategories.map(cat => (
                            <button
                              key={cat.id}
                              onClick={() => {
                                setCategory(cat.id);
                                setIsCategoryDropdownOpen(false);
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                                category === cat.id 
                                  ? 'bg-amber-700 text-white shadow-md' 
                                  : 'text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-slate-800'
                              }`}
                            >
                              {cat.label}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>

        {activeTab === 'menu' ? (
            <AnimatePresence mode="wait">
              <motion.div 
                key={category + searchQuery}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 overflow-y-auto pr-2 pb-20"
              >
                {filteredProducts.map(product => (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all text-left flex flex-col justify-between group h-44 border border-amber-100 dark:border-slate-800 relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start">
                      <div className="p-2 bg-amber-50 dark:bg-slate-800 rounded-lg text-amber-700 dark:text-amber-500 group-hover:bg-amber-700 group-hover:text-white transition-colors">
                        {product.category === 'Coffee' && <Coffee className="w-5 h-5" />}
                        {(product.category === 'Tea' || product.category === 'Milk Tea' || product.category === 'Juice' || product.category === 'Smoothie' || product.category === 'Detox' || product.category === 'Soda' || product.category === 'Yaourt') && <CupSoda className="w-5 h-5" />}
                        {product.category === 'Snacks' && <Cake className="w-5 h-5" />}
                        {(product.category !== 'Coffee' && product.category !== 'Tea' && product.category !== 'Milk Tea' && product.category !== 'Juice' && product.category !== 'Smoothie' && product.category !== 'Detox' && product.category !== 'Soda' && product.category !== 'Yaourt' && product.category !== 'Snacks') && <Utensils className="w-5 h-5" />}
                      </div>
                      <span className="text-sm font-bold text-amber-900 dark:text-amber-200">
                        {Array.isArray(product.price) ? `${formatCurrency(product.price[0])}-${formatCurrency(product.price[product.price.length-1])}` : formatCurrency(product.price)}
                      </span>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600/60 dark:text-amber-500/60 mb-1">
                        {product.category}
                      </div>
                      <h3 className="font-semibold text-amber-900 dark:text-white line-clamp-2 leading-tight">{product.name}</h3>
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            </AnimatePresence>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto pr-2 pb-6">
            <AnimatePresence mode="popLayout">
              {orders.map(order => (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={order.id}
                  className={`bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border-l-8 transition-colors duration-300 ${
                    order.status === 'ready' ? 'border-green-500 bg-green-50/30 dark:bg-green-900/10' :
                    order.status === 'preparing' ? 'border-amber-500' : 'border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="bg-slate-900 dark:bg-slate-800 text-white px-2 py-0.5 rounded text-sm font-bold">#{order.orderNumber}</span>
                        <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded text-sm font-bold">{t.barista.orderCard.table} {order.tableNumber}</span>
                        {order.status === 'ready' && (
                          <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-bold uppercase animate-pulse">
                            <CheckCircle2 className="w-3 h-3" /> {t.barista.orderCard.ready}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                        <Clock className="w-3 h-3" />
                        {order.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-slate-900 dark:text-white">{formatCurrency(order.totalAmount)}</div>
                      <div className={`text-[10px] font-bold uppercase tracking-widest ${
                        order.status === 'ready' ? 'text-green-600 dark:text-green-400' : 'text-slate-400'
                      }`}>
                        {order.status}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-1 mb-4">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className={item.done ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-300'}>
                          {item.quantity}x {item.name}
                        </span>
                        {item.done && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    {(user.role === 'owner' || user.role === 'barista') && (
                      <>
                        <button
                          onClick={() => editOrder(order)}
                          className="flex-1 py-2 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-400 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                        >
                          <Edit2 className="w-4 h-4" /> {language === 'en' ? 'Edit' : 'Sửa'}
                        </button>
                        <button
                          onClick={() => markPaid(order.id)}
                          className="flex-[2] py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                        >
                          <DollarSign className="w-4 h-4" /> {t.barista.history.table.paid}
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {orders.length === 0 && (
              <div className="col-span-full py-20 text-center text-amber-300 dark:text-amber-900/50">
                <ListChecks className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-xl font-medium">{t.barista.history.noOrders}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cart Section */}
      <div className="w-full lg:w-96 bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-l border-amber-100 dark:border-slate-800 transition-colors duration-300">
        <div className="p-6 border-b border-amber-50 dark:border-slate-800 flex items-center gap-3">
          <ShoppingCart className="text-amber-700 dark:text-amber-500" />
          <h2 className="text-xl font-bold text-amber-900 dark:text-white">{t.pos.cart.title}</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-amber-300 dark:text-amber-900/50 opacity-50">
              <ShoppingCart className="w-16 h-16 mb-4" />
              <p className="font-medium">{t.pos.cart.empty}</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.productId} className="flex items-center justify-between gap-4 bg-amber-50 dark:bg-slate-800 p-3 rounded-xl transition-colors duration-300">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-amber-900 dark:text-white truncate">{item.name}</h4>
                  <p className="text-xs text-amber-600 dark:text-amber-500">{formatCurrency(item.price * item.quantity)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQuantity(item.productId, -1)} className="p-1 hover:bg-amber-200 dark:hover:bg-slate-700 rounded-md text-amber-700 dark:text-amber-500">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-6 text-center font-bold text-amber-900 dark:text-white">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.productId, 1)} className="p-1 hover:bg-amber-200 dark:hover:bg-slate-700 rounded-md text-amber-700 dark:text-amber-500">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-amber-50/50 dark:bg-slate-900/50 space-y-4 border-t border-amber-100 dark:border-slate-800 transition-colors duration-300">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-amber-700 dark:text-amber-500 uppercase tracking-wider mb-1 block">{t.pos.cart.table}</label>
              <input
                type="text"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="No."
                className="w-full p-2 bg-white dark:bg-slate-800 border border-amber-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none dark:text-white transition-colors duration-300"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-amber-700 dark:text-amber-500 uppercase tracking-wider mb-1 block">{language === 'en' ? 'Priority' : 'Ưu tiên'}</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as OrderPriority)}
                className="w-full p-2 bg-white dark:bg-slate-800 border border-amber-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none dark:text-white transition-colors duration-300"
              >
                <option value="low">{language === 'en' ? 'Low' : 'Thấp'}</option>
                <option value="medium">{language === 'en' ? 'Medium' : 'Trung bình'}</option>
                <option value="high">{language === 'en' ? 'High' : 'Cao'}</option>
              </select>
            </div>
          </div>

          <div className="flex justify-between items-center py-2">
            <span className="text-amber-700 dark:text-amber-500 font-medium">{t.pos.cart.total}</span>
            <span className="text-2xl font-bold text-amber-900 dark:text-white">{formatCurrency(total)}</span>
          </div>

          <div className="flex gap-2">
            {editingOrderId && (
              <button
                onClick={cancelEdit}
                className="flex-1 py-4 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-bold transition-all"
              >
                {language === 'en' ? 'Cancel' : 'Hủy'}
              </button>
            )}
            <button
              disabled={cart.length === 0 || !tableNumber || submitting}
              onClick={placeOrder}
              className="flex-[2] py-4 bg-amber-700 hover:bg-amber-800 disabled:bg-amber-200 dark:disabled:bg-slate-800 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-amber-200 dark:hover:shadow-none relative group"
            >
              {submitting ? <Coffee className="animate-spin w-5 h-5" /> : <Send className="w-5 h-5" />}
              {editingOrderId ? (language === 'en' ? 'Update Order' : 'Cập nhật đơn') : t.pos.cart.placeOrder}
              
              <div className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 rounded-full shadow-lg group-hover:scale-110 transition-transform">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            </button>
          </div>
        </div>
      </div>
      {/* Price Selection Modal */}
      <AnimatePresence>
        {selectingProduct && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{selectingProduct.name}</h3>
                  <button onClick={() => setSelectingProduct(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                    <X className="w-6 h-6 text-slate-500" />
                  </button>
                </div>
                <p className="text-slate-500 dark:text-slate-400 mb-6">{t.pos.cart.selectPrice}</p>
                <div className="grid grid-cols-2 gap-4">
                  {Array.isArray(selectingProduct.price) && selectingProduct.price.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => addToCart(selectingProduct, p)}
                      className="p-6 bg-slate-50 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 border border-slate-100 dark:border-slate-700 hover:border-amber-200 dark:hover:border-amber-800 rounded-2xl transition-all group"
                    >
                      <span className="block text-2xl font-bold text-slate-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-500 transition-colors">
                        {formatCurrency(p)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
