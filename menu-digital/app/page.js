'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export default function MenuPage() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [productAddonsMap, setProductAddonsMap] = useState({});
  const [allAddonsMap, setAllAddonsMap] = useState({});
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Estado del local (Abierto / Cerrado)
  const [isOpenNow, setIsOpenNow] = useState(false);
  const [isForcedClosed, setIsForcedClosed] = useState(false);

  // Desplegable Horarios
  const [isHoursOpen, setIsHoursOpen] = useState(false);

  // Modal de Producto
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productQuantity, setProductQuantity] = useState(1);
  const [availableAddons, setAvailableAddons] = useState([]);
  const [itemNotes, setItemNotes] = useState('');

  // Estructura por cada unidad
  const [unitsData, setUnitsData] = useState([]);
  const [openUnitIndex, setOpenUnitIndex] = useState(0);

  // Datos Pedido
  const [customerName, setCustomerName] = useState('');
  const [orderType, setOrderType] = useState('Delivery');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');

  const PHONE_NUMBER = '5492234482398';

  const schedule = [
    { day: 'Lunes', open1: '12:00', close1: '15:15', open2: '20:00', close2: '23:15' },
    { day: 'Martes', open1: '12:00', close1: '15:15', open2: '20:00', close2: '23:59' },
    { day: 'Miércoles', open1: '12:00', close1: '15:15', open2: '20:00', close2: '23:15' },
    { day: 'Jueves', open1: '12:00', close1: '15:15', open2: '20:00', close2: '23:15' },
    { day: 'Viernes', open1: '12:00', close1: '15:15', open2: '20:00', close2: '23:15' },
    { day: 'Sábado', open1: '12:00', close1: '15:15', open2: '20:00', close2: '23:15' },
    { day: 'Domingo', open1: '12:00', close1: '15:15', open2: '20:00', close2: '23:15' },
  ];

  // Evaluar si el local está abierto según horarios y freno manual
  const checkIfOpen = useCallback(async () => {
    const { data: config } = await supabase.from('store_config').select('is_forced_closed').eq('id', 1).single();
    
    if (config && config.is_forced_closed) {
      setIsForcedClosed(true);
      setIsOpenNow(false);
      return;
    }

    setIsForcedClosed(false);

    const now = new Date();
    const currentDayIdx = (now.getDay() + 6) % 7;
    const currentSchedule = schedule[currentDayIdx];

    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const parseTimeToMinutes = (timeStr) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    const start1 = parseTimeToMinutes(currentSchedule.open1);
    const end1 = parseTimeToMinutes(currentSchedule.close1);
    const start2 = parseTimeToMinutes(currentSchedule.open2);
    const end2 = parseTimeToMinutes(currentSchedule.close2);

    const isOpenShift1 = currentMinutes >= start1 && currentMinutes <= end1;
    const isOpenShift2 = currentMinutes >= start2 && currentMinutes <= end2;

    setIsOpenNow(isOpenShift1 || isOpenShift2);
  }, []);

  useEffect(() => {
    fetchMenuData();
    checkIfOpen();
    const interval = setInterval(checkIfOpen, 30000);
    return () => clearInterval(interval);
  }, [checkIfOpen]);

  async function fetchMenuData() {
    setLoading(true);
    try {
      const [
        { data: cats },
        { data: prods },
        { data: addonsData },
        { data: prodAddonsData }
      ] = await Promise.all([
        supabase.from('categories').select('*'),
        supabase.from('products').select('*').eq('available', true),
        supabase.from('addons').select('*').eq('available', true),
        supabase.from('product_addons').select('*')
      ]);

      if (cats && cats.length > 0) {
        const customOrder = [
          'sandwiches', 'sanguches', 'sándwiches', 'sandwich',
          'guarniciones', 'guarnicion',
          'pizzas rectangulares', 'pizzas', 'pizza',
          'empanadas', 'empanada',
          'ensaladas', 'ensalada',
          'bebidas', 'bebida',
          'postres', 'postre'
        ];

        const sortedCats = [...cats].sort((a, b) => {
          const nameA = a.name.toLowerCase().trim();
          const nameB = b.name.toLowerCase().trim();

          let indexA = customOrder.findIndex((item) => nameA.includes(item));
          let indexB = customOrder.findIndex((item) => nameB.includes(item));

          if (indexA === -1) indexA = 99;
          if (indexB === -1) indexB = 99;

          return indexA - indexB;
        });

        setCategories(sortedCats);
        setSelectedCategory(sortedCats[0].id);
      }

      if (prods) setProducts(prods);

      const addonsById = {};
      if (addonsData) {
        addonsData.forEach((a) => {
          addonsById[a.id] = a;
        });
        setAllAddonsMap(addonsById);
      }

      const map = {};
      if (prodAddonsData) {
        prodAddonsData.forEach((rel) => {
          if (!map[rel.product_id]) map[rel.product_id] = [];
          if (addonsById[rel.addon_id]) {
            map[rel.product_id].push(addonsById[rel.addon_id]);
          }
        });
      }
      setProductAddonsMap(map);

    } catch (err) {
      console.error('Error al cargar datos:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return [];
    return products.filter((p) => p.category_id === selectedCategory);
  }, [products, selectedCategory]);

  const openProductModal = useCallback((product) => {
    setSelectedProduct(product);
    setProductQuantity(1);
    setUnitsData([{ selectedAddons: [], flavorQuantities: {} }]);
    setOpenUnitIndex(0);
    setItemNotes('');

    const addons = productAddonsMap[product.id] || [];
    setAvailableAddons(addons);
  }, [productAddonsMap]);

  const handleQuantityChange = useCallback((newQty) => {
    if (newQty < 1) return;
    setProductQuantity(newQty);

    setUnitsData((prev) => {
      if (newQty > prev.length) {
        const extra = Array.from({ length: newQty - prev.length }, () => ({
          selectedAddons: [],
          flavorQuantities: {}
        }));
        return [...prev, ...extra];
      } else {
        return prev.slice(0, newQty);
      }
    });

    setOpenUnitIndex((prev) => (prev >= newQty ? newQty - 1 : prev));
  }, []);

  const toggleAddonForUnit = useCallback((unitIndex, addon) => {
    setUnitsData((prev) => {
      const updated = [...prev];
      const unit = { ...updated[unitIndex] };
      const exists = unit.selectedAddons.some((a) => a.id === addon.id);

      if (exists) {
        unit.selectedAddons = unit.selectedAddons.filter((a) => a.id !== addon.id);
      } else {
        unit.selectedAddons = [...unit.selectedAddons, addon];
      }

      updated[unitIndex] = unit;
      return updated;
    });
  }, []);

  const updateFlavorQuantityForUnit = useCallback((unitIndex, addonId, delta) => {
    if (!selectedProduct) return;

    setUnitsData((prev) => {
      const updated = [...prev];
      const unit = { ...updated[unitIndex] };
      const flavorMap = { ...unit.flavorQuantities };

      const current = flavorMap[addonId] || 0;
      let next = current + delta;

      const allowRep = selectedProduct.allow_flavor_repetition ?? true;
      const maxFlavorsUnit = selectedProduct.max_flavors || 0;
      const currentUnitTotal = Object.values(flavorMap).reduce((a, b) => a + b, 0);

      if (!allowRep && next > 1) next = 1;
      if (delta > 0 && currentUnitTotal >= maxFlavorsUnit) return prev;

      next = Math.max(0, next);

      if (next === 0) {
        delete flavorMap[addonId];
      } else {
        flavorMap[addonId] = next;
      }

      unit.flavorQuantities = flavorMap;
      updated[unitIndex] = unit;

      const newTotal = Object.values(flavorMap).reduce((a, b) => a + b, 0);
      if (newTotal === maxFlavorsUnit && unitIndex < updated.length - 1) {
        setOpenUnitIndex(unitIndex + 1);
      }

      return updated;
    });
  }, [selectedProduct]);

  const getUnitFlavorsTotal = (unit) => {
    if (!unit || !unit.flavorQuantities) return 0;
    return Object.values(unit.flavorQuantities).reduce((a, b) => a + b, 0);
  };

  const isAllUnitsValid = useCallback(() => {
    if (!selectedProduct) return false;
    if (!selectedProduct.allows_flavor_selection) return true;

    const maxFlavors = selectedProduct.max_flavors || 0;
    return unitsData.every((unit) => getUnitFlavorsTotal(unit) === maxFlavors);
  }, [selectedProduct, unitsData]);

  const calculateTotalPrice = useCallback(() => {
    if (!selectedProduct) return 0;
    const base = Number(selectedProduct.price);

    const addonsTotal = unitsData.reduce((sum, unit) => {
      const unitAddons = unit.selectedAddons.reduce((s, a) => s + Number(a.price), 0);
      return sum + unitAddons;
    }, 0);

    return base * productQuantity + addonsTotal;
  }, [selectedProduct, unitsData, productQuantity]);

  const handleConfirmAddToCart = () => {
    if (!selectedProduct || !isAllUnitsValid()) return;

    const totalPrice = calculateTotalPrice();

    const formattedUnits = unitsData.map((unit) => {
      const flavorsList = Object.entries(unit.flavorQuantities).map(([addonId, qty]) => {
        const addon = availableAddons.find((a) => a.id === addonId) || allAddonsMap[addonId];
        return { name: addon ? addon.name : '', qty };
      });

      return {
        flavors: flavorsList,
        addons: unit.selectedAddons
      };
    });

    const cartItemId = `${selectedProduct.id}-${JSON.stringify(unitsData)}-${itemNotes.trim()}`;

    const cartItem = {
      cartItemId,
      id: selectedProduct.id,
      name: selectedProduct.name,
      basePrice: Number(selectedProduct.price),
      price: totalPrice / productQuantity,
      totalPrice: totalPrice,
      quantity: productQuantity,
      units: formattedUnits,
      notes: itemNotes.trim()
    };

    setCart((prev) => [...prev, cartItem]);
    setSelectedProduct(null);
  };

  const updateQuantityInCart = useCallback((cartItemId, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartItemId === cartItemId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            const unitPrice = item.totalPrice / item.quantity;
            return {
              ...item,
              quantity: newQty,
              totalPrice: unitPrice * newQty
            };
          }
          return item;
        })
        .filter(Boolean)
    );
  }, []);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [cart]);

  const sendWhatsAppOrder = (e) => {
    e.preventDefault();
    if (cart.length === 0 || !customerName) return;

    let text = `*NUEVO PEDIDO - IL CAPO*\n`;
    text += `---------------------------------\n`;
    text += `👤 *Cliente:* ${customerName}\n`;
    text += `🛵 *Tipo:* ${orderType}\n`;
    if (orderType === 'Delivery') {
      text += `📍 *Dirección:* ${address}\n`;
    }
    text += `💳 *Pago:* ${paymentMethod}\n`;
    text += `---------------------------------\n`;
    text += `*DETALLE DEL PEDIDO:*\n`;

    cart.forEach((item) => {
      text += `• ${item.quantity}x ${item.name} ($${item.totalPrice.toLocaleString()})\n`;

      item.units.forEach((u, i) => {
        const parts = [];
        if (u.flavors && u.flavors.length > 0) {
          const fStr = u.flavors.map((f) => f.qty > 1 ? `${f.qty}x ${f.name}` : f.name).join(', ');
          parts.push(`Gustos: ${fStr}`);
        }
        if (u.addons && u.addons.length > 0) {
          const aStr = u.addons.map((a) => a.name).join(', ');
          parts.push(`Extras: ${aStr}`);
        }

        if (parts.length > 0) {
          text += `   ↳ [Unidad ${i + 1}] ${parts.join(' | ')}\n`;
        }
      });

      if (item.notes) {
        text += `   ↳ Nota: "${item.notes}"\n`;
      }
    });

    text += `---------------------------------\n`;
    text += `💰 *TOTAL: $${cartTotal.toLocaleString()}*`;

    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/${PHONE_NUMBER}?text=${encodedText}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-black text-neutral-100 pb-28 font-sans selection:bg-amber-400 selection:text-black">
      
      {/* HEADER PRINCIPAL */}
      <header className="relative w-full h-72 md:h-80 flex items-center justify-center text-center overflow-hidden border-b border-neutral-800 shadow-2xl">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 scale-105"
          style={{ backgroundImage: `url('/il-capo.jpg')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/60 backdrop-blur-[2px]" />
        
        <div className="relative z-10 px-4 max-w-xl mx-auto flex flex-col items-center">
          <span className="text-[10px] md:text-xs font-extrabold tracking-[0.25em] text-amber-400 uppercase bg-neutral-900/90 px-4 py-1 rounded-full border border-amber-400/30 mb-3 backdrop-blur-md shadow-lg">
            Sandwichería
          </span>

          {/* TITULO CON LOGO A LA IZQUIERDA Y AL MISMO TAMAÑO */}
          <div className="flex items-center justify-center gap-3">
            <img
              src="/logo.jpeg"
              alt="Logo Il Capo"
              className="h-12 w-12 md:h-16 md:w-16 object-cover rounded-xl shadow-lg border border-amber-400/30 flex-shrink-0"
            />
            <h1 className="text-4xl md:text-6xl font-black tracking-widest text-white uppercase drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)] leading-none">
              IL CAPO
            </h1>
          </div>

          <p className="text-xs md:text-sm text-neutral-300 font-medium tracking-wide mt-2 drop-shadow-md">
            Sánguches • Pizzas • Empanadas
          </p>
        </div>
      </header>

      {/* HORARIOS Y UBICACIÓN */}
      <section className="max-w-6xl mx-auto px-4 -mt-6 relative z-10">
        <div className="bg-neutral-900/95 border border-neutral-800 rounded-2xl p-4 shadow-2xl backdrop-blur-md grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          
          <div className="w-full">
            <button
              onClick={() => setIsHoursOpen(!isHoursOpen)}
              className="w-full flex items-center justify-between gap-2 text-xs font-medium text-neutral-200 hover:text-white transition-colors bg-neutral-950/80 p-3 rounded-xl border border-neutral-800"
            >
              <div className="flex items-center gap-2 text-left">
                <span className="text-base">🕒</span>
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-neutral-100">Horarios</strong>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isOpenNow
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-red-500/15 text-red-400 border-red-500/30'
                      }`}
                    >
                      {isOpenNow ? 'Abierto' : 'Cerrado'}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    {isForcedClosed ? 'Local cerrado por feriado / reformas' : 'Hoy 12:00 a 15:15 y 20:00 a 23:15'}
                  </p>
                </div>
              </div>
              <span className={`text-[10px] text-neutral-400 transition-transform duration-200 ${isHoursOpen ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>

            {isHoursOpen && (
              <div className="mt-2.5 p-2.5 bg-neutral-950/90 rounded-xl border border-neutral-800 grid gap-1.5 text-xs">
                {schedule.map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-1 px-2 rounded-lg hover:bg-neutral-900">
                    <span className="font-bold text-neutral-300 text-[11px]">{item.day}</span>
                    <span className="text-neutral-400 font-mono text-[10px]">
                      {item.open1} a {item.close1} y {item.open2} a {item.close2 === '23:59' ? '00:00' : item.close2}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="w-full flex flex-col justify-between h-full">
            <div className="mb-2">
              <p className="text-[11px] text-neutral-400 font-medium">Dónde estamos</p>
              <h3 className="text-xs font-bold text-amber-400 flex items-center gap-1">📍 Av. Constitución 5716</h3>
            </div>
            <div className="relative w-full h-24 rounded-xl overflow-hidden border border-neutral-800 shadow-inner group">
              <iframe
                title="Ubicación Il Capo"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3145.4265147986065!2d-57.5612!3d-37.9658!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzc3NTknNTYuOSJTIDU3wrAzMyc0MC4zIlc!5e0!3m2!1ses!2sar!4v1680000000000!5m2!1ses!2sar"
                className="w-full h-full border-0 grayscale opacity-75 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none"
                loading="lazy"
              ></iframe>
              <a
                href="https://maps.google.com/?q=Av.+Constituci%C3%B3n+5716"
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 bg-black/40 hover:bg-black/20 flex items-center justify-center transition-all"
              >
                <span className="bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-[11px] px-3.5 py-1.5 rounded-lg shadow-lg flex items-center gap-1.5 scale-95 hover:scale-100 transition-all">
                  <span>📍</span>
                  <span>Abrir Maps</span>
                </span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* PESTAÑAS DE CATEGORÍAS */}
      <div className="sticky top-0 bg-black/95 backdrop-blur-md shadow-md z-10 py-3.5 border-b border-neutral-800/80 my-4 w-full">
        <div className="flex space-x-2.5 w-full px-4 overflow-x-auto scrollbar-none justify-start md:justify-center max-w-6xl mx-auto">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-2xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center gap-2 border flex-shrink-0 ${
                  isSelected
                    ? 'bg-amber-400 text-black border-amber-400 shadow-lg shadow-amber-400/20 scale-105'
                    : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:bg-neutral-850 hover:border-neutral-700'
                }`}
              >
                <span>{cat.icon || '🏷️'}</span>
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* GRILLA DE PRODUCTOS */}
      <main className="max-w-6xl mx-auto px-4 mt-4">
        {loading ? (
          <div className="text-center py-16">
            <div className="w-9 h-9 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs text-neutral-400">Cargando menú delicioso...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16 text-neutral-500 text-xs">No hay productos disponibles en esta categoría.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="bg-neutral-900/90 border border-neutral-800 p-3.5 rounded-2xl shadow-md flex gap-3 hover:border-neutral-700 transition-all items-center justify-between"
              >
                <img
                  src={product.image_url}
                  alt={product.name}
                  loading="lazy"
                  className="w-20 h-20 md:w-24 md:h-24 object-cover rounded-xl bg-neutral-950 flex-shrink-0 shadow-inner"
                />
                <div className="flex flex-col justify-between flex-1 ml-3 min-w-0 h-full">
                  <div>
                    <h3 className="font-bold text-neutral-100 text-sm leading-snug truncate">{product.name}</h3>
                    <p className="text-xs text-neutral-400 line-clamp-2 mt-1 leading-relaxed">{product.description}</p>
                  </div>
                  <div className="flex justify-between items-center mt-3 gap-2">
                    <span className="font-extrabold text-sm md:text-base text-amber-400 flex-shrink-0">
                      ${Number(product.price).toLocaleString()}
                    </span>
                    <button
                      onClick={() => openProductModal(product)}
                      className="bg-amber-400 hover:bg-amber-300 active:scale-95 text-black text-xs px-3.5 py-1.5 rounded-xl font-extrabold transition-all shadow-md shadow-amber-400/10 flex-shrink-0"
                    >
                      + Agregar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MODAL DE PERSONALIZACIÓN */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/85 z-40 backdrop-blur-sm flex justify-end flex-col animate-fadeIn">
          <div className="bg-neutral-900 border-t border-neutral-800 rounded-t-3xl p-5 max-w-md mx-auto w-full max-h-[92vh] overflow-y-auto text-neutral-100 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start pb-3 border-b border-neutral-800">
                <div className="flex gap-3 items-center">
                  <img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    className="w-14 h-14 object-cover rounded-xl border border-neutral-800"
                  />
                  <div>
                    <h3 className="font-black text-amber-400 text-base leading-snug">{selectedProduct.name}</h3>
                    <p className="text-xs font-bold text-neutral-300 mt-0.5">${Number(selectedProduct.price).toLocaleString()}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedProduct(null)} className="text-neutral-400 hover:text-white font-bold text-xl px-2">
                  ✕
                </button>
              </div>

              <p className="text-xs text-neutral-400 mt-3 leading-relaxed">{selectedProduct.description}</p>

              {/* UNIDADES DESPLEGABLES */}
              <div className="mt-5 space-y-3">
                {unitsData.map((unit, unitIdx) => {
                  const isOpen = openUnitIndex === unitIdx;
                  const unitFlavorsTotal = getUnitFlavorsTotal(unit);
                  const maxFlavors = selectedProduct.max_flavors || 0;
                  const isFlavorMode = selectedProduct.allows_flavor_selection;
                  const isUnitComplete = !isFlavorMode || unitFlavorsTotal === maxFlavors;

                  return (
                    <div
                      key={unitIdx}
                      className="bg-neutral-950/80 border border-neutral-800 rounded-2xl overflow-hidden transition-all shadow-md"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenUnitIndex(isOpen ? -1 : unitIdx)}
                        className="w-full flex items-center justify-between p-3 bg-neutral-950 hover:bg-neutral-900 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-amber-400">
                            {productQuantity > 1 ? `Unidad #${unitIdx + 1}` : 'Personalización'}
                          </span>

                          {isFlavorMode && (
                            <span
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                                isUnitComplete
                                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                  : 'bg-amber-400/15 text-amber-300 border-amber-400/30'
                              }`}
                            >
                              {unitFlavorsTotal} / {maxFlavors}
                            </span>
                          )}
                        </div>

                        <span className={`text-xs text-neutral-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                          ▼
                        </span>
                      </button>

                      {isOpen && (
                        <div className="p-3 border-t border-neutral-800 bg-neutral-900/60 space-y-3">
                          {isFlavorMode ? (
                            <div>
                              <p className="text-[11px] font-semibold text-neutral-400 mb-2">
                                {selectedProduct.allow_flavor_repetition
                                  ? 'Seleccioná los gustos para esta unidad:'
                                  : 'Seleccioná los ingredientes para esta unidad:'}
                              </p>

                              {availableAddons.length === 0 ? (
                                <p className="text-xs text-neutral-500 italic py-1">Sin opciones disponibles.</p>
                              ) : (
                                <div className="grid gap-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                                  {availableAddons.map((addon) => {
                                    const qty = unit.flavorQuantities[addon.id] || 0;
                                    const allowRep = selectedProduct.allow_flavor_repetition ?? true;
                                    const isPlusDisabled = unitFlavorsTotal >= maxFlavors || (!allowRep && qty >= 1);

                                    return (
                                      <div
                                        key={addon.id}
                                        className={`flex justify-between items-center p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                                          qty > 0
                                            ? 'bg-amber-400/10 border-amber-400/80 text-amber-200'
                                            : 'bg-neutral-900 border-neutral-800 text-neutral-300'
                                        }`}
                                      >
                                        <span>{addon.name}</span>
                                        <div className="flex items-center gap-2 bg-black rounded-lg px-2 py-1 border border-neutral-800">
                                          <button
                                            type="button"
                                            onClick={() => updateFlavorQuantityForUnit(unitIdx, addon.id, -1)}
                                            disabled={qty === 0}
                                            className="font-black text-amber-400 disabled:opacity-30 text-sm px-1"
                                          >
                                            -
                                          </button>
                                          <span className="text-xs font-bold w-4 text-center">{qty}</span>
                                          <button
                                            type="button"
                                            onClick={() => updateFlavorQuantityForUnit(unitIdx, addon.id, 1)}
                                            disabled={isPlusDisabled}
                                            className="font-black text-amber-400 disabled:opacity-30 text-sm px-1"
                                          >
                                            +
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <p className="text-[11px] font-semibold text-neutral-400 mb-2">
                                Adicionales para esta unidad:
                              </p>

                              {availableAddons.length === 0 ? (
                                <p className="text-xs text-neutral-500 italic py-1">Sin adicionales para este producto.</p>
                              ) : (
                                <div className="grid gap-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                                  {availableAddons.map((addon) => {
                                    const isSelected = unit.selectedAddons.some((a) => a.id === addon.id);
                                    return (
                                      <button
                                        key={addon.id}
                                        type="button"
                                        onClick={() => toggleAddonForUnit(unitIdx, addon)}
                                        className={`flex justify-between items-center p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                                          isSelected
                                            ? 'bg-amber-400/10 border-amber-400 text-amber-300'
                                            : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-850'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span
                                            className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                                              isSelected ? 'bg-amber-400 border-amber-400 text-black font-black' : 'border-neutral-600'
                                            }`}
                                          >
                                            {isSelected ? '✓' : ''}
                                          </span>
                                          <span>{addon.name}</span>
                                        </div>
                                        <span className="font-bold text-amber-400">
                                          {addon.price > 0 ? `+$${Number(addon.price).toLocaleString()}` : 'Sin costo'}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Aclaraciones */}
              <div className="mt-5">
                <label className="text-xs font-extrabold uppercase tracking-wider text-neutral-400 block mb-1.5">
                  Aclaraciones para el pedido
                </label>
                <input
                  type="text"
                  placeholder="Ej: Sin aderezo, bien fría..."
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-xl text-xs outline-none focus:border-amber-400 text-neutral-100"
                />
              </div>
            </div>

            {/* Controles de Cantidad */}
            <div className="pt-5 border-t border-neutral-800 mt-5 flex gap-3 items-center">
              <div className="flex items-center space-x-2 bg-neutral-950 rounded-xl px-3 py-2 border border-neutral-800">
                <button
                  onClick={() => handleQuantityChange(productQuantity - 1)}
                  className="font-black text-amber-400 hover:text-amber-300 px-1 text-base"
                >
                  -
                </button>
                <span className="text-xs font-bold w-5 text-center text-neutral-100">{productQuantity}</span>
                <button
                  onClick={() => handleQuantityChange(productQuantity + 1)}
                  className="font-black text-amber-400 hover:text-amber-300 px-1 text-base"
                >
                  +
                </button>
              </div>

              <button
                onClick={handleConfirmAddToCart}
                disabled={!isAllUnitsValid()}
                className={`flex-1 font-black py-3 px-4 rounded-xl shadow-lg text-xs flex justify-between items-center transition-all ${
                  isAllUnitsValid()
                    ? 'bg-amber-400 hover:bg-amber-300 text-black shadow-amber-400/20 active:scale-98'
                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed opacity-60'
                }`}
              >
                <span>
                  {!isAllUnitsValid() ? 'Completá todas las unidades' : 'Agregar al Pedido'}
                </span>
                <span>${calculateTotalPrice().toLocaleString()}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOTÓN FLOTANTE CARRITO */}
      {cart.length > 0 && (
        <div className="fixed bottom-5 left-0 right-0 px-4 z-20 max-w-md mx-auto">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-amber-400 hover:bg-amber-300 text-black py-3.5 px-6 rounded-2xl shadow-xl shadow-amber-400/10 flex justify-between items-center font-black text-sm transition-transform active:scale-95"
          >
            <span className="bg-black text-amber-400 px-2.5 py-1 rounded-lg text-xs font-black">
              {cart.reduce((a, b) => a + b.quantity, 0)} ítems
            </span>
            <span>Ver Mi Pedido</span>
            <span>${cartTotal.toLocaleString()}</span>
          </button>
        </div>
      )}

      {/* MODAL / CARRITO DE COMPRAS */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black/85 z-50 backdrop-blur-md flex justify-end flex-col animate-fadeIn">
          <div className="bg-neutral-900 border-t border-neutral-800 rounded-t-3xl p-6 max-w-md mx-auto w-full max-h-[88vh] overflow-y-auto text-neutral-100">
            <div className="flex justify-between items-center pb-4 border-b border-neutral-800">
              <h2 className="text-lg font-black text-amber-400">Tu Pedido</h2>
              <button onClick={() => setIsCartOpen(false)} className="text-neutral-400 hover:text-white font-bold text-xl px-2">
                ✕
              </button>
            </div>

            <div className="py-4 divide-y divide-neutral-800">
              {cart.map((item) => (
                <div key={item.cartItemId} className="flex justify-between items-start py-3">
                  <div className="pr-2">
                    <p className="font-bold text-sm text-neutral-200">{item.name}</p>

                    {item.units &&
                      item.units.map((u, i) => {
                        const hasFlavors = u.flavors && u.flavors.length > 0;
                        const hasAddons = u.addons && u.addons.length > 0;
                        if (!hasFlavors && !hasAddons) return null;

                        return (
                          <div key={i} className="text-[11px] text-amber-300 font-medium mt-0.5">
                            ↳ Unidad #{i + 1}:{' '}
                            {hasFlavors && u.flavors.map((f) => (f.qty > 1 ? `${f.qty}x ${f.name}` : f.name)).join(', ')}
                            {hasFlavors && hasAddons ? ' | Extras: ' : ''}
                            {hasAddons && u.addons.map((a) => a.name).join(', ')}
                          </div>
                        );
                      })}

                    {item.notes && <p className="text-[11px] text-neutral-400 italic mt-0.5">"{item.notes}"</p>}
                    <p className="text-xs text-amber-400 font-semibold mt-1">
                      ${item.totalPrice.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 bg-neutral-950 rounded-xl px-2.5 py-1 border border-neutral-800 flex-shrink-0">
                    <button
                      onClick={() => updateQuantityInCart(item.cartItemId, -1)}
                      className="font-black text-amber-400 hover:text-amber-300 px-1 text-sm"
                    >
                      -
                    </button>
                    <span className="text-xs font-bold w-4 text-center text-neutral-100">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantityInCart(item.cartItemId, 1)}
                      className="font-black text-amber-400 hover:text-amber-300 px-1 text-sm"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={sendWhatsAppOrder} className="space-y-3.5 pt-2">
              <div>
                <label className="text-xs font-semibold text-neutral-400 block mb-1">Tu Nombre *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Juan Pérez"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-xl text-sm outline-none focus:border-amber-400 text-neutral-100"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOrderType('Delivery')}
                  className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl border transition-all ${
                    orderType === 'Delivery'
                      ? 'bg-amber-400 text-black border-amber-400'
                      : 'bg-neutral-950 text-neutral-400 border-neutral-800'
                  }`}
                >
                  🛵 Delivery
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType('Retiro')}
                  className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl border transition-all ${
                    orderType === 'Retiro'
                      ? 'bg-amber-400 text-black border-amber-400'
                      : 'bg-neutral-950 text-neutral-400 border-neutral-800'
                  }`}
                >
                  🛍️ Retiro en local
                </button>
              </div>

              {orderType === 'Delivery' && (
                <div>
                  <label className="text-xs font-semibold text-neutral-400 block mb-1">Dirección de Envío *</label>
                  <input
                    type="text"
                    required
                    placeholder="Calle, Número y Piso"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-xl text-sm outline-none focus:border-amber-400 text-neutral-100"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-neutral-400 block mb-1">Forma de Pago</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-xl text-sm outline-none focus:border-amber-400 text-neutral-100"
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia / Mercado Pago">Transferencia / Mercado Pago</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-3.5 rounded-2xl shadow-lg shadow-emerald-500/10 mt-4 text-sm flex items-center justify-center gap-2"
              >
                <span>Enviar Pedido por WhatsApp 📲</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}