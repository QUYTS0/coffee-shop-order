import { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy, limit, where, Timestamp } from 'firebase/firestore';
import { Product, Order, UserProfile, DailySale, Category } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Plus, Edit2, Trash2, Users, Package, TrendingUp, History, DollarSign, Coffee, Save, X, Download, Calendar, Filter, Clock, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { translations } from '../translations';

export default function Owner({ user, language }: { user: UserProfile, language: 'en' | 'vi' }) {
  const t = translations[language];
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'users' | 'history'>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productImageUrl, setProductImageUrl] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [inventorySearchQuery, setInventorySearchQuery] = useState('');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('All');
  const [historyFilter, setHistoryFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount).replace('₫', 'đ');
  };

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubProds = onSnapshot(collection(db, 'products'), (s) => {
      const prods = s.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      const uniqueProds = Array.from(new Map(prods.map(p => [p.id, p])).values());
      setProducts(uniqueProds);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    const unsubCats = onSnapshot(query(collection(db, 'categories'), orderBy('order', 'asc')), (s) => {
      const cats = s.docs.map(d => ({ id: d.id, ...d.data() } as Category));
      const uniqueCats = Array.from(new Map(cats.map(c => [c.id, c])).values());
      setCategories(uniqueCats);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    });

    const unsubOrders = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(500)), (s) => {
      const ords = s.docs.map(d => ({ id: d.id, ...d.data() } as Order));
      const uniqueOrds = Array.from(new Map(ords.map(o => [o.id, o])).values());
      setOrders(uniqueOrds);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (s) => {
      const usrs = s.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
      const uniqueUsers = Array.from(new Map(usrs.map(u => [u.uid, u])).values());
      setUsers(uniqueUsers);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubProds();
      unsubCats();
      unsubOrders();
      unsubUsers();
    };
  }, [user]);

  const filteredOrders = orders.filter(order => {
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
    const data = filteredOrders.map(o => ({
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
    XLSX.writeFile(workbook, `OrderHistory_${historyFilter}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const salesByDay = orders.reduce((acc, o) => {
    const date = o.createdAt?.toDate().toLocaleDateString() || 'Unknown';
    acc[date] = (acc[date] || 0) + o.totalAmount;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(salesByDay).map(([date, total]) => ({ date, total })).reverse();

  const handleSaveProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const priceRaw = formData.get('price') as string;
    
    let price: number | number[];
    if (priceRaw.includes('-')) {
      price = priceRaw.split('-').map(p => {
        const val = parseFloat(p.trim());
        return val < 1000 ? val * 1000 : val;
      }).filter(p => !isNaN(p));
    } else {
      const val = parseFloat(priceRaw);
      price = val < 1000 ? val * 1000 : val;
    }

    const productData = {
      name: formData.get('name') as string,
      price,
      category: formData.get('category') as string,
      imageUrl: productImageUrl,
      available: true
    };

    if (editingProduct) {
      const path = `products/${editingProduct.id}`;
      try {
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
        setEditingProduct(null);
        setProductImageUrl('');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    } else {
      const path = 'products';
      try {
        await addDoc(collection(db, path), productData);
        setIsAddingProduct(false);
        setProductImageUrl('');
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    }
  };

  const updateUserRole = async (uid: string, role: string) => {
    const path = `users/${uid}`;
    try {
      await updateDoc(doc(db, 'users', uid), { role });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const approveUser = async (uid: string) => {
    const path = `users/${uid}`;
    try {
      await updateDoc(doc(db, 'users', uid), { status: 'approved' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deactivateUser = async (uid: string) => {
    const path = `users/${uid}`;
    try {
      await updateDoc(doc(db, 'users', uid), { status: 'inactive' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500000) { // 500KB limit for Base64 in Firestore
      alert(language === 'en' ? 'Image is too large. Please select an image under 500KB.' : 'Hình ảnh quá lớn. Vui lòng chọn ảnh dưới 500KB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target?.result as string;
      setProductImageUrl(base64);
    };
    reader.readAsDataURL(file);
  };

  const seedProducts = async () => {
    const defaultCategories = [
      'Coffee', 'Tea', 'Milk Tea', 'Juice', 'Smoothie', 'Detox', 'Soda', 'Yaourt', 'Snacks', 'Other'
    ];

    for (let i = 0; i < defaultCategories.length; i++) {
      try {
        await addDoc(collection(db, 'categories'), {
          name: defaultCategories[i],
          order: i
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'categories');
      }
    }

    const defaults = [
      // Coffee & Latte
      { name: 'Cà Phê Đen/Sữa', price: 15000, category: 'Coffee', available: true },
      { name: 'Cà Phê Muối', price: 20000, category: 'Coffee', available: true },
      { name: 'Cà Phê Mocha', price: 25000, category: 'Coffee', available: true },
      { name: 'Bạc Xỉu', price: 20000, category: 'Coffee', available: true },
      { name: 'Sữa Tươi Cà Phê', price: 20000, category: 'Coffee', available: true },
      { name: 'Matcha Latte', price: 20000, category: 'Coffee', available: true },
      { name: 'Cacao Latte', price: 20000, category: 'Coffee', available: true },
      { name: 'Cacao Latte Bạc Hà', price: 20000, category: 'Coffee', available: true },
      { name: 'Chocolate Latte', price: 20000, category: 'Coffee', available: true },
      { name: 'Khoai Môn Latte', price: 20000, category: 'Coffee', available: true },

      // Trà sữa & Trà
      { name: 'Trà Sữa Hoa Trân', price: 20000, category: 'Tea', available: true },
      { name: 'Trà Sữa Thái Xanh', price: 20000, category: 'Tea', available: true },
      { name: 'Trà Sữa Thái Đỏ', price: 20000, category: 'Tea', available: true },
      { name: 'Trà Sữa Matcha', price: 20000, category: 'Tea', available: true },
      { name: 'Trà Sữa Khoai Môn', price: 20000, category: 'Tea', available: true },
      { name: 'Trà Sữa Socola', price: 20000, category: 'Tea', available: true },
      { name: 'Trà Sữa Bánh Flan', price: 20000, category: 'Tea', available: true },
      { name: 'Trà Sữa Ngọc Trai', price: 20000, category: 'Tea', available: true },
      { name: 'Trà Sữa Dâu', price: 20000, category: 'Tea', available: true },
      { name: 'Trà Sữa Nho', price: 20000, category: 'Tea', available: true },
      { name: 'Trà Sữa Bạc Hà', price: 20000, category: 'Tea', available: true },
      { name: 'Trà Sữa Dưa Lưới', price: 20000, category: 'Tea', available: true },
      { name: 'Trà Sữa Sâm Dứa', price: 20000, category: 'Tea', available: true },
      { name: 'Trà Sữa Mầm Cây', price: 20000, category: 'Tea', available: true },
      { name: 'Trà Sữa Uyên Ương', price: 25000, category: 'Tea', available: true },
      { name: 'Trà Vải', price: 20000, category: 'Tea', available: true },
      { name: 'Trà Đào', price: 20000, category: 'Tea', available: true },
      { name: 'Trà Đào Hạt Chia', price: 20000, category: 'Tea', available: true },
      { name: 'Trà Mãng Cầu', price: 20000, category: 'Tea', available: true },
      { name: 'Trà Ổi', price: 20000, category: 'Tea', available: true },
      { name: 'Trà Chanh', price: 10000, category: 'Tea', available: true },
      { name: 'Trà Chanh Hạt Chia', price: 15000, category: 'Tea', available: true },
      { name: 'Trà Chanh Xí Muội', price: 15000, category: 'Tea', available: true },
      { name: 'Trà Chanh Dưa Lưới', price: 15000, category: 'Tea', available: true },
      { name: 'Trà Chanh Bạc Hà', price: 15000, category: 'Tea', available: true },
      { name: 'Trà Tắc', price: 10000, category: 'Tea', available: true },
      { name: 'Trà Tắc Hạt Chia', price: 15000, category: 'Tea', available: true },
      { name: 'Trà Tắc Xí Muội', price: 15000, category: 'Tea', available: true },
      { name: 'Trà Tắc Dưa Lưới', price: 15000, category: 'Tea', available: true },
      { name: 'Trà Tắc Bạc Hà', price: 15000, category: 'Tea', available: true },

      // Milk Tea (STTC)
      { name: 'Sữa Tươi Trân Châu Đường Đen', price: 25000, category: 'Milk Tea', available: true },
      { name: 'Sữa Tươi Trân Châu Matcha', price: 27000, category: 'Milk Tea', available: true },
      { name: 'Sữa Tươi Trân Châu Chocolate', price: 27000, category: 'Milk Tea', available: true },

      // Nước ép
      { name: 'Nước ép Rau má', price: 10000, category: 'Juice', available: true },
      { name: 'Nước ép Rau má sữa', price: 12000, category: 'Juice', available: true },
      { name: 'Nước ép Rau má đậu xanh', price: 15000, category: 'Juice', available: true },
      { name: 'Nước ép Chanh', price: 10000, category: 'Juice', available: true },
      { name: 'Nước ép Cà chua', price: 20000, category: 'Juice', available: true },
      { name: 'Nước ép Ổi', price: 20000, category: 'Juice', available: true },
      { name: 'Nước ép Cà rốt', price: 20000, category: 'Juice', available: true },
      { name: 'Nước ép Táo', price: 20000, category: 'Juice', available: true },
      { name: 'Nước ép Lê', price: 20000, category: 'Juice', available: true },
      { name: 'Nước ép Dưa lưới', price: 20000, category: 'Juice', available: true },
      { name: 'Nước ép Chanh dây', price: 20000, category: 'Juice', available: true },
      { name: 'Nước ép Cam', price: 20000, category: 'Juice', available: true },
      { name: 'Nước ép Cam sữa', price: 20000, category: 'Juice', available: true },
      { name: 'Nước ép Cam + Táo', price: 20000, category: 'Juice', available: true },
      { name: 'Nước ép Cam + Cà Rốt', price: 20000, category: 'Juice', available: true },
      { name: 'Nước ép Thơm', price: 20000, category: 'Juice', available: true },
      { name: 'Nước ép Thơm sữa', price: 20000, category: 'Juice', available: true },
      { name: 'Nước ép Thơm + Táo', price: 20000, category: 'Juice', available: true },
      { name: 'Nước ép Thơm + Cam', price: 20000, category: 'Juice', available: true },
      { name: 'Nước ép Thơm + Cà Rốt', price: 20000, category: 'Juice', available: true },
      { name: 'Nước ép Thơm + Xoài', price: 20000, category: 'Juice', available: true },
      { name: 'Nước ép Thơm + Cà Chua', price: 20000, category: 'Juice', available: true },
      { name: 'Nước ép Ổi + Táo', price: 20000, category: 'Juice', available: true },
      { name: 'Nước ép Ổi + Thơm', price: 20000, category: 'Juice', available: true },
      { name: 'Nước ép Ổi + Cà Rốt', price: 20000, category: 'Juice', available: true },
      { name: 'Nước ép Cà chua + Cà Rốt', price: 20000, category: 'Juice', available: true },

      // Sinh tố
      { name: 'Sinh tố Cà chua', price: 20000, category: 'Smoothie', available: true },
      { name: 'Sinh tố Chuối', price: 12000, category: 'Smoothie', available: true },
      { name: 'Sinh tố Mãng cầu', price: 25000, category: 'Smoothie', available: true },
      { name: 'Sinh tố Sapoche', price: 20000, category: 'Smoothie', available: true },
      { name: 'Sinh tố Sapoche Cà Phê', price: 20000, category: 'Smoothie', available: true },
      { name: 'Sinh tố Dâu', price: 25000, category: 'Smoothie', available: true },
      { name: 'Sinh tố Việt Quất', price: 20000, category: 'Smoothie', available: true },
      { name: 'Sinh tố Chanh Dây', price: 20000, category: 'Smoothie', available: true },
      { name: 'Sinh tố Xoài', price: 20000, category: 'Smoothie', available: true },
      { name: 'Sinh tố Dâu Xoài', price: 20000, category: 'Smoothie', available: true },
      { name: 'Sinh tố Dâu Mãng Cầu', price: 20000, category: 'Smoothie', available: true },
      { name: 'Sinh tố Xoài Chuối', price: 20000, category: 'Smoothie', available: true },
      { name: 'Sinh tố Dâu Chuối', price: 20000, category: 'Smoothie', available: true },
      { name: 'Sinh tố Dâu Sữa Chua', price: 27000, category: 'Smoothie', available: true },
      { name: 'Sinh tố Xoài Sữa Chua', price: 27000, category: 'Smoothie', available: true },

      // Detox
      { name: 'Detox 1: Cần Tây + Thơm', price: 22000, category: 'Detox', available: true },
      { name: 'Detox 2: Cần Tây + Táo', price: 22000, category: 'Detox', available: true },
      { name: 'Detox 3: Cần Tây + Táo + Thơm', price: 22000, category: 'Detox', available: true },
      { name: 'Detox 4: Cần Tây + Cà Rốt + Dưa Leo', price: 22000, category: 'Detox', available: true },
      { name: 'Detox 5: Xoài + Lê + Thơm + Cà Rốt', price: 22000, category: 'Detox', available: true },
      { name: 'Detox 6: Thơm + Táo + Chanh', price: 22000, category: 'Detox', available: true },
      { name: 'Detox 7: Thơm + Táo + Cà Rốt', price: 22000, category: 'Detox', available: true },
      { name: 'Detox 8: Củ Dền', price: 22000, category: 'Detox', available: true },
      { name: 'Detox 9: Củ Dền + Táo + Thơm + Cà Rốt', price: 22000, category: 'Detox', available: true },
      { name: 'Detox 10: Củ Dền + Táo + Thơm + Cà Rốt + Dưa Leo', price: 22000, category: 'Detox', available: true },
      { name: 'Detox 11: Táo + Dưa Leo + Chanh', price: 22000, category: 'Detox', available: true },
      { name: 'Detox 12: Ổi + Lê + Thơm + Dưa Leo', price: 22000, category: 'Detox', available: true },

      // Soda
      { name: 'Soda Blue', price: 20000, category: 'Soda', available: true },
      { name: 'Soda Thơm', price: 20000, category: 'Soda', available: true },
      { name: 'Soda Đào', price: 20000, category: 'Soda', available: true },
      { name: 'Soda Dâu', price: 20000, category: 'Soda', available: true },
      { name: 'Soda Bạc Hà', price: 20000, category: 'Soda', available: true },
      { name: 'Soda Việt Quất', price: 20000, category: 'Soda', available: true },
      { name: 'Soda Chanh Dây', price: 20000, category: 'Soda', available: true },

      // Yaourt
      { name: 'Yaourt Đá', price: 15000, category: 'Yaourt', available: true },
      { name: 'Yaourt Xoài', price: 20000, category: 'Yaourt', available: true },
      { name: 'Yaourt Hạt Đác', price: 20000, category: 'Yaourt', available: true },
      { name: 'Yaourt Nha Đam', price: 20000, category: 'Yaourt', available: true },
      { name: 'Yaourt Chanh Dây', price: 20000, category: 'Yaourt', available: true },
      { name: 'Yaourt Cam Tươi', price: 20000, category: 'Yaourt', available: true },
      { name: 'Yaourt Kiwi', price: 20000, category: 'Yaourt', available: true },
      { name: 'Yaourt Bạc Hà', price: 20000, category: 'Yaourt', available: true },
      { name: 'Yaourt Dâu', price: 20000, category: 'Yaourt', available: true },
      { name: 'Yaourt Việt Quất', price: 20000, category: 'Yaourt', available: true },

      // Ăn vặt
      { name: 'Bánh Tráng Trộn', price: 20000, category: 'Snacks', available: true },
      { name: 'Bánh Tráng Bơ', price: 20000, category: 'Snacks', available: true },
      { name: 'Xoài Lắc', price: 20000, category: 'Snacks', available: true },
      { name: 'Xoài Mắm Ruốc', price: 20000, category: 'Snacks', available: true },
      { name: 'Gỏi Cá Cơm', price: 30000, category: 'Snacks', available: true },

      // Khác
      { name: 'Mãng Cầu Dầm', price: 25000, category: 'Other', available: true },
      { name: 'Milo Dầm', price: 20000, category: 'Other', available: true },
      { name: 'Milo Nóng', price: 20000, category: 'Other', available: true },
      { name: 'Bánh Flan', price: 20000, category: 'Other', available: true },
      { name: 'Cacao Đá Xay', price: 20000, category: 'Other', available: true },
      { name: 'Việt Quất Đá Xay', price: 20000, category: 'Other', available: true },
      { name: 'Dâu Đá Xay', price: 20000, category: 'Other', available: true },
      { name: 'Sâm Dứa Đá Xay', price: 20000, category: 'Other', available: true },
      { name: 'Sữa Nóng', price: 15000, category: 'Other', available: true },
      { name: 'Cacao Nóng/Đá', price: 20000, category: 'Other', available: true },
      { name: 'Sữa Chanh', price: 15000, category: 'Other', available: true },
    ];
    for (const p of defaults) {
      try {
        await addDoc(collection(db, 'products'), p);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'products');
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const path = 'products';
        let successCount = 0;
        let errorCount = 0;

        for (const row of data) {
          try {
            // Flexible header mapping
            const name = row.Name || row.name || row['Tên sản phẩm'] || row['Tên'];
            const priceStr = String(row.Price || row.price || row['Giá'] || row['Giá tiền']);
            const category = row.Category || row.category || row['Danh mục'] || 'Other';
            const imageUrl = row.ImageUrl || row.imageUrl || row['Ảnh'] || '';
            const availableRaw = row.Available !== undefined ? row.Available : row.available;
            
            let price: number | number[];
            if (priceStr.includes('-')) {
              price = priceStr.split('-').map(p => {
                const val = parseFloat(p.replace(/[^0-9.]/g, '').trim());
                return val < 1000 ? val * 1000 : val;
              }).filter(p => !isNaN(p));
            } else {
              const val = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
              price = val < 1000 ? val * 1000 : val;
            }

            const available = availableRaw !== undefined 
              ? (String(availableRaw).toLowerCase() === 'true' || availableRaw === 1 || availableRaw === true) 
              : true;

            if (name && (Array.isArray(price) ? price.length > 0 : !isNaN(price))) {
              await addDoc(collection(db, path), {
                name,
                price,
                category,
                imageUrl,
                available
              });
              successCount++;
            } else {
              console.warn('Invalid row data:', row);
              errorCount++;
            }
          } catch (error) {
            console.error('Error importing row:', row, error);
            errorCount++;
          }
        }

        alert(language === 'en' 
          ? `Import finished! Success: ${successCount}, Errors: ${errorCount}`
          : `Nhập dữ liệu hoàn tất! Thành công: ${successCount}, Lỗi: ${errorCount}`);
      } catch (error) {
        console.error('File read error:', error);
      }
      
      // Reset input
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await addDoc(collection(db, 'categories'), {
        name: newCategoryName.trim(),
        order: categories.length
      });
      setNewCategoryName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'categories');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'categories', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `categories/${id}`);
    }
  };

  const filterLabels = {
    today: language === 'en' ? 'Today' : 'Hôm nay',
    week: language === 'en' ? 'Week' : 'Tuần',
    month: language === 'en' ? 'Month' : 'Tháng',
    all: language === 'en' ? 'All' : 'Tất cả'
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300">
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 lg:px-8 py-4 lg:py-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 transition-colors duration-300">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <TrendingUp className="text-indigo-600 dark:text-indigo-400 w-6 lg:w-8 h-6 lg:h-8" />
          {t.owner.title}
        </h1>
        <div className="flex w-full lg:w-auto bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl overflow-x-auto transition-colors duration-300 no-scrollbar">
          {[
            { id: 'dashboard', icon: TrendingUp, label: t.owner.tabs.dashboard, roles: ['owner'] },
            { id: 'products', icon: Package, label: t.owner.tabs.inventory, roles: ['owner', 'barista'] },
            { id: 'users', icon: Users, label: t.owner.tabs.staff, roles: ['owner'] },
            { id: 'history', icon: History, label: t.owner.tabs.history, roles: ['owner', 'barista'] }
          ].filter(tab => tab.roles.includes(user.role)).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab.id ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors duration-300">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-2xl"><DollarSign className="w-6 h-6" /></div>
                  <h3 className="text-slate-500 dark:text-slate-400 font-bold uppercase text-xs tracking-widest">{t.owner.dashboard.revenue}</h3>
                </div>
                <p className="text-4xl font-black text-slate-900 dark:text-white">{formatCurrency(totalRevenue)}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors duration-300">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-2xl"><Coffee className="w-6 h-6" /></div>
                  <h3 className="text-slate-500 dark:text-slate-400 font-bold uppercase text-xs tracking-widest">{t.owner.dashboard.orders}</h3>
                </div>
                <p className="text-4xl font-black text-slate-900 dark:text-white">{orders.length}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors duration-300">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-2xl"><TrendingUp className="w-6 h-6" /></div>
                  <h3 className="text-slate-500 dark:text-slate-400 font-bold uppercase text-xs tracking-widest">{t.owner.dashboard.avgOrder}</h3>
                </div>
                <p className="text-4xl font-black text-slate-900 dark:text-white">
                  {orders.length ? formatCurrency(totalRevenue / orders.length) : formatCurrency(0)}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors duration-300">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-2xl"><Package className="w-6 h-6" /></div>
                  <h3 className="text-slate-500 dark:text-slate-400 font-bold uppercase text-xs tracking-widest">{language === 'en' ? 'Total Products' : 'Tổng sản phẩm'}</h3>
                </div>
                <p className="text-4xl font-black text-slate-900 dark:text-white">{products.length}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 h-96 transition-colors duration-300">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">{t.owner.dashboard.trend}</h3>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line type="monotone" dataKey="total" stroke="#4f46e5" strokeWidth={4} dot={{ r: 6, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t.owner.inventory.title}</h2>
                <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full text-xs font-bold">
                  {products.length} {language === 'en' ? 'Products' : 'Sản phẩm'}
                </span>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder={t.pos.search}
                    value={inventorySearchQuery}
                    onChange={(e) => setInventorySearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                  />
                </div>
                <select
                  value={inventoryCategoryFilter}
                  onChange={(e) => setInventoryCategoryFilter(e.target.value)}
                  className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="All">{t.pos.categories.all}</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setIsManagingCategories(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all"
                >
                  <Package className="w-4 h-4" />
                  {t.owner.inventory.manageCategories}
                </button>
                <input
                  type="file"
                  id="csv-upload"
                  accept=".csv, .xlsx, .xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => document.getElementById('csv-upload')?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold transition-all"
                >
                  <Download className="w-4 h-4" />
                  {language === 'en' ? 'Import' : 'Nhập'}
                </button>
                <button
                  onClick={() => setIsAddingProduct(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
                >
                  <Plus className="w-4 h-4" /> {t.owner.inventory.add}
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left min-w-[600px]">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t.owner.inventory.form.name}</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t.owner.inventory.form.category}</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t.owner.inventory.form.price}</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right">{t.owner.staff.table.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {products
                      .filter(p => {
                        const matchesSearch = p.name.toLowerCase().includes(inventorySearchQuery.toLowerCase());
                        const matchesCategory = inventoryCategoryFilter === 'All' || p.category === inventoryCategoryFilter;
                        return matchesSearch && matchesCategory;
                      })
                      .map(product => (
                        <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {product.imageUrl ? (
                                <img src={product.imageUrl} alt={product.name} className="w-10 h-10 object-cover rounded-lg shadow-sm" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                                  <Package className="w-5 h-5 text-slate-400" />
                                </div>
                              )}
                              <div className="font-bold text-slate-900 dark:text-white">{product.name}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded text-[10px] font-bold uppercase tracking-wider">
                              {product.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">
                            {Array.isArray(product.price) 
                              ? product.price.map(p => formatCurrency(p)).join(' - ') 
                              : formatCurrency(product.price)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => {
                                setEditingProduct(product);
                                setProductImageUrl(product.imageUrl || '');
                              }} className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => setDeletingProduct(product)} className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

        <AnimatePresence>
          {deletingProduct && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800"
              >
                <div className="p-8">
                  <div className="flex items-center gap-4 mb-6 text-red-600">
                    <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-2xl">
                      <Trash2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-2xl font-bold">{language === 'en' ? 'Confirm Delete' : 'Xác nhận xóa'}</h3>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                    {language === 'en' 
                      ? `Are you sure you want to delete "${deletingProduct.name}"? This action cannot be undone.`
                      : `Bạn có chắc chắn muốn xóa "${deletingProduct.name}"? Hành động này không thể hoàn tác.`}
                  </p>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setDeletingProduct(null)}
                      className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-bold transition-all"
                    >
                      {language === 'en' ? 'Cancel' : 'Hủy'}
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await deleteDoc(doc(db, 'products', deletingProduct.id));
                          setDeletingProduct(null);
                        } catch (error) {
                          handleFirestoreError(error, OperationType.DELETE, 'products');
                        }
                      }}
                      className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-red-100 dark:shadow-none"
                    >
                      {language === 'en' ? 'Delete' : 'Xóa'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {deletingCategory && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800"
              >
                <div className="p-8">
                  <div className="flex items-center gap-4 mb-6 text-rose-600">
                    <div className="p-3 bg-rose-100 dark:bg-rose-900/30 rounded-2xl">
                      <Trash2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-2xl font-bold">{language === 'en' ? 'Confirm Delete' : 'Xác nhận xóa'}</h3>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                    {language === 'en' 
                      ? `Are you sure you want to delete category "${deletingCategory.name}"? This might affect products using this category.`
                      : `Bạn có chắc chắn muốn xóa danh mục "${deletingCategory.name}"? Điều này có thể ảnh hưởng đến các sản phẩm sử dụng danh mục này.`}
                  </p>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setDeletingCategory(null)}
                      className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-bold transition-all"
                    >
                      {language === 'en' ? 'Cancel' : 'Hủy'}
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await deleteDoc(doc(db, 'categories', deletingCategory.id));
                          setDeletingCategory(null);
                        } catch (error) {
                          handleFirestoreError(error, OperationType.DELETE, `categories/${deletingCategory.id}`);
                        }
                      }}
                      className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-rose-100 dark:shadow-none"
                    >
                      {language === 'en' ? 'Delete' : 'Xóa'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {isManagingCategories && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800"
              >
                <div className="p-8">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{t.owner.inventory.manageCategories}</h3>
                    <button onClick={() => setIsManagingCategories(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                      <X className="w-6 h-6 text-slate-500" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder={language === 'en' ? 'New category name...' : 'Tên danh mục mới...'}
                        className="flex-1 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white transition-colors"
                      />
                      <button
                        onClick={handleAddCategory}
                        className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
                      >
                        <Plus className="w-6 h-6" />
                      </button>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                      {categories.map(cat => (
                        <div key={cat.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                          <span className="font-medium text-slate-900 dark:text-white">{cat.name}</span>
                          <button
                            onClick={() => setDeletingCategory(cat)}
                            className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {(isAddingProduct || editingProduct) && (
              <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }} 
                  animate={{ scale: 1, opacity: 1 }} 
                  className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl max-w-md w-full transition-colors duration-300 max-h-[90vh] overflow-y-auto"
                >
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{editingProduct ? t.owner.inventory.edit : t.owner.inventory.add}</h3>
                    <button onClick={() => { setIsAddingProduct(false); setEditingProduct(null); setProductImageUrl(''); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"><X /></button>
                  </div>
                  <form onSubmit={handleSaveProduct} className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 block">{language === 'en' ? 'Product Image' : 'Hình ảnh sản phẩm'}</label>
                      <div className="flex flex-col items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                        {productImageUrl ? (
                          <div className="relative w-32 h-32">
                            <img src={productImageUrl} alt="Preview" className="w-full h-full object-cover rounded-lg shadow-md" referrerPolicy="no-referrer" />
                            <button 
                              type="button"
                              onClick={() => setProductImageUrl('')}
                              className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-slate-400">
                            <Package className="w-12 h-12 opacity-20" />
                            <p className="text-[10px] font-bold uppercase tracking-wider">{language === 'en' ? 'No Image Selected' : 'Chưa chọn ảnh'}</p>
                          </div>
                        )}
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleImageUpload}
                          className="hidden" 
                          id="product-image-upload"
                        />
                        <label 
                          htmlFor="product-image-upload"
                          className="px-4 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold shadow-sm border border-slate-200 dark:border-slate-600 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-600 transition-all"
                        >
                          {language === 'en' ? 'Choose Image' : 'Chọn ảnh'}
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 block">{t.owner.inventory.form.name}</label>
                      <input name="name" defaultValue={editingProduct?.name} required className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white transition-colors duration-300" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 block">{t.owner.inventory.form.price}</label>
                      <input name="price" type="text" defaultValue={editingProduct ? (Array.isArray(editingProduct.price) ? editingProduct.price.join('-') : editingProduct.price) : ''} required className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white transition-colors duration-300" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 block">{t.owner.inventory.form.category}</label>
                      <select name="category" defaultValue={editingProduct?.category} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white transition-colors duration-300">
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                        <option value="Other">{t.pos.categories.other}</option>
                      </select>
                    </div>
                    <button type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-100 dark:shadow-none">
                      <Save className="w-5 h-5" /> {editingProduct ? t.owner.modal.update : t.owner.modal.save}
                    </button>
                  </form>
                </motion.div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-8">
            {/* Pending Users */}
            {users.some(u => u.status === 'pending') && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-amber-200 dark:border-amber-900/30 overflow-hidden transition-colors duration-300">
                <div className="px-8 py-4 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-900/30">
                  <h3 className="text-sm font-black text-amber-800 dark:text-amber-400 uppercase tracking-widest">{t.owner.staff.pending}</h3>
                </div>
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left min-w-[400px]">
                  <tbody className="divide-y divide-amber-50 dark:divide-amber-900/20 transition-colors duration-300">
                    {users.filter(u => u.status === 'pending').map(u => (
                      <tr key={u.uid} className="hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-colors">
                        <td className="px-8 py-6">
                          <div className="font-bold text-slate-900 dark:text-white">{u.displayName}</div>
                          <div className="text-sm text-slate-500 dark:text-slate-400">{u.email}</div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <button
                            onClick={() => approveUser(u.uid)}
                            className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-amber-100 dark:shadow-none"
                          >
                            {t.owner.staff.approve}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

            {/* Active Users */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors duration-300">
              <div className="px-8 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">{t.owner.staff.active}</h3>
              </div>
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left min-w-[600px]">
                <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 transition-colors duration-300">
                  <tr>
                    <th className="px-8 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t.owner.staff.table.user}</th>
                    <th className="px-8 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t.owner.staff.table.role}</th>
                    <th className="px-8 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t.owner.staff.table.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 transition-colors duration-300">
                  {users.filter(u => u.status !== 'pending' && u.status !== 'inactive').map(u => (
                    <tr key={u.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-8 py-6">
                        <div className="font-bold text-slate-900 dark:text-white">{u.displayName}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">{u.email}</div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          u.role === 'owner' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' :
                          u.role === 'barista' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <select
                            value={u.role}
                            onChange={(e) => updateUserRole(u.uid, e.target.value)}
                            className="p-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-300"
                          >
                            <option value="employee">{language === 'en' ? 'Employee' : 'Nhân viên'}</option>
                            <option value="barista">{language === 'en' ? 'Barista' : 'Pha chế'}</option>
                            <option value="owner">{language === 'en' ? 'Owner' : 'Chủ sở hữu'}</option>
                          </select>
                          {u.uid !== user.uid && (
                            <button
                              onClick={() => deactivateUser(u.uid)}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                              title={t.owner.staff.deactivate}
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

            {/* Inactive Users */}
            {users.some(u => u.status === 'inactive') && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors duration-300 opacity-60">
                <div className="px-8 py-4 bg-slate-100 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t.owner.staff.inactive}</h3>
                </div>
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left font-mono text-xs min-w-[500px]">
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 transition-colors duration-300">
                    {users.filter(u => u.status === 'inactive').map(u => (
                      <tr key={u.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-8 py-4">
                          <div className="font-bold text-slate-700 dark:text-slate-300">{u.displayName}</div>
                          <div className="text-slate-500 dark:text-slate-500">{u.email}</div>
                        </td>
                        <td className="px-8 py-4">
                          <span className="uppercase tracking-widest">{u.role}</span>
                        </td>
                        <td className="px-8 py-4 text-right">
                          <button
                            onClick={() => approveUser(u.uid)}
                            className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                          >
                            {language === 'en' ? 'Reactivate' : 'Kích hoạt lại'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6">
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
              {filteredOrders.map(order => (
                <div key={order.id} className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col gap-4 transition-colors duration-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col items-center justify-center min-w-[64px] h-16 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl">
                        <span className="text-[10px] font-bold uppercase opacity-50">{t.barista.history.table.order}</span>
                        <span className="text-xl font-black">#{order.orderNumber}</span>
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {order.items.map(i => (
                            <span key={i.productId} className="mr-2">
                              {i.quantity}x {i.name}
                              {i.note && (
                                <span className="ml-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase bg-amber-50 dark:bg-amber-900/30 px-1 rounded">
                                  ({i.note})
                                </span>
                              )}
                            </span>
                          ))}
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
                  
                  {order.history && order.history.length > 0 && (
                    <div className="mt-2 pt-4 border-t border-slate-100 dark:border-slate-800 transition-colors duration-300">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t.owner.history.modification}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {order.history.map((entry, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg transition-colors duration-300">
                            <span className="font-medium">{entry.action}</span>
                            <span className="text-slate-400 dark:text-slate-500">{entry.user} • {entry.timestamp?.toDate().toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {filteredOrders.length === 0 && (
                <div className="text-center py-20 text-slate-300 dark:text-slate-700 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 transition-colors duration-300">
                  <Filter className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="text-xl font-medium">{t.barista.history.noOrders}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
