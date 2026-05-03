export const translations = {
  en: {
    brand: 'Cheese Lab',
    nav: {
      placeOrder: 'Place Order',
      baristaView: 'Barista View',
      management: 'Management',
      settings: 'Settings',
      signOut: 'Sign Out'
    },
    pos: {
      menu: 'Menu',
      search: 'Search products...',
      categories: {
        all: 'All',
        coffee: 'Coffee',
        tea: 'Tea',
        milkTea: 'Milk Tea',
        juice: 'Juice',
        smoothie: 'Smoothie',
        detox: 'Detox',
        soda: 'Soda',
        yaourt: 'Yaourt',
        snacks: 'Snacks',
        other: 'Other'
      },
      cart: {
        title: 'Current Order',
        empty: 'Your cart is empty',
        table: 'Table Number',
        total: 'Total',
        placeOrder: 'Place Order',
        clear: 'Clear',
        selectPrice: 'Select Price'
      }
    },
    barista: {
      title: 'Barista Dashboard',
      tabs: {
        orders: 'Orders',
        summary: 'Summary',
        history: 'History'
      },
      status: {
        pending: 'Pending',
        preparing: 'Preparing',
        ready: 'Ready',
        delivered: 'Delivered'
      },
      orderCard: {
        table: 'Table',
        start: 'Start Preparing',
        ready: 'Mark Ready',
        delivered: 'Mark Delivered',
        completed: 'All orders completed!'
      },
      history: {
        export: 'Export to Excel',
        noOrders: 'No orders found for this period',
        table: {
          order: 'Order #',
          date: 'Date',
          table: 'Table',
          items: 'Items',
          total: 'Total',
          status: 'Status',
          staff: 'Staff',
          paid: 'Paid'
        }
      },
      summary: {
        title: 'Items to Prepare',
        subtitle: 'Total quantities across all pending orders',
        markAllDone: 'Done',
        noItems: 'No items currently in queue.'
      }
    },
    owner: {
      title: 'Management Center',
      tabs: {
        dashboard: 'Dashboard',
        inventory: 'Inventory',
        staff: 'Staff',
        history: 'History'
      },
      dashboard: {
        revenue: 'Total Revenue',
        orders: 'Total Orders',
        avgOrder: 'Avg Order',
        trend: 'Revenue Trend'
      },
      inventory: {
        title: 'Inventory Management',
        seed: 'Seed Menu',
        add: 'Add Product',
        manageCategories: 'Manage Categories',
        available: 'Available',
        outOfStock: 'Out of Stock',
        edit: 'Edit',
        form: {
          name: 'Name',
          price: 'Price (e.g. 15 or 15-20)',
          category: 'Category'
        }
      },
      staff: {
        title: 'Staff Management',
        user: 'User',
        role: 'Role',
        actions: 'Actions',
        pending: 'Pending Approval',
        active: 'Active Staff',
        inactive: 'Former Employees',
        approve: 'Approve',
        deactivate: 'Deactivate',
        table: {
          user: 'User',
          role: 'Role',
          actions: 'Actions'
        }
      },
      history: {
        title: 'Order History',
        export: 'Export',
        modification: 'Modification History'
      },
      modal: {
        edit: 'Edit Product',
        new: 'New Product',
        name: 'Name',
        price: 'Price',
        category: 'Category',
        available: 'Available for Sale',
        save: 'Save Product',
        update: 'Update Product'
      }
    },
    auth: {
      title: 'Cheese Lab POS',
      signInPrompt: 'Please sign in to access the coffee shop system.',
      signInButton: 'Sign in with Google',
      loading: 'Loading...'
    },
    error: {
      title: 'Something went wrong',
      message: 'An unexpected error occurred.',
      button: 'Reload Application'
    },
    chat: {
      title: 'Cheese Lab AI',
      online: 'Always online',
      placeholder: 'Ask me anything...',
      welcome: 'Hello {name}! I\'m your Cheese Lab assistant. How can I help you manage the shop today?'
    },
    settings: {
      title: 'Settings',
      language: 'Language',
      theme: 'Theme',
      light: 'Bright Mode',
      dark: 'Dark Mode',
      english: 'English',
      vietnamese: 'Vietnamese',
      profile: 'User Profile',
      role: 'Role',
      email: 'Email'
    }
  },
  vi: {
    brand: 'Cheese Lab',
    nav: {
      placeOrder: 'Bán hàng',
      baristaView: 'Pha chế',
      management: 'Quản lý',
      settings: 'Cài đặt',
      signOut: 'Đăng xuất'
    },
    pos: {
      menu: 'Thực đơn',
      search: 'Tìm món...',
      categories: {
        all: 'Tất cả',
        coffee: 'Cà phê',
        tea: 'Trà',
        milkTea: 'Trà sữa',
        juice: 'Nước ép',
        smoothie: 'Sinh tố',
        detox: 'Detox',
        soda: 'Soda',
        yaourt: 'Sữa chua',
        snacks: 'Ăn vặt',
        other: 'Khác'
      },
      cart: {
        title: 'Đơn hiện tại',
        empty: 'Giỏ hàng đang trống',
        table: 'Số bàn',
        total: 'Tổng cộng',
        placeOrder: 'Đặt đơn',
        clear: 'Xóa hết',
        selectPrice: 'Chọn cỡ'
      }
    },
    barista: {
      title: 'Màn hình Pha chế',
      tabs: {
        orders: 'Đơn hàng',
        summary: 'Tổng hợp',
        history: 'Lịch sử'
      },
      status: {
        pending: 'Chờ xử lý',
        preparing: 'Đang làm',
        ready: 'Hoàn thành',
        delivered: 'Đã giao'
      },
      orderCard: {
        table: 'Bàn',
        start: 'Bắt đầu làm',
        ready: 'Báo xong',
        delivered: 'Đã giao',
        completed: 'Tất cả đơn đã xong!'
      },
      history: {
        export: 'Xuất Excel',
        noOrders: 'Không có đơn hàng nào',
        table: {
          order: 'Mã đơn',
          date: 'Ngày',
          table: 'Bàn',
          items: 'Món',
          total: 'Tổng',
          status: 'Trạng thái',
          staff: 'Nhân viên',
          paid: 'Thanh toán'
        }
      },
      summary: {
        title: 'Món cần làm',
        subtitle: 'Tổng hợp các món đang chờ pha chế',
        markAllDone: 'Xong',
        noItems: 'Hiện không có món nào chờ.'
      }
    },
    owner: {
      title: 'Quản lý Cửa hàng',
      tabs: {
        dashboard: 'Thống kê',
        inventory: 'Kho / Menu',
        staff: 'Nhân sự',
        history: 'Lịch sử đơn'
      },
      dashboard: {
        revenue: 'Tổng doanh thu',
        orders: 'Tổng đơn hàng',
        avgOrder: 'Giá trị TB đơn',
        trend: 'Biểu đồ doanh thu'
      },
      inventory: {
        title: 'Quản lý Menu & Kho',
        seed: 'Tạo dữ liệu mẫu',
        add: 'Thêm món',
        manageCategories: 'Quản lý danh mục',
        available: 'Đang bán',
        outOfStock: 'Hết món',
        edit: 'Sửa',
        form: {
          name: 'Tên món',
          price: 'Giá (VD: 15 hoặc 15-20)',
          category: 'Danh mục'
        }
      },
      staff: {
        title: 'Quản lý Nhân sự',
        user: 'Nhân viên',
        role: 'Vai trò',
        actions: 'Thao tác',
        pending: 'Chờ duyệt',
        active: 'Đang làm việc',
        inactive: 'Đã nghỉ việc',
        approve: 'Duyệt',
        deactivate: 'Thôi việc',
        table: {
          user: 'Nhân viên',
          role: 'Vai trò',
          actions: 'Thao tác'
        }
      },
      history: {
        title: 'Lịch sử đơn hàng',
        export: 'Xuất Excel',
        modification: 'Lịch sử thay đổi'
      },
      modal: {
        edit: 'Sửa món',
        new: 'Thêm món mới',
        name: 'Tên món',
        price: 'Giá',
        category: 'Danh mục',
        available: 'Đang bán',
        save: 'Lưu',
        update: 'Cập nhật'
      }
    },
    auth: {
      title: 'Cheese Lab POS',
      signInPrompt: 'Vui lòng đăng nhập để sử dụng hệ thống.',
      signInButton: 'Đăng nhập với Google',
      loading: 'Đang tải...'
    },
    error: {
      title: 'Đã xảy ra lỗi',
      message: 'Hệ thống gặp sự cố không mong muốn.',
      button: 'Tải lại trang'
    },
    chat: {
      title: 'Cheese Lab AI',
      online: 'Luôn trực tuyến',
      placeholder: 'Bạn cần giúp gì...',
      welcome: 'Xin chào {name}! Mình là trợ lý AI. Mình có thể giúp gì cho bạn hôm nay?'
    },
    settings: {
      title: 'Cài đặt',
      language: 'Ngôn ngữ',
      theme: 'Giao diện',
      light: 'Sáng',
      dark: 'Tối',
      english: 'Tiếng Anh',
      vietnamese: 'Tiếng Việt',
      profile: 'Thông tin tài khoản',
      role: 'Vai trò',
      email: 'Email'
    }
  }
};
