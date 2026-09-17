import { Route, Routes } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import AdminLayout from "../layouts/AdminLayout";
import Home from "../pages/HomePage";
import Products from "../pages/Products";
import ProductDetail from "../pages/ProductDetail";
import SkinAdvisor from "../pages/SkinAdvisor";
import Login from "../pages/Login";
import Register from "../pages/Register";
import Cart from "../pages/Cart";
import Checkout from "../pages/Checkout";
import Profile from "../pages/Profile";
import Orders from "../pages/Orders";
import NotFound from "../pages/NotFound";
import Dashboard from "../pages/admin/Dashboard";
import ProductsAdmin from "../pages/admin/ProductsAdmin";
import ProductForm from "../pages/admin/ProductForm";
import CategoriesAdmin from "../pages/admin/CategoriesAdmin";
import OrdersAdmin from "../pages/admin/OrdersAdmin";
import UsersAdmin from "../pages/admin/UsersAdmin";
import VouchersAdmin from "../pages/admin/VouchersAdmin";
export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/skin-advisor" element={<SkinAdvisor />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/orders" element={<Orders />} />
      </Route>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="products" element={<ProductsAdmin />} />
        <Route path="products/new" element={<ProductForm />} />
        <Route path="products/:id/edit" element={<ProductForm />} />
        <Route path="categories" element={<CategoriesAdmin />} />
        <Route path="orders" element={<OrdersAdmin />} />
        <Route path="users" element={<UsersAdmin />} />
        <Route path="vouchers" element={<VouchersAdmin />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
