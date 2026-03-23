import { PrismaClient, StoreType, AdapterType, DiscountType, CouponSourceType } from '@prisma/client';

const prisma = new PrismaClient();

// Placeholder bcrypt hashes (cost factor 12) — replace with real hashes in production.
// These represent password "Test@1234" and "Demo@5678" respectively.
const HASH_TEST_USER_1 =
  '$2b$12$placeholder.hash.for.test.user.one.AAAAAAAAAAAAAAAAAAAAAA';
const HASH_TEST_USER_2 =
  '$2b$12$placeholder.hash.for.test.user.two.BBBBBBBBBBBBBBBBBBBBBB';

async function main() {
  console.log('Seeding database...');

  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------
  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      email: 'alice@example.com',
      password_hash: HASH_TEST_USER_1,
      display_name: 'Alice Nguyen',
      default_location_lat: 33.4484,
      default_location_lng: -112.074,
      search_radius_miles: 10,
      preferred_categories: ['GROCERY', 'PHARMACY'],
      notify_price_drops: true,
      notify_deal_alerts: true,
      notify_order_updates: true,
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      password_hash: HASH_TEST_USER_2,
      display_name: 'Bob Martinez',
      default_location_lat: 33.5722,
      default_location_lng: -112.088,
      search_radius_miles: 20,
      preferred_categories: ['CLOTHING'],
      notify_price_drops: false,
      notify_deal_alerts: true,
      notify_order_updates: true,
    },
  });

  console.log(`Created users: ${alice.email}, ${bob.email}`);

  // ---------------------------------------------------------------------------
  // Stores — Phoenix, AZ area
  // ---------------------------------------------------------------------------
  const storesData = [
    {
      name: 'Fry\'s Food & Drug',
      slug: 'frys-food-drug-camelback',
      address: '3020 E Camelback Rd',
      city: 'Phoenix',
      state: 'AZ',
      zip: '85016',
      location_lat: 33.5087,
      location_lng: -112.0191,
      phone: '602-955-1440',
      website_url: 'https://www.frysfood.com',
      store_type: StoreType.GROCERY,
      adapter_type: AdapterType.WEB_SCRAPER,
    },
    {
      name: 'Sprouts Farmers Market',
      slug: 'sprouts-farmers-market-phoenix-central',
      address: '4502 N 7th St',
      city: 'Phoenix',
      state: 'AZ',
      zip: '85014',
      location_lat: 33.5049,
      location_lng: -112.0622,
      phone: '602-279-3791',
      website_url: 'https://www.sprouts.com',
      store_type: StoreType.GROCERY,
      adapter_type: AdapterType.API,
    },
    {
      name: 'H&M Fashion District',
      slug: 'hm-fashion-district-phoenix',
      address: '1 Metrocenter Mall',
      city: 'Phoenix',
      state: 'AZ',
      zip: '85051',
      location_lat: 33.5678,
      location_lng: -112.1019,
      phone: '602-864-4040',
      website_url: 'https://www.hm.com',
      store_type: StoreType.CLOTHING,
      adapter_type: AdapterType.FEED,
    },
    {
      name: 'Old Navy Scottsdale',
      slug: 'old-navy-scottsdale-fashion-square',
      address: '7014 E Camelback Rd',
      city: 'Scottsdale',
      state: 'AZ',
      zip: '85251',
      location_lat: 33.5091,
      location_lng: -111.9267,
      phone: '480-946-7200',
      website_url: 'https://www.oldnavy.com',
      store_type: StoreType.CLOTHING,
      adapter_type: AdapterType.FEED,
    },
    {
      name: 'QuikTrip #1234',
      slug: 'quiktrip-1234-central-phoenix',
      address: '1301 N Central Ave',
      city: 'Phoenix',
      state: 'AZ',
      zip: '85004',
      location_lat: 33.4654,
      location_lng: -112.0735,
      phone: '602-253-8800',
      website_url: 'https://www.quiktrip.com',
      store_type: StoreType.CONVENIENCE,
      adapter_type: AdapterType.MANUAL,
    },
  ];

  const stores: Awaited<ReturnType<typeof prisma.store.upsert>>[] = [];
  for (const s of storesData) {
    const store = await prisma.store.upsert({
      where: { slug: s.slug },
      update: {},
      create: {
        ...s,
        scrape_frequency_minutes: s.adapter_type === AdapterType.MANUAL ? 0 : 360,
        is_active: true,
      },
    });
    stores.push(store);
  }
  console.log(`Created ${stores.length} stores`);

  const [frys, sprouts, hm, oldNavy, qt] = stores;

  // ---------------------------------------------------------------------------
  // Products
  // ---------------------------------------------------------------------------
  const productsData = [
    {
      canonical_name: 'Organic Whole Milk',
      category: 'GROCERY',
      subcategory: 'Dairy',
      unit_of_measure: 'gallon',
      brand: 'Horizon Organic',
      description: 'USDA certified organic whole milk, 1 gallon',
      image_urls: ['https://cdn.example.com/products/horizon-organic-milk.jpg'],
    },
    {
      canonical_name: 'Cage-Free Large Eggs',
      category: 'GROCERY',
      subcategory: 'Dairy',
      unit_of_measure: 'dozen',
      brand: 'Vital Farms',
      description: 'Pasture-raised cage-free large brown eggs, 12 count',
      image_urls: ['https://cdn.example.com/products/vital-farms-eggs.jpg'],
    },
    {
      canonical_name: 'Sourdough Bread',
      category: 'GROCERY',
      subcategory: 'Bakery',
      unit_of_measure: 'loaf',
      brand: 'Dave\'s Killer Bread',
      description: 'Organic sourdough sandwich bread, 24 oz',
      image_urls: ['https://cdn.example.com/products/daves-sourdough.jpg'],
    },
    {
      canonical_name: 'Hass Avocados',
      category: 'GROCERY',
      subcategory: 'Produce',
      unit_of_measure: 'bag',
      brand: 'Organic Girl',
      description: 'Organic Hass avocados, bag of 4',
      image_urls: ['https://cdn.example.com/products/hass-avocados.jpg'],
    },
    {
      canonical_name: 'Baby Spinach',
      category: 'GROCERY',
      subcategory: 'Produce',
      unit_of_measure: '5 oz',
      brand: 'Earthbound Farm',
      description: 'Organic baby spinach, 5 oz container',
      image_urls: ['https://cdn.example.com/products/earthbound-spinach.jpg'],
    },
    {
      canonical_name: 'Women\'s Slim Fit Jeans',
      category: 'CLOTHING',
      subcategory: 'Bottoms',
      unit_of_measure: 'each',
      brand: 'H&M',
      description: 'Women\'s slim fit stretch jeans, mid-rise, sizes 00–16',
      image_urls: ['https://cdn.example.com/products/hm-slim-jeans.jpg'],
    },
    {
      canonical_name: 'Men\'s Classic T-Shirt',
      category: 'CLOTHING',
      subcategory: 'Tops',
      unit_of_measure: 'each',
      brand: 'H&M',
      description: 'Men\'s 100% cotton crew-neck tee, sizes XS–3XL',
      image_urls: ['https://cdn.example.com/products/hm-mens-tshirt.jpg'],
    },
    {
      canonical_name: 'Women\'s Pullover Hoodie',
      category: 'CLOTHING',
      subcategory: 'Outerwear',
      unit_of_measure: 'each',
      brand: 'Old Navy',
      description: 'Women\'s cozy sherpa pullover hoodie, sizes XS–XXL',
      image_urls: ['https://cdn.example.com/products/oldnavy-womens-hoodie.jpg'],
    },
    {
      canonical_name: 'Men\'s Jogger Pants',
      category: 'CLOTHING',
      subcategory: 'Bottoms',
      unit_of_measure: 'each',
      brand: 'Old Navy',
      description: 'Men\'s go-dry performance jogger pants, sizes XS–3XL',
      image_urls: ['https://cdn.example.com/products/oldnavy-mens-joggers.jpg'],
    },
    {
      canonical_name: 'Sparkling Water 12-Pack',
      category: 'GROCERY',
      subcategory: 'Beverages',
      unit_of_measure: '12-pack',
      brand: 'LaCroix',
      description: 'Naturally essenced sparkling water, variety pack, 12 x 12 fl oz',
      image_urls: ['https://cdn.example.com/products/lacroix-variety.jpg'],
    },
  ];

  const products: Awaited<ReturnType<typeof prisma.product.create>>[] = [];
  for (const p of productsData) {
    const product = await prisma.product.create({ data: p });
    products.push(product);
  }
  console.log(`Created ${products.length} products`);

  const [milk, eggs, bread, avocados, spinach, womensJeans, mensTshirt, womensHoodie, mensJoggers, sparklingWater] =
    products;

  // ---------------------------------------------------------------------------
  // StoreProducts
  // ---------------------------------------------------------------------------
  const now = new Date();
  const validUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days

  const storeProductsData = [
    // Fry's — grocery items
    { store_id: frys.id, product_id: milk.id, current_price: '5.49', original_price: '6.99', on_sale: true, source_url: 'https://www.frysfood.com/p/milk' },
    { store_id: frys.id, product_id: eggs.id, current_price: '7.99', original_price: null, on_sale: false, source_url: 'https://www.frysfood.com/p/eggs' },
    { store_id: frys.id, product_id: bread.id, current_price: '6.49', original_price: '7.49', on_sale: true, source_url: 'https://www.frysfood.com/p/bread' },
    { store_id: frys.id, product_id: sparklingWater.id, current_price: '5.99', original_price: null, on_sale: false, source_url: 'https://www.frysfood.com/p/sparkling-water' },
    // Sprouts — grocery items
    { store_id: sprouts.id, product_id: milk.id, current_price: '5.99', original_price: null, on_sale: false, source_url: 'https://www.sprouts.com/product/milk' },
    { store_id: sprouts.id, product_id: avocados.id, current_price: '4.99', original_price: '5.99', on_sale: true, source_url: 'https://www.sprouts.com/product/avocados' },
    { store_id: sprouts.id, product_id: spinach.id, current_price: '3.49', original_price: null, on_sale: false, source_url: 'https://www.sprouts.com/product/spinach' },
    { store_id: sprouts.id, product_id: sparklingWater.id, current_price: '6.49', original_price: null, on_sale: false, source_url: 'https://www.sprouts.com/product/sparkling-water' },
    // H&M — clothing
    { store_id: hm.id, product_id: womensJeans.id, current_price: '29.99', original_price: '39.99', on_sale: true, source_url: 'https://www.hm.com/product/womens-jeans' },
    { store_id: hm.id, product_id: mensTshirt.id, current_price: '12.99', original_price: null, on_sale: false, source_url: 'https://www.hm.com/product/mens-tshirt' },
    // Old Navy — clothing
    { store_id: oldNavy.id, product_id: womensHoodie.id, current_price: '34.99', original_price: '49.99', on_sale: true, source_url: 'https://www.oldnavy.com/product/womens-hoodie' },
    { store_id: oldNavy.id, product_id: mensJoggers.id, current_price: '24.99', original_price: '34.99', on_sale: true, source_url: 'https://www.oldnavy.com/product/mens-joggers' },
    // QuikTrip — convenience
    { store_id: qt.id, product_id: sparklingWater.id, current_price: '8.99', original_price: null, on_sale: false, source_url: 'https://www.quiktrip.com/product/sparkling-water' },
  ];

  const storeProducts: Awaited<ReturnType<typeof prisma.storeProduct.create>>[] = [];
  for (const sp of storeProductsData) {
    const storeProduct = await prisma.storeProduct.create({
      data: {
        store_id: sp.store_id,
        product_id: sp.product_id,
        current_price: sp.current_price,
        original_price: sp.original_price ?? undefined,
        on_sale: sp.on_sale,
        source_url: sp.source_url,
        last_scraped: now,
        price_valid_until: validUntil,
      },
    });
    storeProducts.push(storeProduct);
  }
  console.log(`Created ${storeProducts.length} store products`);

  // ---------------------------------------------------------------------------
  // Coupons
  // ---------------------------------------------------------------------------
  const couponsData = [
    {
      store_id: frys.id,
      code: 'FRESH10',
      description: '10% off your entire grocery order over $50',
      discount_type: DiscountType.PERCENT,
      discount_value: '10.00',
      minimum_purchase: '50.00',
      applicable_products: [] as string[],
      applicable_categories: ['GROCERY'],
      valid_from: now,
      valid_until: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      source_type: CouponSourceType.WEBSITE,
      source_url: 'https://www.frysfood.com/coupons',
      confidence_score: 0.95,
    },
    {
      store_id: sprouts.id,
      code: null,
      description: 'Buy 1 Get 1 Free on all organic produce this weekend',
      discount_type: DiscountType.BOGO,
      discount_value: '0.00',
      minimum_purchase: null,
      applicable_products: [] as string[],
      applicable_categories: ['Produce'],
      valid_from: now,
      valid_until: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      source_type: CouponSourceType.FLYER,
      source_url: 'https://www.sprouts.com/weekly-ad',
      confidence_score: 1.0,
    },
    {
      store_id: oldNavy.id,
      code: 'STYLE30',
      description: '$30 off any purchase of $75 or more',
      discount_type: DiscountType.ABSOLUTE,
      discount_value: '30.00',
      minimum_purchase: '75.00',
      applicable_products: [] as string[],
      applicable_categories: ['CLOTHING'],
      valid_from: now,
      valid_until: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      source_type: CouponSourceType.EMAIL,
      source_url: 'https://www.oldnavy.com/promo/style30',
      confidence_score: 0.9,
    },
  ];

  for (const c of couponsData) {
    await prisma.coupon.create({ data: c });
  }
  console.log(`Created ${couponsData.length} coupons`);

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
