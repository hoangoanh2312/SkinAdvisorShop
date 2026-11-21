import { Route, Routes } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import AdminLayout from "../layouts/AdminLayout";
import Home from "../pages/HomePage";
import Products from "../pages/Products";
import ProductDetail from "../pages/ProductDetail";
import SkinAdvisor from "../pages/SkinAdvisor";
import SkinAnalysis from "../pages/SkinAnalysis";
import Login from "../pages/Login";
import Register from "../pages/Register";
import ForgotPassword from "../pages/ForgotPassword";
import ResetPassword from "../pages/ResetPassword";
import VerifyEmail from "../pages/VerifyEmail";
import Cart from "../pages/Cart";
import Checkout from "../pages/Checkout";
import Profile from "../pages/Profile";
import Orders from "../pages/Orders";
import NotFound from "../pages/NotFound";
import Dashboard from "../pages/admin/Dashboard";
import InventoryAdmin from "../pages/admin/InventoryAdmin";
import ReturnsAdmin from "../pages/admin/ReturnsAdmin";
import ReportsAdmin from "../pages/admin/ReportsAdmin";
import AuditAdmin from "../pages/admin/AuditAdmin";
import ReadinessAdmin from "../pages/admin/ReadinessAdmin";
import LaunchReadinessAdmin from "../pages/admin/LaunchReadinessAdmin";
import ProductsAdmin from "../pages/admin/ProductsAdmin";
import ProductForm from "../pages/admin/ProductForm";
import CategoriesAdmin from "../pages/admin/CategoriesAdmin";
import OrdersAdmin from "../pages/admin/OrdersAdmin";
import OrderAdminDetail from "../pages/admin/OrderAdminDetail";
import UsersAdmin from "../pages/admin/UsersAdmin";
import VouchersAdmin from "../pages/admin/VouchersAdmin";
import BrandsAdmin from "../pages/admin/BrandsAdmin";
import NewsletterAdmin from "../pages/admin/NewsletterAdmin";
import UnsubscribePage from "../pages/UnsubscribePage";
import ContactPage from "../pages/ContactPage";
import ContactAdmin from "../pages/admin/ContactAdmin";
import OrderDetail from "../pages/OrderDetail";
import PaymentResult from "../pages/PaymentResult";
import BankTransfer from "../pages/BankTransfer";
import Wishlist from "../pages/Wishlist";
import { AboutPage, CommitmentsPage, FaqPage, ShippingReturnsPage } from "../pages/InfoPages";
import { AdminRoute, CustomerRoute, ProtectedRoute } from "../components/common/RouteGuards";
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
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/payment/result" element={<PaymentResult />} />
        <Route path="/giao-hang-doi-tra" element={<ShippingReturnsPage />} />
        <Route path="/cau-hoi-thuong-gap" element={<FaqPage />} />
        <Route path="/cau-chuyen" element={<AboutPage />} />
        <Route path="/cam-ket" element={<CommitmentsPage />} />
        <Route path="/huy-nhan-ban-tin" element={<UnsubscribePage />} />
        <Route path="/lien-he" element={<ContactPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/profile" element={<Profile />} />
          <Route path="/skin-analysis" element={<SkinAnalysis />} />
        </Route>
        <Route element={<CustomerRoute />}>
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/payment/bank-transfer/:orderId" element={<BankTransfer />} />
        </Route>
      </Route>
      <Route element={<AdminRoute />}>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="products" element={<ProductsAdmin />} />
        <Route path="products/new" element={<ProductForm />} />
        <Route path="products/:id/edit" element={<ProductForm />} />
        <Route path="categories" element={<CategoriesAdmin />} />
        <Route path="brands" element={<BrandsAdmin />} />
        <Route path="orders" element={<OrdersAdmin />} />
        <Route path="orders/:id" element={<OrderAdminDetail />} />
        <Route path="users" element={<UsersAdmin />} />
        <Route path="vouchers" element={<VouchersAdmin />} />
        <Route path="newsletter" element={<NewsletterAdmin />} />
        <Route path="contact" element={<ContactAdmin />} />
        <Route path="inventory" element={<InventoryAdmin />} />
        <Route path="returns" element={<ReturnsAdmin />} />
        <Route path="reports" element={<ReportsAdmin />} />
        <Route path="audit" element={<AuditAdmin />} />
        <Route path="readiness" element={<ReadinessAdmin />} />
        <Route path="launch-readiness" element={<LaunchReadinessAdmin />} />
      </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
