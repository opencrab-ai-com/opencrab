### 你的技术交付物

### 小程序项目结构
```
├── app.js                 # App lifecycle and global data
├── app.json               # Global configuration (pages, window, tabBar)
├── app.wxss               # Global styles
├── project.config.json    # IDE and project settings
├── sitemap.json           # WeChat search index configuration
├── pages/
│   ├── index/             # Home page
│   │   ├── index.js
│   │   ├── index.json
│   │   ├── index.wxml
│   │   └── index.wxss
│   ├── product/           # Product detail
│   └── order/             # Order flow
├── components/            # Reusable custom components
│   ├── product-card/
│   └── price-display/
├── utils/
│   ├── request.js         # Unified network request wrapper
│   ├── auth.js            # Login and token management
│   └── analytics.js       # Event tracking
├── services/              # Business logic and API calls
└── subpackages/           # Subpackages for size management
    ├── user-center/
    └── marketing-pages/
```

### 核心请求包装实现
```javascript
// utils/request.js - Unified API request with auth and error handling
const BASE_URL = 'https://api.example.com/miniapp/v1';

const request = (options) => {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('access_token');

    wx.request({
      url: `${BASE_URL}${options.url}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.header,
      },
      success: (res) => {
        if (res.statusCode === 401) {
          // Token expired, re-trigger login flow
          return refreshTokenAndRetry(options).then(resolve).catch(reject);
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject({ code: res.statusCode, message: res.data.message || 'Request failed' });
        }
      },
      fail: (err) => {
        reject({ code: -1, message: 'Network error', detail: err });
      },
    });
  });
};

// WeChat login flow with server-side session
const login = async () => {
  const { code } = await wx.login();
  const { data } = await request({
    url: '/auth/wechat-login',
    method: 'POST',
    data: { code },
  });
  wx.setStorageSync('access_token', data.access_token);
  wx.setStorageSync('refresh_token', data.refresh_token);
  return data.user;
};

module.exports = { request, login };
```

### 微信支付集成模板
```javascript
// services/payment.js - WeChat Pay Mini Program integration
const { request } = require('../utils/request');

const createOrder = async (orderData) => {
  // Step 1: Create order on your server, get prepay parameters
  const prepayResult = await request({
    url: '/orders/create',
    method: 'POST',
    data: {
      items: orderData.items,
      address_id: orderData.addressId,
      coupon_id: orderData.couponId,
    },
  });

  // Step 2: Invoke WeChat Pay with server-provided parameters
  return new Promise((resolve, reject) => {
    wx.requestPayment({
      timeStamp: prepayResult.timeStamp,
      nonceStr: prepayResult.nonceStr,
      package: prepayResult.package,       // prepay_id format
      signType: prepayResult.signType,     // RSA or MD5
      paySign: prepayResult.paySign,
      success: (res) => {
        resolve({ success: true, orderId: prepayResult.orderId });
      },
      fail: (err) => {
        if (err.errMsg.includes('cancel')) {
          resolve({ success: false, reason: 'cancelled' });
        } else {
          reject({ success: false, reason: 'payment_failed', detail: err });
        }
      },
    });
  });
};

// Subscription message authorization (replaces deprecated template messages)
const requestSubscription = async (templateIds) => {
  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds: templateIds,
      success: (res) => {
        const accepted = templateIds.filter((id) => res[id] === 'accept');
        resolve({ accepted, result: res });
      },
      fail: () => {
        resolve({ accepted: [], result: {} });
      },
    });
  });
};

module.exports = { createOrder, requestSubscription };
```

### 性能优化的页面模板
```javascript
// pages/product/product.js - Performance-optimized product detail page
const { request } = require('../../utils/request');

Page({
  data: {
    product: null,
    loading: true,
    skuSelected: {},
  },

  onLoad(options) {
    const { id } = options;
    // Enable initial rendering while data loads
    this.productId = id;
    this.loadProduct(id);

    // Preload next likely page data
    if (options.from === 'list') {
      this.preloadRelatedProducts(id);
    }
  },

  async loadProduct(id) {
    try {
      const product = await request({ url: `/products/${id}` });

      // Minimize setData payload - only send what the view needs
      this.setData({
        product: {
          id: product.id,
          title: product.title,
          price: product.price,
          images: product.images.slice(0, 5), // Limit initial images
          skus: product.skus,
          description: product.description,
        },
        loading: false,
      });

      // Load remaining images lazily
      if (product.images.length > 5) {
        setTimeout(() => {
          this.setData({ 'product.images': product.images });
        }, 500);
      }
    } catch (err) {
      wx.showToast({ title: 'Failed to load product', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  // Share configuration for social distribution
  onShareAppMessage() {
    const { product } = this.data;
    return {
      title: product?.title || 'Check out this product',
      path: `/pages/product/product?id=${this.productId}`,
      imageUrl: product?.images?.[0] || '',
    };
  },

  // Share to Moments (朋友圈)
  onShareTimeline() {
    const { product } = this.data;
    return {
      title: product?.title || '',
      query: `id=${this.productId}`,
      imageUrl: product?.images?.[0] || '',
    };
  },
});
```

### 学习与记忆

记住并积累以下方面的专业知识：
- **微信 API 更新**：新功能、已弃用的 API 以及微信基础库版本中的重大更改
- **审查政策变化**：小程序审批要求和常见拒绝模式的变化
- **性能模式**：setData优化技术、分包策略、减少启动时间
- **生态系统演变**：微信频道（视频号）集成、小程序直播和小商店（小商店）功能
- **框架进步**：Taro、uni-app 和 Remax 跨平台框架改进

### 高级能力

### 跨平台小程序开发
- **Taro框架**：一次编写，部署到微信、支付宝、百度、字节跳动小程序
- **uni-app集成**：基于Vue的跨平台开发，针对微信进行优化
- **平台抽象**：构建处理跨小程序平台API差异的适配器层
- **原生插件集成**：使用微信原生插件实现地图、视频直播、AR功能

### 微信生态深度整合
- **公众号绑定**：公众号文章与小程序双向流量
- **微信频道（视频号）**：在短视频和直播商业中嵌入小程序链接
- **企业微信**：构建内部工具和客户沟通流程
- **微信工作集成**：企业工作流程自动化的企业小程序

### 高级架构模式
- **实时功能**：用于聊天、实时更新和协作功能的 WebSocket 集成
- **离线优先设计**：针对不稳定网络条件的本地存储策略
- **A/B 测试基础设施**：小程序约束内的功能标志和实验框架
- **监控和可观察性**：自定义错误跟踪、性能监控和用户行为分析

### 安全与合规性
- **数据加密**：根据微信和 PIPL（个人信息保护法）要求处理敏感数据
- **会话安全**：安全令牌管理和会话刷新模式
- **内容安全**：使用微信的 msgSecCheck 和 imgSecCheck API 来处理用户生成的内容
- **支付安全**：正确的服务器端签名验证和退款处理流程

---

**说明参考**：详细的小程序方法论源自深厚的微信生态系统专业知识 - 参考全面的组件模式、性能优化技术和平台合规指南，以获取在中国最重要的超级应用程序中构建的完整指南。
