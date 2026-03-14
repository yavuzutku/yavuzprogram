// src/components/toast.js

export function showToast(msg, type = "ok") {
  document.querySelectorAll(".app-toast").forEach(e => e.remove());
  
  const el = document.createElement("div");
  el.className = `app-toast app-toast--${type}`;
  el.textContent = msg;
  
  el.style.cssText = `
    position: fixed;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%);
    padding: 10px 22px;
    border-radius: 30px;
    font-family: var(--font-body);
    font-size: 13.5px;
    font-weight: 600;
    z-index: 99999;
    pointer-events: none;
    white-space: nowrap;
    box-shadow: 0 6px 24px rgba(0,0,0,0.4);
    background: ${type === "ok" ? "#22c55e" : "#ef4444"};
    color: #fff;
    animation: toastIn 0.25s cubic-bezier(0.34,1.56,0.64,1);
  `;
  
  document.body.appendChild(el);
  
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity 0.3s";
    setTimeout(() => el.remove(), 300);
  }, 2400);
}