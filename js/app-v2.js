// --- Clear Old Service Workers / PWA Caches ---
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (let registration of registrations) {
      registration.unregister().then(() => {
        if (window.caches) {
          caches.keys().then(names => {
            for (let name of names) caches.delete(name);
          });
        }
        window.location.reload();
      });
    }
  });
}

// --- Application State ---
let cart = [];
let activeCategory = "All";
let activeBrand = "All";
let searchQuery = "";
let selectedUnits = {}; // productId -> 'case' or 'pc'

// Configurable WhatsApp Number (Country code + Number without '+')
const WHATSAPP_RECIPIENT = "919849582606"; 

// --- Initialize App ---
document.addEventListener("DOMContentLoaded", () => {
  initCategories();
  initBrands();
  loadCartFromStorage();
  renderProducts();
  setupEventListeners();
  checkAbandonedCartRecovery();
  initDarkMode();
  initStatsCounter();
});

// --- Local Storage Management ---
function saveCartToStorage() {
  localStorage.setItem("sja_cart", JSON.stringify(cart));
}

function loadCartFromStorage() {
  const savedCart = localStorage.getItem("sja_cart");
  if (savedCart) {
    try {
      cart = JSON.parse(savedCart);
      updateCartUI();
    } catch (e) {
      console.error("Error parsing saved cart data:", e);
      cart = [];
    }
  }
}

// --- Abandoned Cart Recovery (LocalStorage Banner) ---
function checkAbandonedCartRecovery() {
  const recoveryBanner = document.getElementById("recovery-banner");
  if (cart.length > 0 && recoveryBanner) {
    // Show banner after a slight delay
    setTimeout(() => {
      recoveryBanner.style.display = "block";
    }, 1000);
  }
}

function closeRecoveryBanner() {
  const recoveryBanner = document.getElementById("recovery-banner");
  if (recoveryBanner) {
    recoveryBanner.style.display = "none";
  }
}

// --- UI Initialization ---
function initCategories() {
  // Desktop Category List
  const desktopList = document.getElementById("desktop-category-list");
  if (desktopList) {
    desktopList.innerHTML = `
      <li>
        <button class="category-btn active" data-category="All">
          All Categories
        </button>
      </li>
    ` + CATEGORIES.map((cat, idx) => `
      <li>
        <button class="category-btn" data-category="${idx}">
          ${cat}
        </button>
      </li>
    `).join('');
  }

  // Mobile Category Scroll Wrapper
  const mobileWrapper = document.getElementById("mobile-category-list");
  if (mobileWrapper) {
    mobileWrapper.innerHTML = `
      <button class="mobile-category-pill active" data-category="All">All Categories</button>
    ` + CATEGORIES.map((cat, idx) => `
      <button class="mobile-category-pill" data-category="${idx}">${cat}</button>
    `).join('');
  }
}

function initBrands() {
  const brandsSlider = document.getElementById("brands-slider");
  if (brandsSlider) {
    brandsSlider.innerHTML = `
      <button class="brand-pill active" data-brand="All">All Brands</button>
    ` + BRANDS.map(brand => `
      <button class="brand-pill" data-brand="${brand}">${brand}</button>
    `).join('');
  }
}

// --- B2B Case Packaging Helper ---
function getCaseSize(product) {
  const name = product.name.toLowerCase();
  const category = product.category.toLowerCase();
  const brand = product.brand.toLowerCase();

  if (brand === "ashika" || name.includes("agarbatti") || name.includes("dhoop")) {
    return "50 Pkt/Case";
  }
  if (brand === "denver" || name.includes("deodorant") || name.includes("perfume")) {
    return "24 Pcs/Case";
  }
  if (brand === "dukes" || name.includes("waffy") || name.includes("cookie") || name.includes("biscuit")) {
    return "36 Pcs/Case";
  }
  if (category.includes("soap") || name.includes("soap") || name.includes("bar") || name.includes("scrub")) {
    return "48 Pcs/Case";
  }
  if (name.includes("powder") || name.includes("paste") || name.includes("masala")) {
    return "24 Pkt/Case";
  }
  if (name.includes("vermicelli") || name.includes("seviyan") || name.includes("sevai")) {
    return "24 Pkt/Case";
  }
  return "24 Pcs/Case";
}

function getCaseCount(product) {
  const caseStr = getCaseSize(product);
  const match = caseStr.match(/^(\d+)/);
  return match ? parseInt(match[1]) : 24;
}

// --- Product Rendering & Fallback System ---
function renderProducts() {
  const productsGrid = document.getElementById("products-grid");
  const resultsCount = document.getElementById("results-count");
  if (!productsGrid) return;

  // Filter products based on search query, category, and brand
  const filteredProducts = PRODUCTS_DATA.filter(product => {
    const matchesCategory = activeCategory === "All" || product.category === activeCategory;
    const matchesBrand = activeBrand === "All" || product.brand === activeBrand;
    
    const searchString = `${product.name} ${product.brand} ${product.category}`.toLowerCase();
    const matchesSearch = searchString.includes(searchQuery.toLowerCase());
    
    return matchesCategory && matchesBrand && matchesSearch;
  });

  // Update counts
  if (resultsCount) {
    resultsCount.textContent = `Showing ${filteredProducts.length} product${filteredProducts.length === 1 ? '' : 's'}`;
  }

  if (filteredProducts.length === 0) {
    productsGrid.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24">
          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        <h3>No products found</h3>
        <p>Try searching for a different keyword or removing filters.</p>
      </div>
    `;
    return;
  }

  productsGrid.innerHTML = filteredProducts.map(product => {
    const cartItem = cart.find(item => item.id === product.id);
    const quantity = cartItem ? cartItem.qty : 0;
    const itemUnit = cartItem ? cartItem.unit : (selectedUnits[product.id] || 'case');
    
    // Double-fallback image loading: Custom path -> default ID-based filename -> color gradient
    const imagePath = (product.image || `images/products/${product.id}.jpg`) + '?v=2';
    const imageHTML = `<img src="${imagePath}" alt="${product.name}" class="product-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`;
    
    const fallbackHTML = `
      <div class="product-image-fallback" style="background: ${product.fallbackColor || 'linear-gradient(135deg, #2a5298, #1e3c72)'}; display: none;">
        <span class="fallback-brand-icon">${product.brand.charAt(0)}</span>
        <span class="fallback-category-name">${product.category}</span>
      </div>
    `;

    return `
      <div class="product-card" data-id="${product.id}">
        <div class="product-image-container" onclick="openQuickView('${product.id}')" style="cursor:pointer">
          ${imageHTML}
          ${fallbackHTML}
        </div>
        <div class="product-info">
          <div class="product-brand-row">
            <span class="product-brand-text">${product.brand}</span>
            <span class="brand-category-divider">·</span>
            <span class="product-category-text">${product.category}</span>
          </div>
          <h3 class="product-title" title="${product.name}">${product.name}</h3>
          <div class="product-packaging-row" style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
            <span class="product-pack-size">
              ${product.packSize}
            </span>
            <span class="product-case-size">
              ${getCaseSize(product)}
            </span>
          </div>
          <div class="product-pricing" style="margin-bottom: 1.15rem; margin-top: auto;">
            <span class="wholesale-price" style="font-size: 0.85rem; font-weight: 600; color: var(--text-light); background-color: var(--bg-surface); padding: 0.3rem 0.6rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); display: inline-flex; align-items: center; gap: 0.25rem;">
              <svg style="width: 14px; height: 14px; fill: var(--text-light);" viewBox="0 0 24 24">
                <path d="M21 15c0-4.62-3.5-8.28-8-8.91V5c0-.55-.45-1-1-1s-1 .45-1 1v1.09C6.5 6.72 3 10.38 3 15c0 .55.45 1 1 1s1-.45 1-1c0-3.86 3.14-7 7-7s7 3.14 7 7c0 .55.45 1 1 1s1-.45 1-1zM12 18c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
              </svg>
              Price on Enquiry
            </span>
          </div>
          
          <div class="add-to-cart-container" style="display: flex; flex-direction: column; gap: 0.5rem; width: 100%;">
            <div class="unit-selector">
              <button class="unit-btn ${itemUnit === 'case' ? 'active' : ''}" onclick="event.stopPropagation(); setProductUnit('${product.id}', 'case')">Cases</button>
              <button class="unit-btn ${itemUnit === 'pc' ? 'active' : ''}" onclick="event.stopPropagation(); setProductUnit('${product.id}', 'pc')">Loose Pcs</button>
            </div>
            ${quantity === 0 ? `
              <button class="add-to-cart-btn" onclick="addToCart('${product.id}')">
                <svg style="width: 16px; height: 16px; fill: currentColor;" viewBox="0 0 24 24">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
                Add to enquiry
              </button>
            ` : `
              <div class="quantity-selector">
                <button class="qty-btn" onclick="updateQty('${product.id}', -1)">−</button>
                <span class="qty-display">${quantity} ${itemUnit === 'case' ? 'Case' + (quantity === 1 ? '' : 's') : 'Pc' + (quantity === 1 ? '' : 's')}</span>
                <button class="qty-btn" onclick="updateQty('${product.id}', 1)">+</button>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Initialize scroll entrance animations for newly rendered cards
  initScrollAnimations();
}

function addToCart(productId) {
  const product = findProductById(productId);
  if (!product) return;

  const unit = selectedUnits[productId] || 'case';
  const existingItem = cart.find(item => item.id === productId);
  if (existingItem) {
    existingItem.qty += 1;
    existingItem.unit = unit; // sync with current selection
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      brand: product.brand,
      wholesalePrice: product.wholesalePrice,
      packSize: product.packSize,
      fallbackColor: product.fallbackColor,
      qty: 1,
      unit: unit
    });
  }
  
  saveCartToStorage();
  updateCartUI();
  renderProducts();
}

function setProductUnit(productId, unit) {
  selectedUnits[productId] = unit;
  
  const cartItem = cart.find(item => item.id === productId);
  if (cartItem) {
    cartItem.unit = unit;
    saveCartToStorage();
    updateCartUI();
  }
  
  renderProducts();
}

function updateQty(productId, delta) {
  const cartItem = cart.find(item => item.id === productId);
  if (!cartItem) return;

  cartItem.qty += delta;
  
  if (cartItem.qty <= 0) {
    cart = cart.filter(item => item.id !== productId);
  }

  saveCartToStorage();
  updateCartUI();
  renderProducts();
}

function removeCartItem(productId) {
  cart = cart.filter(item => item.id !== productId);
  saveCartToStorage();
  updateCartUI();
  renderProducts();
}

function updateCartUI() {
  const cartCounts = document.querySelectorAll(".cart-count-badge");
  const cartItemsList = document.getElementById("cart-items-list");
  const whatsappBtn = document.getElementById("whatsapp-submit-btn");
  const cartTotalItems = document.getElementById("cart-total-items");

  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

  // Update badges
  cartCounts.forEach(badge => {
    badge.textContent = totalItems;
    badge.style.display = totalItems > 0 ? "flex" : "none";
  });

  // Enable/Disable checkout button
  if (whatsappBtn) {
    whatsappBtn.disabled = cart.length === 0;
  }

  // Render total items in summary
  if (cartTotalItems) {
    cartTotalItems.textContent = `${totalItems} item${totalItems === 1 ? '' : 's'}`;
  }

  // Render items list inside drawer
  if (!cartItemsList) return;

  if (cart.length === 0) {
    cartItemsList.innerHTML = `
      <div style="text-align: center; color: var(--text-light); padding: 3rem 1rem;">
        <svg style="width: 48px; height: 48px; fill: var(--text-muted); margin-bottom: 0.75rem;" viewBox="0 0 24 24">
          <path d="M15.55 13c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.37-.66-.11-1.48-.87-1.48H5.21l-.94-2H1v2h2l3.6 7.59-1.35 2.44C4.52 15.37 5.48 17 7 17h12v-2H7l1.1-2h7.45zM6.16 5h12.15l-2.76 5H8.53L6.16 5zM7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2s.9 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
        </svg>
        <p>Your wholesale enquiry cart is empty.</p>
      </div>
    `;
    return;
  }

  cartItemsList.innerHTML = cart.map(item => `
    <div class="cart-item-row">
      <div class="cart-item-img-placeholder" style="background: ${item.fallbackColor || 'var(--primary)'}">
        ${item.brand.charAt(0)}
      </div>
      <div class="cart-item-detail">
        <h4 class="cart-item-name">${item.name}</h4>
        <div class="cart-item-meta">${item.brand} | ${item.packSize}</div>
        <div class="cart-item-pricing">
          <span class="cart-item-cost" style="font-size: 0.85rem; color: var(--text-light);">Quantity: <strong>${item.qty} ${item.unit === 'case' ? 'Case' + (item.qty === 1 ? '' : 's') : 'Pc' + (item.qty === 1 ? '' : 's')}</strong></span>
          
          <div class="cart-qty-selector">
            <button class="cart-qty-btn" onclick="updateQty('${item.id}', -1)">−</button>
            <span class="cart-qty-val" style="min-width: 32px;">${item.qty} ${item.unit === 'case' ? 'Cs' : 'Pc'}</span>
            <button class="cart-qty-btn" onclick="updateQty('${item.id}', 1)">+</button>
          </div>
        </div>
      </div>
      <button class="remove-cart-item-btn" onclick="removeCartItem('${item.id}')" title="Remove item">
        <svg style="width: 18px; height: 18px; fill: currentColor;" viewBox="0 0 24 24">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>
  `).join('');
}

// --- WhatsApp checkout deep link generator ---
function sendOrderOnWhatsApp() {
  const shopNameInput = document.getElementById("shop-name");
  const shopLocationInput = document.getElementById("shop-location");
  
  const shopName = shopNameInput ? shopNameInput.value.trim() : "";
  const shopLocation = shopLocationInput ? shopLocationInput.value.trim() : "";

  if (!shopName) {
    alert("Please enter your Shop Name to proceed with the WhatsApp enquiry.");
    if (shopNameInput) shopNameInput.focus();
    return;
  }

  // Build formatted text message
  let msg = `*Sri Jyothi Agencies - Wholesale Order Enquiry*\n`;
  msg += `-------------------------------------------\n`;
  msg += `*Shop Name:* ${shopName}\n`;
  if (shopLocation) {
    msg += `*Location/Area:* ${shopLocation}\n`;
  }
  msg += `-------------------------------------------\n\n`;
  msg += `*Requested Products list:*\n`;

  cart.forEach((item, index) => {
    const product = findProductById(item.id);
    const unitLabel = item.unit === 'case' ? (item.qty === 1 ? 'Case' : 'Cases') : (item.qty === 1 ? 'Pc' : 'Pcs');
    if (item.unit === 'case' && product) {
      const caseSizeVal = getCaseCount(product);
      const totalPcs = item.qty * caseSizeVal;
      msg += `${index + 1}. ${item.name} (${item.packSize})\n`;
      msg += `   Qty: *${item.qty} ${unitLabel}* (Total ${totalPcs} Pcs)\n`;
    } else {
      msg += `${index + 1}. ${item.name} (${item.packSize})\n`;
      msg += `   Qty: *${item.qty} ${unitLabel}*\n`;
    }
  });

  msg += `\n-------------------------------------------\n`;
  msg += `*Pricing & Discounts:* To be finalized in WhatsApp chat.\n`;
  msg += `-------------------------------------------\n`;
  msg += `Sent via Sri Jyothi Agencies Digital Catalogue.`;

  // URL encode message text
  const encodedText = encodeURIComponent(msg);
  const whatsappUrl = `https://wa.me/${WHATSAPP_RECIPIENT}?text=${encodedText}`;

  // Redirect client to WhatsApp
  window.open(whatsappUrl, "_blank");

  // Optional: clear cart since the order inquiry has been initiated
  cart = [];
  saveCartToStorage();
  updateCartUI();
  renderProducts();
  
  // Close the cart drawer
  toggleCartDrawer(false);
  closeRecoveryBanner();

  // Clear inputs
  if (shopNameInput) shopNameInput.value = "";
  if (shopLocationInput) shopLocationInput.value = "";
  
  alert("Order enquiry forwarded to WhatsApp. Opening chat now...");
}

// --- Event Handlers & Drawers ---
function toggleCartDrawer(open) {
  const drawer = document.getElementById("cart-drawer");
  const backdrop = document.getElementById("cart-drawer-backdrop");
  
  if (open) {
    if (drawer) drawer.classList.add("open");
    if (backdrop) backdrop.classList.add("open");
  } else {
    if (drawer) drawer.classList.remove("open");
    if (backdrop) backdrop.classList.remove("open");
  }
}

function setupEventListeners() {
  // Search Listeners (Header search + Mobile search)
  const headerSearch = document.getElementById("header-search");
  const mobileSearch = document.getElementById("mobile-search");

  const handleSearchInput = (e) => {
    searchQuery = e.target.value;
    renderProducts();
  };

  if (headerSearch) headerSearch.addEventListener("input", handleSearchInput);
  if (mobileSearch) mobileSearch.addEventListener("input", handleSearchInput);

  // Category Filtering Listeners (Delegation)
  const categoryFilters = [
    document.getElementById("desktop-category-list"),
    document.getElementById("mobile-category-list")
  ];

  categoryFilters.forEach(container => {
    if (container) {
      container.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;

        const categoryVal = btn.getAttribute("data-category");
        if (categoryVal) {
          if (categoryVal === "All") {
            activeCategory = "All";
          } else {
            const idx = parseInt(categoryVal);
            activeCategory = CATEGORIES[idx];
          }
          
          // Sync active class on all buttons and auto-scroll mobile pills into center view
          document.querySelectorAll("[data-category]").forEach(el => {
            const isActive = el.getAttribute("data-category") === categoryVal;
            el.classList.toggle("active", isActive);
            if (isActive && el.classList.contains("mobile-category-pill")) {
              try {
                el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
              } catch (err) {
                try {
                  el.scrollIntoView(false);
                } catch (e) {}
              }
            }
          });

          renderProducts();
        }
      });
    }
  });

  // Brand Filtering Listeners (Delegation)
  const brandContainer = document.getElementById("brands-slider");
  if (brandContainer) {
    brandContainer.addEventListener("click", (e) => {
      const pill = e.target.closest("button");
      if (!pill) return;

      const brand = pill.getAttribute("data-brand");
      if (brand) {
        activeBrand = brand;

        // Sync active class and auto-scroll active brand pill into center view
        document.querySelectorAll("[data-brand]").forEach(el => {
          const isActive = el.getAttribute("data-brand") === brand;
          el.classList.toggle("active", isActive);
          if (isActive && el.classList.contains("brand-pill")) {
            try {
              el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            } catch (err) {
              try {
                el.scrollIntoView(false);
              } catch (e) {}
            }
          }
        });

        renderProducts();
      }
    });
  }

  // Cart Drawer open/close hooks
  const openCartBtn = document.getElementById("open-cart-btn");
  const floatingCartBtn = document.getElementById("floating-cart-btn");
  const closeCartBtn = document.getElementById("close-cart-btn");
  const backdrop = document.getElementById("cart-drawer-backdrop");

  if (openCartBtn) openCartBtn.addEventListener("click", () => toggleCartDrawer(true));
  if (floatingCartBtn) floatingCartBtn.addEventListener("click", () => toggleCartDrawer(true));
  if (closeCartBtn) closeCartBtn.addEventListener("click", () => toggleCartDrawer(false));
  if (backdrop) backdrop.addEventListener("click", () => toggleCartDrawer(false));

  // Form submit intercept
  const form = document.getElementById("checkout-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      sendOrderOnWhatsApp();
    });
  }

  // Quick-View Modal close listeners
  const closeQvBtn = document.getElementById("close-quick-view");
  const qvBackdrop = document.getElementById("quick-view-backdrop");
  if (closeQvBtn) closeQvBtn.addEventListener("click", closeQuickView);
  if (qvBackdrop) qvBackdrop.addEventListener("click", closeQuickView);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeQuickView();
  });
}

// --- Dark Mode Toggle ---
function initDarkMode() {
  const savedTheme = localStorage.getItem('sja_theme');
  if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  const toggleBtn = document.getElementById('dark-mode-toggle');
  if (toggleBtn) {
    // Set initial icon
    toggleBtn.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';

    toggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? '' : 'dark';

      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('sja_theme', newTheme);

      toggleBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    });
  }
}

// --- Scroll Entrance Animations (Intersection Observer) ---
function initScrollAnimations() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const animationObserver = new IntersectionObserver((entries) => {
    // Group entries that are intersecting for staggered delay
    const visibleEntries = entries.filter(entry => entry.isIntersecting);
    visibleEntries.forEach((entry, index) => {
      entry.target.style.transitionDelay = `${index * 0.08}s`;
      entry.target.classList.add('animate-in');
      animationObserver.unobserve(entry.target);
    });
  }, observerOptions);

  // Observe product cards
  document.querySelectorAll('.product-card').forEach(card => {
    if (!card.classList.contains('animate-in')) {
      animationObserver.observe(card);
    }
  });

  // Observe stat items
  document.querySelectorAll('.stat-item').forEach(item => {
    if (!item.classList.contains('animate-in')) {
      animationObserver.observe(item);
    }
  });

  // Observe trust cards
  document.querySelectorAll('.trust-card').forEach(card => {
    if (!card.classList.contains('animate-in')) {
      animationObserver.observe(card);
    }
  });
}

// --- Animated Stats Counter ---
let statsAnimated = false;

function initStatsCounter() {
  const statsSection = document.getElementById('stats-section');
  if (!statsSection) return;

  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !statsAnimated) {
        statsAnimated = true;
        animateAllStats();
        statsObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  statsObserver.observe(statsSection);
}

function animateAllStats() {
  const statNumbers = document.querySelectorAll('.stat-number');

  statNumbers.forEach(el => {
    const target = parseInt(el.getAttribute('data-target'), 10);
    const suffix = el.getAttribute('data-suffix') || '';
    const duration = 2000; // 2 seconds
    const startTime = performance.now();

    function updateCounter(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic for smooth deceleration
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.floor(easedProgress * target);

      el.textContent = currentValue + suffix;

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      } else {
        el.textContent = target + suffix;
      }
    }

    requestAnimationFrame(updateCounter);
  });
}

// --- Product Quick-View Modal ---
function openQuickView(productId) {
  const product = findProductById(productId);
  if (!product) return;

  const modal = document.getElementById('quick-view-modal');
  const backdrop = document.getElementById('quick-view-backdrop');
  if (!modal) return;

  // Build image with fallback
  const imagePath = (product.image || `images/products/${product.id}.jpg`) + '?v=2';
  const fallbackBg = product.fallbackColor || 'linear-gradient(135deg, #2a5298, #1e3c72)';

  // Populate modal content
  const modalContent = modal.querySelector('.quick-view-content') || modal;

  modalContent.innerHTML = `
    <div class="qv-image-section">
      <img src="${imagePath}" alt="${product.name}" class="qv-product-img"
           onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
      <div class="qv-image-fallback" style="background: ${fallbackBg}; display: none;">
        <span class="fallback-brand-icon">${product.brand.charAt(0)}</span>
        <span class="fallback-category-name">${product.category}</span>
      </div>
    </div>
    <div class="qv-details-section">
      <span class="qv-brand">${product.brand}</span>
      <h2 class="qv-product-name">${product.name}</h2>
      <span class="qv-category">${product.category}</span>
      <span class="qv-pack-size">Pack Size: ${product.packSize}</span>
      <p class="qv-description">${product.description || 'No description available.'}</p>
      <button class="add-to-cart-btn qv-add-btn" onclick="addToCart('${product.id}'); closeQuickView();">
        <svg style="width: 16px; height: 16px; fill: currentColor;" viewBox="0 0 24 24">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
        Add to Enquiry
      </button>
    </div>
  `;

  modal.classList.add('open');
  if (backdrop) backdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeQuickView() {
  const modal = document.getElementById('quick-view-modal');
  const backdrop = document.getElementById('quick-view-backdrop');

  if (modal) modal.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
  document.body.style.overflow = '';
}

// --- Back to Top Button Logic ---
document.addEventListener("DOMContentLoaded", () => {
  const backToTopBtn = document.getElementById("back-to-top");
  if (backToTopBtn) {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 400) {
        backToTopBtn.classList.add("visible");
      } else {
        backToTopBtn.classList.remove("visible");
      }
    });

    backToTopBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
});
