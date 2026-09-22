require("dotenv").config({ quiet: true });

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");

mongoose.set("autoIndex", false);

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:5000";
const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const adminEmail = `skinora.catalog.admin.${uniquePart}@example.com`;
const customerEmail = `skinora.catalog.customer.${uniquePart}@example.com`;
const password = `Catalog-${uniquePart}`;
const slug = `catalog-test-${uniquePart}`;
const brand = `CatalogBrand-${uniquePart}`;
const sku = `CATALOG-${uniquePart}`.toUpperCase();

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${options.method || "GET"} ${path} returned non-JSON HTTP ${response.status}`);
  }
  return { status: response.status, body };
};

const jsonRequest = (path, method, body, token) =>
  request(path, {
    method,
    body: JSON.stringify(body),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

const expectStatus = (result, status, label) => {
  assert(result.status === status, `${label} expected ${status}, received ${result.status}`);
};

const run = async () => {
  try {
    console.log(`Admin test email: ${adminEmail}`);
    console.log(`Customer test email: ${customerEmail}`);

    const publicCategories = await request("/api/categories");
    const publicProducts = await request("/api/products");
    expectStatus(publicCategories, 200, "Public categories");
    expectStatus(publicProducts, 200, "Public products");
    console.log("Public list APIs: passed (HTTP 200)");

    expectStatus(await jsonRequest("/api/categories", "POST", { name: "No token", slug: `no-token-${slug}` }), 401, "Category without token");
    expectStatus(await jsonRequest("/api/products", "POST", {}), 401, "Product without token");
    console.log("No-token writes: passed (HTTP 401)");

    await mongoose.connect(process.env.MONGO_URI);
    const admin = await User.create({
      fullName: "Skinora Catalog Admin Test",
      email: adminEmail,
      password: await bcrypt.hash(password, 12),
      role: "admin",
    });
    await mongoose.connection.close();
    assert(admin.role === "admin", "Test admin was not created with admin role");

    const customerRegister = await jsonRequest("/api/auth/register", "POST", {
      fullName: "Skinora Catalog Customer Test",
      email: customerEmail,
      password,
    });
    expectStatus(customerRegister, 201, "Customer register");
    const customerToken = customerRegister.body.data.token;

    const adminLogin = await jsonRequest("/api/auth/login", "POST", { email: adminEmail, password });
    expectStatus(adminLogin, 200, "Admin login");
    const adminToken = adminLogin.body.data.token;

    expectStatus(await jsonRequest("/api/categories", "POST", { name: "Customer category", slug: `customer-${slug}` }, customerToken), 403, "Customer category create");
    expectStatus(await jsonRequest("/api/products", "POST", {}, customerToken), 403, "Customer product create");
    console.log("Customer writes: passed (HTTP 403)");

    const categoryCreate = await jsonRequest("/api/categories", "POST", {
      name: `Catalog Test ${uniquePart}`,
      slug,
      description: "Isolated catalog API test category",
    }, adminToken);
    expectStatus(categoryCreate, 201, "Admin category create");
    const categoryId = categoryCreate.body.data.category._id;

    const productCreate = await jsonRequest("/api/products", "POST", {
      name: `Niacinamide Serum ${uniquePart}`,
      slug: `niacinamide-serum-${slug}`,
      brand,
      category: categoryId,
      description: "Catalog API isolated product",
      shortDescription: "Niacinamide test serum",
      skinTypes: ["oily"],
      skinConcerns: ["acne"],
      ingredients: [{
        name: "Niacinamide",
        normalizedName: "niacinamide",
        benefits: ["Oil control"],
        concerns: ["acne"],
      }],
      keyIngredients: ["Niacinamide"],
      basePrice: 250000,
      salePrice: 220000,
      averageRating: 4.8,
      soldCount: 25,
      isFeatured: true,
    }, adminToken);
    expectStatus(productCreate, 201, "Admin product create");
    const productId = productCreate.body.data.product._id;
    const productSlug = productCreate.body.data.product.slug;

    const variantCreate = await jsonRequest(`/api/products/${productId}/variants`, "POST", {
      name: "30 ml",
      sku,
      size: "30",
      unit: "ml",
      price: 250000,
      salePrice: 220000,
      stock: 15,
    }, adminToken);
    expectStatus(variantCreate, 201, "Admin variant create");
    const variantId = variantCreate.body.data.variant._id;
    console.log("Admin creates: passed (category, product, variant HTTP 201)");

    expectStatus(await request(`/api/categories/${categoryId}`), 200, "Category detail");
    const byId = await request(`/api/products/${productId}`);
    const bySlug = await request(`/api/products/${productSlug}`);
    const variants = await request(`/api/products/${productId}/variants`);
    expectStatus(byId, 200, "Product detail by ID");
    expectStatus(bySlug, 200, "Product detail by slug");
    expectStatus(variants, 200, "Product variants");
    assert(byId.body.data.variants.some((item) => item._id === variantId), "Product detail did not include active variant");
    console.log("Public detail APIs: passed (ID, slug, active variants)");

    const filterQueries = [
      `search=${encodeURIComponent(uniquePart)}`,
      `category=${categoryId}`,
      `brand=${encodeURIComponent(brand)}`,
      "skinType=oily",
      "skinConcern=acne",
      "ingredient=niacinamide",
      "minPrice=200000&maxPrice=300000",
      "featured=true",
      `search=${encodeURIComponent(uniquePart)}&page=1&limit=1`,
      `search=${encodeURIComponent(uniquePart)}&sort=newest`,
      `search=${encodeURIComponent(uniquePart)}&sort=price_asc`,
      `search=${encodeURIComponent(uniquePart)}&sort=price_desc`,
      `search=${encodeURIComponent(uniquePart)}&sort=rating`,
      `search=${encodeURIComponent(uniquePart)}&sort=popular`,
    ];
    for (const query of filterQueries) {
      const result = await request(`/api/products?${query}`);
      expectStatus(result, 200, `Filter ${query}`);
      assert(result.body.data.products.some((item) => item._id === productId), `Filter did not return test product: ${query}`);
      assert(result.body.data.pagination.page >= 1, `Pagination missing for: ${query}`);
    }
    console.log("Search, filters, pagination and sorting: passed");

    expectStatus(await jsonRequest(`/api/categories/${categoryId}`, "PUT", { description: "Updated test category" }, adminToken), 200, "Category update");
    expectStatus(await jsonRequest(`/api/products/${productId}`, "PUT", { shortDescription: "Updated serum", salePrice: 210000 }, adminToken), 200, "Product update");
    expectStatus(await jsonRequest(`/api/variants/${variantId}`, "PUT", { stock: 20 }, adminToken), 200, "Variant update");
    console.log("Admin updates: passed (HTTP 200)");

    expectStatus(await jsonRequest(`/api/products/${productId}`, "PUT", { basePrice: -1 }, adminToken), 400, "Negative product price");
    expectStatus(await jsonRequest(`/api/variants/${variantId}`, "PUT", { stock: -1 }, adminToken), 400, "Negative variant stock");
    expectStatus(await jsonRequest(`/api/products/${productId}/variants`, "POST", { name: "Duplicate", sku, price: 1, stock: 1 }, adminToken), 409, "Duplicate SKU");
    expectStatus(await request("/api/categories/not-an-object-id"), 400, "Invalid ObjectId");
    expectStatus(await request(`/api/products/${new mongoose.Types.ObjectId()}`), 404, "Missing product");
    console.log("Validation and error cases: passed (400, 404, 409)");

    const deletedVariant = await jsonRequest(`/api/variants/${variantId}`, "DELETE", {}, adminToken);
    expectStatus(deletedVariant, 200, "Variant soft delete");
    assert(deletedVariant.body.data.variant.isActive === false, "Variant was not soft deleted");
    const variantsAfterDelete = await request(`/api/products/${productId}/variants`);
    expectStatus(variantsAfterDelete, 200, "Variants after soft delete");
    assert(!variantsAfterDelete.body.data.variants.some((item) => item._id === variantId), "Inactive variant remained public");

    const deletedProduct = await jsonRequest(`/api/products/${productId}`, "DELETE", {}, adminToken);
    const deletedCategory = await jsonRequest(`/api/categories/${categoryId}`, "DELETE", {}, adminToken);
    expectStatus(deletedProduct, 200, "Product soft delete");
    expectStatus(deletedCategory, 200, "Category soft delete");
    assert(deletedProduct.body.data.product.isActive === false, "Product was not soft deleted");
    assert(deletedCategory.body.data.category.isActive === false, "Category was not soft deleted");
    expectStatus(await request(`/api/categories/${categoryId}`), 404, "Deleted category public detail");
    expectStatus(await request(`/api/products/${productId}`), 404, "Deleted product public detail");
    const postDeleteList = await request(`/api/products?search=${encodeURIComponent(uniquePart)}`);
    assert(!postDeleteList.body.data.products.some((item) => item._id === productId), "Inactive product remained public");
    console.log("Soft delete and public exclusion: passed");

    console.log(`Test data retained: admin=${adminEmail}, customer=${customerEmail}, category=${categoryId}, product=${productId}, variant=${variantId}`);
    console.log("All catalog API tests passed");
  } catch (error) {
    console.error(`Catalog API test failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.connection.close();
  }
};

run();
