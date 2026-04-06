export type UserRole = 'employee' | 'barista' | 'owner';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  displayName?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number | number[];
  category: string;
  imageUrl?: string;
  available: boolean;
}

export interface Category {
  id: string;
  name: string;
  order: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  done?: boolean;
}

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered';
export type OrderPriority = 'low' | 'medium' | 'high';

export interface OrderHistoryEntry {
  action: string;
  timestamp: any; // Firestore Timestamp
  user: string; // User's name
}

export interface Order {
  id: string;
  items: OrderItem[];
  status: OrderStatus;
  tableNumber: string;
  priority: OrderPriority;
  totalAmount: number;
  createdAt: any; // Firestore Timestamp
  createdBy: string;
  createdByName: string;
  paid: boolean;
  orderNumber: number;
  history: OrderHistoryEntry[];
}

export interface DailySale {
  date: string; // YYYY-MM-DD
  totalRevenue: number;
  orderCount: number;
}
