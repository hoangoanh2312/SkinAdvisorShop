import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "./pages.css";
import "./admin.css";
import "./admin-orders.css";
import "./skin-analysis.css";
import "./luxury.css";
import "./phase12.css";
import "./order-detail-polish.css";
import "./sandwich-typography.css";
import "./sandwich-vibrant-theme.css";
import "./dream-inspired-motion.css";
import App from "./App.jsx";
import { AuthProvider } from "./contexts/AuthContext";
import { CartProvider } from "./contexts/CartContext";
import { WishlistProvider } from "./contexts/WishlistContext";
import "./wishlist.css";
import "./theme-harmony.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider><App /></WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
