import { LoaderCircle, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function ConfirmActionModal({ title, description, confirmLabel, danger = false, busy, error, onConfirm, onClose }) {
  const modalRef = useRef(null);
  const confirmRef = useRef(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const appRoot = document.getElementById("root");
    if (appRoot) appRoot.inert = true;
    confirmRef.current?.focus();
    const handleKey = (event) => {
      if (event.key === "Escape" && !busy) onClose();
      if (event.key === "Tab") {
        const focusable = [...modalRef.current.querySelectorAll("button:not(:disabled)")];
        if (!focusable.length) return;
        const first = focusable[0]; const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("keydown", handleKey); if (appRoot) appRoot.inert = false; previouslyFocused?.focus(); };
  }, [busy, onClose]);
  return createPortal(<div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}><section ref={modalRef} className="admin-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="admin-confirm-title"><button className="admin-modal-close" aria-label="Đóng" disabled={busy} onClick={onClose}><X /></button><h2 id="admin-confirm-title">{title}</h2><p>{description}</p>{error && <div className="admin-modal-error" role="alert">{error}</div>}<footer><button className="btn btn-light" disabled={busy} onClick={onClose}>Quay lại</button><button ref={confirmRef} className={`btn ${danger ? "admin-btn-danger" : "btn-dark"}`} disabled={busy} onClick={onConfirm}>{busy && <LoaderCircle className="spin" />}{busy ? "Đang xử lý..." : confirmLabel}</button></footer></section></div>, document.body);
}
